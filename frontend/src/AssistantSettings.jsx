import React, { useEffect, useState } from 'react';
import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api' });
api.interceptors.request.use(config => {
  const token = localStorage.getItem('ml-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default function AssistantSettings() {
  const [config, setConfig] = useState(null), [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [testMessage, setTestMessage] = useState('Como se diz bom dia em japones?');
  const [testReply, setTestReply] = useState(''), [testError, setTestError] = useState(''), [testing, setTesting] = useState(false);
  useEffect(() => {
    api.get('/admin/assistant').then(({ data }) => setConfig(data))
      .catch(err => setError(err.response?.data?.error || 'Nao foi possivel carregar o assistente.'))
      .finally(() => setLoading(false));
  }, []);

  function change(field, value) { setConfig(current => ({ ...current, [field]: value })); }
  async function save(event, clearApiKey = false) {
    event?.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const { data } = await api.patch('/admin/assistant', {
        enabled: config.enabled,
        name: config.name,
        model: config.model,
        instructions: config.instructions,
        welcomeMessage: config.welcome_message,
        temperature: config.temperature,
        maxOutputTokens: config.max_output_tokens,
        activeStart: config.active_start || '',
        activeEnd: config.active_end || '',
        timezone: config.timezone,
        apiKey: clearApiKey ? '' : apiKey,
        clearApiKey,
      });
      setConfig(data); setApiKey(''); setNotice(clearApiKey ? 'Chave removida.' : 'Configuracao do assistente salva.');
    } catch (err) { setError(err.response?.data?.error || 'Nao foi possivel salvar a configuracao.'); }
    finally { setSaving(false); }
  }

  async function testAssistant() {
    setTesting(true); setTestError(''); setTestReply('');
    try { const { data } = await api.post('/admin/assistant/test-chat', { message: testMessage }); setTestReply(data.reply); }
    catch (err) { setTestError(err.response?.data?.error || 'Nao foi possivel testar o assistente.'); }
    finally { setTesting(false); }
  }

  return <section className="assistant-admin-card" aria-labelledby="assistant-settings-title">
    <div className="eyebrow">ASSISTENTE DOS USUARIOS</div><h3 id="assistant-settings-title">Assistente de idiomas</h3>
    <p className="assistant-admin-intro">Configure a personalidade e o modelo. As chamadas sao feitas pelo backend usando sua conta da OpenAI.</p>
    {error && <div className="error-box" role="alert">{error}</div>}{notice && <div className="admin-notice" role="status">{notice}</div>}
    {loading || !config ? <p>Carregando configuracao...</p> : <form className="assistant-admin-form" onSubmit={save}>
      <label className="assistant-admin-enabled"><input type="checkbox" role="switch" checked={config.enabled} onChange={event => change('enabled', event.target.checked)}/><span><strong>Ativar assistente</strong><small>Mostra o chat nas telas dos usuarios.</small></span></label>
      <div className="assistant-admin-grid">
        <label>Nome do assistente<input className="form-control" value={config.name} maxLength="40" onChange={event => change('name', event.target.value)} required/></label>
        <label>Modelo OpenAI<input className="form-control" value={config.model} maxLength="100" onChange={event => change('model', event.target.value)} required placeholder="gpt-4o-mini"/></label>
        <label className="assistant-wide">Instrucoes do sistema<textarea className="form-control" rows="6" value={config.instructions} maxLength="10000" onChange={event => change('instructions', event.target.value)} required minLength="20"/><small>Define o papel, o tom e os limites da assistente.</small></label>
        <label className="assistant-wide">Mensagem inicial<textarea className="form-control" rows="2" value={config.welcome_message} maxLength="500" onChange={event => change('welcome_message', event.target.value)}/></label>
        <div className="assistant-hours assistant-wide"><div><strong>Horario de funcionamento <span>(opcional)</span></strong><small>Deixe inicio e fim em branco para funcionar sem horario. Vale para todos os dias.</small></div><div className="assistant-hours-fields"><label>Inicio<input className="form-control" type="time" value={config.active_start || ''} onChange={event => change('active_start', event.target.value)}/></label><label>Fim<input className="form-control" type="time" value={config.active_end || ''} onChange={event => change('active_end', event.target.value)}/></label><label>Fuso horario<input className="form-control" type="text" value={config.timezone} onChange={event => change('timezone', event.target.value)} placeholder="America/Sao_Paulo" required/></label></div><small>O horario de fim pode atravessar a meia-noite. Use um fuso IANA, por exemplo America/Sao_Paulo.</small></div>
        <label>Temperatura<input className="form-control" type="number" min="0" max="2" step="0.1" value={config.temperature} onChange={event => change('temperature', Number(event.target.value))}/></label>
        <label>Maximo de tokens de resposta<input className="form-control" type="number" min="50" max="4000" step="50" value={config.max_output_tokens} onChange={event => change('max_output_tokens', Number(event.target.value))}/></label>
      </div>
      <div className="assistant-key-row"><label htmlFor="assistant-api-key">Chave da OpenAI API {config.apiKeyConfigured && <span className="assistant-key-status">Chave configurada</span>}<input id="assistant-api-key" className="form-control" type="password" autoComplete="new-password" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder={config.apiKeyConfigured ? 'Deixe vazio para manter a chave atual' : 'sk-...'} /></label><p>A chave e criptografada no banco e nunca e enviada ao navegador. Mantenha JWT_SECRET estavel; se trocar esse segredo, informe a chave novamente.</p></div>{config.apiKeyConfigured && config.enabled && <p className="assistant-remove-hint">Desative o assistente para poder remover a chave.</p>}
      <div className="assistant-admin-actions"><button className="btn-primary-custom" type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar assistente'}</button>{config.apiKeyConfigured && <button className="assistant-remove-key" type="button" disabled={saving || config.enabled} onClick={() => { if (window.confirm('Remover a chave OpenAI armazenada?')) save(null, true); }}>Remover chave</button>}</div>
    </form>}
    {config && <section className="assistant-test-panel" aria-labelledby="assistant-test-title"><div className="eyebrow">PRÉVIA PRIVADA DO ADMIN</div><h4 id="assistant-test-title">Modo de teste</h4><p>Testa as configuracoes salvas mesmo com o assistente desativado ou fora do horario. Salve as alteracoes antes do teste. Cada envio faz uma chamada a API OpenAI.</p><label htmlFor="assistant-test-message">Pergunta de teste</label><textarea id="assistant-test-message" className="form-control" rows="2" maxLength="1000" value={testMessage} onChange={event => setTestMessage(event.target.value)}/><button className="assistant-test-button" type="button" disabled={!config.apiKeyConfigured || testing || !testMessage.trim()} onClick={testAssistant}>{testing ? 'Testando...' : 'Testar assistente'}</button>{!config.apiKeyConfigured && <small className="assistant-test-note">Cadastre e salve a chave OpenAI para testar.</small>}{testError && <div className="error-box" role="alert">{testError}</div>}{testReply && <div className="assistant-test-reply" role="status" aria-live="polite"><strong>Resposta de {config.name}</strong><p>{testReply}</p></div>}</section>}
  </section>;
}
