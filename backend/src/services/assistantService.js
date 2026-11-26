import { assistantRepository } from '../repositories/assistantRepository.js';
import { db } from '../database/db.js';

export class AssistantServiceError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

const recentRequests = new Map();
const SYSTEM_DEFAULT = 'You are a helpful language-learning assistant. Be accurate, concise, encouraging, and answer in the language used by the learner.';

function withinSchedule(config, now = new Date()) {
  if (!config.active_start && !config.active_end) return true;
  if (!config.active_start || !config.active_end) return false;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: config.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    const localTime = `${parts.find(part => part.type === 'hour').value}:${parts.find(part => part.type === 'minute').value}`;
    if (config.active_start < config.active_end) return localTime >= config.active_start && localTime < config.active_end;
    return localTime >= config.active_start || localTime < config.active_end;
  } catch { return false; }
}

export const assistantService = {
  getAdminConfig() { return assistantRepository.getAdminConfig(); },
  isWithinSchedule(config, now) { return withinSchedule(config, now); },
  getPublicConfig() {
    const config = assistantRepository.get();
    return { enabled: Boolean(config.enabled) && withinSchedule(config), name: config.name, welcomeMessage: config.welcome_message };
  },
  updateConfig(input = {}) {
    const current = assistantRepository.getAdminConfig();
    const next = {
      enabled: input.enabled,
      name: input.name,
      model: input.model,
      instructions: input.instructions,
      welcomeMessage: input.welcomeMessage,
      temperature: input.temperature,
      maxOutputTokens: input.maxOutputTokens,
      activeStart: input.activeStart ?? current.active_start ?? null,
      activeEnd: input.activeEnd ?? current.active_end ?? null,
      timezone: input.timezone ?? current.timezone ?? 'America/Sao_Paulo',
      apiKey: input.apiKey,
      clearApiKey: input.clearApiKey === true,
    };
    if (typeof next.enabled !== 'boolean') throw new AssistantServiceError('Escolha se o assistente deve ficar ativo.');
    if (typeof next.name !== 'string' || next.name.trim().length < 2 || next.name.trim().length > 40) throw new AssistantServiceError('O nome deve ter de 2 a 40 caracteres.');
    if (typeof next.model !== 'string' || !/^[a-zA-Z0-9._-]{1,100}$/.test(next.model.trim())) throw new AssistantServiceError('Informe um modelo OpenAI valido.');
    if (typeof next.instructions !== 'string' || next.instructions.trim().length < 20 || next.instructions.length > 10000) throw new AssistantServiceError('As instrucoes devem ter de 20 a 10000 caracteres.');
    if (typeof next.welcomeMessage !== 'string' || next.welcomeMessage.length > 500) throw new AssistantServiceError('A mensagem inicial pode ter no maximo 500 caracteres.');
    if (typeof next.temperature !== 'number' || !Number.isFinite(next.temperature) || next.temperature < 0 || next.temperature > 2) throw new AssistantServiceError('A temperatura deve ficar entre 0 e 2.');
    if (!Number.isInteger(next.maxOutputTokens) || next.maxOutputTokens < 50 || next.maxOutputTokens > 4000) throw new AssistantServiceError('O limite da resposta deve ficar entre 50 e 4000 tokens.');
    next.activeStart = typeof next.activeStart === 'string' ? next.activeStart.trim() || null : next.activeStart;
    next.activeEnd = typeof next.activeEnd === 'string' ? next.activeEnd.trim() || null : next.activeEnd;
    if ((next.activeStart === null) !== (next.activeEnd === null)) throw new AssistantServiceError('Preencha os horarios de inicio e fim, ou deixe ambos em branco.');
    const validTime = value => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
    if (next.activeStart !== null && (!validTime(next.activeStart) || !validTime(next.activeEnd) || next.activeStart === next.activeEnd)) throw new AssistantServiceError('Informe um intervalo de horario valido.');
    if (typeof next.timezone !== 'string' || next.timezone.length > 100) throw new AssistantServiceError('Informe um fuso horario valido.');
    try { new Intl.DateTimeFormat('en-US', { timeZone: next.timezone }).format(new Date()); }
    catch { throw new AssistantServiceError('Informe um fuso horario IANA valido, como America/Sao_Paulo.'); }
    if (typeof next.apiKey !== 'string' || next.apiKey.length > 500) throw new AssistantServiceError('A chave da API e invalida.');
    next.apiKey = next.apiKey.trim();
    if (next.apiKey && !/^sk-[A-Za-z0-9_-]{20,}$/.test(next.apiKey.trim())) throw new AssistantServiceError('Informe uma chave valida da OpenAI.');
    if (next.enabled && !next.apiKey && (!current.apiKeyConfigured || next.clearApiKey)) throw new AssistantServiceError('Adicione uma chave da OpenAI antes de ativar o assistente.');
    assistantRepository.update(next);
    return assistantRepository.getAdminConfig();
  },
  async generateCards(userId, input = {}) {
    const languageId = Number(input.languageId);
    if (!Number.isSafeInteger(languageId) || languageId < 1) throw new AssistantServiceError('Selecione um idioma valido.');
    if (typeof input.topic !== 'string' || !input.topic.trim() || input.topic.trim().length > 200) throw new AssistantServiceError('Informe um tema de ate 200 caracteres.');
    if (!Number.isInteger(input.count) || input.count < 1 || input.count > 10) throw new AssistantServiceError('Escolha de 1 a 10 cards.');
    const language = db.prepare('SELECT name,code FROM languages WHERE id=? AND user_id=?').get(languageId, userId);
    if (!language) throw new AssistantServiceError('O idioma selecionado nao pertence a sua conta.', 404);
    const instructions = `${assistantRepository.get().instructions}\n\nYou create study flashcards for the requested target language. Write each front in ${language.name} and each back in Brazilian Portuguese. Make the cards accurate, concise, and useful for spaced repetition. Return only valid JSON, with no markdown or extra text, in this exact shape: {"cards":[{"front":"...","back":"..."}]}.`;
    const result = await this.chat(userId, { messages: [{ role: 'user', content: `Create exactly ${input.count} study flashcards about: ${input.topic.trim()}.` }] }, { instructions });
    let payload;
    try {
      const fenced = result.reply.match(/```(?:json)?\s*([\s\S]*?)```/i);
      const text = fenced?.[1] || result.reply;
      const start = text.indexOf('{'), end = text.lastIndexOf('}');
      payload = JSON.parse(start >= 0 && end > start ? text.slice(start, end + 1) : text);
    } catch { throw new AssistantServiceError('A resposta da IA nao veio no formato esperado. Tente gerar novamente.', 502); }
    if (!Array.isArray(payload.cards) || payload.cards.length !== input.count) throw new AssistantServiceError('A IA nao criou a quantidade esperada de cards. Tente novamente.', 502);
    return { language: language.name, cards: payload.cards.map(card => {
      if (!card || typeof card.front !== 'string' || typeof card.back !== 'string' || !card.front.trim() || !card.back.trim() || card.front.length > 500 || card.back.length > 2000) {
        throw new AssistantServiceError('A IA retornou um card invalido. Tente gerar novamente.', 502);
      }
      return { front: card.front.trim(), back: card.back.trim() };
    }) };
  },
  async chat(userId, input = {}, options = {}) {
    const config = assistantRepository.get();
    if (!config.enabled && !options.testMode) throw new AssistantServiceError('O assistente esta indisponivel no momento.', 503);
    if (!withinSchedule(config) && !options.testMode) throw new AssistantServiceError('O assistente esta fora do horario de funcionamento.', 503);
    let key;
    try { key = assistantRepository.getApiKey(); }
    catch { throw new AssistantServiceError('A chave armazenada nao pode ser lida. Informe-a novamente nas configuracoes do admin.', 503); }
    if (!key) throw new AssistantServiceError('A chave da OpenAI ainda nao foi configurada.', 503);
    const now = Date.now();
    const recent = (recentRequests.get(userId) || []).filter(time => now - time < 60_000);
    if (recent.length >= 20) throw new AssistantServiceError('Aguarde um pouco antes de enviar outra mensagem.', 429);
    recent.push(now); recentRequests.set(userId, recent);
    if (recentRequests.size > 2000) for (const [id, times] of recentRequests) if (!times.some(time => now - time < 60_000)) recentRequests.delete(id);

    if (!Array.isArray(input.messages) || input.messages.length < 1 || input.messages.length > 20) throw new AssistantServiceError('Envie de 1 a 20 mensagens na conversa.');
    const messages = input.messages.map(message => {
      if (!message || !['user','assistant'].includes(message.role) || typeof message.content !== 'string' || !message.content.trim() || message.content.length > 2000) {
        throw new AssistantServiceError('Uma mensagem da conversa e invalida.');
      }
      return { role: message.role, content: message.content.trim() };
    });
    if (messages[messages.length - 1].role !== 'user' || messages.reduce((sum, item) => sum + item.content.length, 0) > 12000) {
      throw new AssistantServiceError('A conversa e invalida ou longa demais.');
    }

    let response;
    try {
      response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          instructions: options.instructions || config.instructions || SYSTEM_DEFAULT,
          input: messages,
          temperature: config.temperature,
          max_output_tokens: config.max_output_tokens,
          store: false,
        }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      throw new AssistantServiceError('Nao foi possivel conectar a OpenAI. Tente novamente.', 502);
    }
    if (!response.ok) {
      if (response.status === 401) throw new AssistantServiceError('A OpenAI recusou a chave configurada. Confira-a nas configuracoes do admin.', 502);
      if (response.status === 429) throw new AssistantServiceError('O limite da API OpenAI foi atingido. Tente novamente mais tarde.', 503);
      throw new AssistantServiceError('A OpenAI nao gerou uma resposta. Confira o modelo e a conta da API.', 502);
    }
    const result = await response.json();
    const reply = typeof result.output_text === 'string'
      ? result.output_text.trim()
      : (result.output || []).flatMap(item => item.content || [])
        .filter(item => item.type === 'output_text' && typeof item.text === 'string')
        .map(item => item.text).join('\n').trim();
    if (!reply) throw new AssistantServiceError('A OpenAI retornou uma resposta vazia. Tente novamente.', 502);
    return { reply };
  },
};
