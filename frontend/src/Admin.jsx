import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import AssistantSettings from './AssistantSettings.jsx';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api' });
api.interceptors.request.use(config => {
  const token = localStorage.getItem('ml-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default function Admin() {
  const location = useLocation();
  const settingsPage = location.pathname === '/admin/settings';
  return <div className="admin-page">
    <header className="admin-heading"><div><div className="eyebrow">ÁREA RESTRITA</div><h1>{settingsPage ? 'Configura\u00e7\u00f5es' : 'Administracao'}</h1><p>Controles gerais da plataforma.</p></div><span className="admin-badge">ADMIN</span></header>
    {settingsPage ? <AdminSettings/> : <AdminOverview/>}
  </div>;
}

function AdminOverview() {
  const [overview, setOverview] = useState(null), [users, setUsers] = useState([]);
  const [search, setSearch] = useState(''), [loading, setLoading] = useState(true), [error, setError] = useState(''), [busyId, setBusyId] = useState(null);
  const loadUsers = () => api.get('/admin/users', { params: { search } }).then(({ data }) => setUsers(data)).catch(err => setError(err.response?.data?.error || 'Falha ao carregar usuários.'));
  useEffect(() => { api.get('/admin/overview').then(({ data }) => setOverview(data)).catch(err => setError(err.response?.data?.error || 'Não foi possível carregar o resumo.')).finally(() => setLoading(false)); }, []);
  useEffect(() => { const timer = setTimeout(loadUsers, 250); return () => clearTimeout(timer); }, [search]);
  async function toggleUser(user) {
    const active = !Boolean(user.active);
    const action = active ? 'reativar' : 'desativar';
    if (!window.confirm(`Deseja ${action} a conta de ${user.name}?`)) return;
    setBusyId(user.id); setError('');
    try { await api.patch(`/admin/users/${user.id}/active`, { active }); await loadUsers(); }
    catch (err) { setError(err.response?.data?.error || 'Não foi possível atualizar a conta.'); }
    finally { setBusyId(null); }
  }
  return <>
    {error && <div className="error-box" role="alert">{error}</div>}
    <section className="admin-stats" aria-label="Resumo da plataforma">
      {[["Usuários", overview?.users], ["Administradores", overview?.admins], ["Idiomas", overview?.languages], ["Aprendizados", overview?.learnings], ["Flashcards", overview?.flashcards]].map(([label, value]) => <article className="admin-stat" key={label}><span>{label}</span><strong>{loading ? '—' : value}</strong></article>)}
    </section>
    <section className="panel admin-users-panel"><div className="admin-users-heading"><div><div className="eyebrow">CONTAS</div><h2>Usuários cadastrados</h2></div><label className="admin-search">Pesquisar<input aria-label="Pesquisar usuários por nome ou e-mail" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome ou e-mail"/></label></div>
      <div className="admin-table-wrap"><table className="admin-table"><caption className="visually-hidden">Contas cadastradas e suas funções</caption><thead><tr><th scope="col">Pessoa</th><th scope="col">Cadastro</th><th scope="col">Função</th><th scope="col">Estado</th><th scope="col">Ação</th></tr></thead><tbody>{users.map(user => <tr key={user.id}><td><strong>{user.name}</strong><span>{user.email}</span></td><td>{new Date(user.created_at + 'Z').toLocaleDateString('pt-BR')}</td><td><span className={`role-pill ${user.role}`}>{user.role === 'admin' ? 'Administrador' : 'Usuário'}</span></td><td>{user.active ? 'Ativa' : 'Desativada'}</td><td>{user.role === 'user' ? <button className="admin-account-button" type="button" disabled={busyId === user.id} onClick={() => toggleUser(user)}>{busyId === user.id ? 'Salvando…' : user.active ? 'Desativar' : 'Reativar'}</button> : <span className="admin-own-account">Protegida</span>}</td></tr>)}{!loading && !users.length && <tr><td colSpan="5" className="admin-no-users">Nenhum usuário encontrado.</td></tr>}</tbody></table></div>
    </section>
  </>;
}

function AdminSettings() {
  const [settings, setSettings] = useState(null), [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const refreshAudit = () => api.get('/admin/audit-log').then(({data}) => setAudit(data));
  useEffect(() => { Promise.all([api.get('/admin/settings'), api.get('/admin/audit-log')]).then(([config, log]) => { setSettings(config.data); setAudit(log.data); }).catch(err => setError(err.response?.data?.error || 'Nao foi possivel carregar as configuracoes.')).finally(() => setLoading(false)); }, []);
  async function update(key, value) {
    const previous = settings[key]; setSettings(current => ({...current,[key]:value})); setSaving(key); setError(''); setNotice('');
    try { const {data} = await api.patch(`/admin/settings/${key}`, {value}); setSettings(data); await refreshAudit(); setNotice('Configuracao salva.'); }
    catch (err) { setSettings(current => ({...current,[key]:previous})); setError(err.response?.data?.error || 'Nao foi possivel salvar.'); }
    finally { setSaving(''); }
  }
  const actionNames = { setting_updated: 'Configura\u00e7\u00e3o alterada', assistant_config_updated: 'Assistente configurado', account_disabled: 'Conta desativada', account_reactivated: 'Conta reativada' };
  return <section className="admin-settings-panel">
    <header className="admin-settings-header"><div className="eyebrow">CONTROLES DA PLATAFORMA</div><h2>{'Configura\u00e7\u00f5es'}</h2><p className="admin-settings-intro">{'Seguran\u00e7a, regras de estudo e manuten\u00e7\u00e3o.'}</p></header>
    {error && <div className="error-box" role="alert">{error}</div>}{notice && <div className="admin-notice" role="status">{notice}</div>}
    {loading ? <p>Carregando configuracoes...</p> : settings && <>
      <section className="admin-settings-group"><h3>{'Seguran\u00e7a'}</h3>
        <SettingChoice id="session-duration" title={'Dura\u00e7\u00e3o da sess\u00e3o'} description={'Validade dos tokens emitidos em novos logins. Sessoes atuais nao mudam.'} value={settings.session_duration_days} disabled={Boolean(saving)} options={[[1,'1 dia'],[7,'7 dias'],[30,'30 dias']]} onChange={value=>update('session_duration_days',value)}/>
        <SettingChoice id="password-minimum" title={'Tamanho m\u00ednimo da senha'} description="Aplicado a novas contas. A conta master continua sujeita a regra propria do ambiente." value={settings.min_password_length} disabled={Boolean(saving)} options={[[10,'10 caracteres'],[12,'12 caracteres'],[14,'14 caracteres'],[16,'16 caracteres']]} onChange={value=>update('min_password_length',value)}/>
        <SettingToggle id="registration-open" title="Permitir novos cadastros" description="Quando desligado, novas contas nao podem ser criadas." checked={settings.registration_open} disabled={Boolean(saving)} onChange={value=>update('registration_open',value)}/>
      </section>
      <section className="admin-settings-group"><h3>Estudo</h3>
        <SettingChoice id="daily-review-limit" title={'Limite di\u00e1rio de revisoes'} description="Limite por conta; zero deixa as revisoes sem limite." value={settings.daily_review_limit} disabled={Boolean(saving)} options={[[0,'Sem limite'],[20,'20 por dia'],[50,'50 por dia'],[100,'100 por dia']]} onChange={value=>update('daily_review_limit',value)}/>
        <SettingToggle id="study-audio" title={'Audio de estudo'} description="Permite voz sintetizada pelo navegador durante a revisao." checked={settings.study_audio_enabled} disabled={Boolean(saving)} onChange={value=>update('study_audio_enabled',value)}/>
      </section>
      <section className="admin-settings-group"><h3>{'Opera\u00e7\u00e3o'}</h3>
        <SettingToggle id="maintenance-mode" title={'Modo de manutencao'} description="Bloqueia gravacoes dos usuarios e novos cadastros. Administradores continuam com acesso ao painel." checked={settings.maintenance_mode} disabled={Boolean(saving)} onChange={value=>update('maintenance_mode',value)}/>
      </section>
    </>}
    <AssistantSettings/>
    <section className="admin-audit-section"><div className="eyebrow">RASTREABILIDADE</div><h3>Atividade administrativa</h3><p>Alteracoes de configuracao e estado das contas, mais recentes primeiro.</p>
      {audit.length ? <div className="admin-audit-table-wrap"><table className="admin-audit-table"><caption className="visually-hidden">Administrative changes</caption><thead><tr><th scope="col">Data</th><th scope="col">Acao</th><th scope="col">Administrador</th><th scope="col">Detalhe</th></tr></thead><tbody>{audit.map(item=><tr key={item.id}><td><time dateTime={item.created_at}>{new Date(item.created_at + 'Z').toLocaleString('pt-BR')}</time></td><td><strong>{actionNames[item.action] || item.action}</strong></td><td>{item.actor_email}</td><td>{item.target || '-'}</td></tr>)}</tbody></table></div> : <p className="admin-audit-empty">Nenhuma alteracao registrada.</p>}
    </section>
  </section>;
}

function SettingChoice({id,title,description,value,disabled,options,onChange}) {
  return <label className="admin-setting admin-setting-choice" htmlFor={id}><span className="admin-setting-copy"><strong>{title}</strong><small>{description}</small></span><select id={id} value={value} disabled={disabled} onChange={event=>onChange(Number(event.target.value))}>{options.map(([option,label])=><option key={option} value={option}>{label}</option>)}</select></label>;
}

function SettingToggle({id,title,description,checked,disabled,onChange}) {
  return <label className="admin-setting" htmlFor={id}><span className="admin-setting-copy"><strong>{title}</strong><small>{description}</small></span><input id={id} type="checkbox" role="switch" checked={Boolean(checked)} disabled={disabled} onChange={event=>onChange(event.target.checked)}/></label>;
}
