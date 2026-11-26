import { assistantService, AssistantServiceError } from '../services/assistantService.js';
import { settingsRepository } from '../repositories/settingsRepository.js';

function handleError(res, error) {
  if (error instanceof AssistantServiceError) return res.status(error.status).json({ error: error.message });
  console.error('Assistant request failed:', error?.message || 'unknown error');
  return res.status(500).json({ error: 'O assistente nao conseguiu concluir esta mensagem.' });
}

export const assistantController = {
  publicConfig(_req, res) { return res.json(assistantService.getPublicConfig()); },
  async chat(req, res) {
    try { return res.json(await assistantService.chat(req.user.id, req.body)); }
    catch (error) { return handleError(res, error); }
  },
  async generateCards(req, res) {
    try { return res.json(await assistantService.generateCards(req.user.id, req.body)); }
    catch (error) { return handleError(res, error); }
  },
  adminConfig(_req, res) {
    try { return res.json(assistantService.getAdminConfig()); }
    catch (error) { return handleError(res, error); }
  },
  updateAdminConfig(req, res) {
    try {
      const config = assistantService.updateConfig(req.body);
      settingsRepository.recordAdminAction(req.user.id, 'assistant_config_updated', config.name);
      return res.json(config);
    } catch (error) { return handleError(res, error); }
  },
  async testChat(req, res) {
    const message = req.body?.message;
    if (typeof message !== 'string' || !message.trim() || message.length > 1000) {
      return res.status(400).json({ error: 'Escreva uma pergunta de ate 1000 caracteres.' });
    }
    try { return res.json(await assistantService.chat(req.user.id, { messages: [{ role: 'user', content: message.trim() }] }, { testMode: true })); }
    catch (error) { return handleError(res, error); }
  },
};
