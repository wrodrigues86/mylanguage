import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import AssistantSettings from './AssistantSettings.jsx';
import AnnouncementManager from './AnnouncementManager.jsx';
import './admin-brand-settings.css';

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
    <header className="admin-heading"><div><div className="eyebrow">ÁREA RESTRITA</div><h1>{settingsPage ? 'Configura\u00e7\u00f5es' : 'Administra\u00e7\u00e3o'}</h1><p>Controles gerais da plataforma.</p></div><span className="admin-badge">ADMIN</span></header>
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
  const [draftSettings, setDraftSettings] = useState(null);
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const refreshAudit = () => api.get('/admin/audit-log').then(({data}) => setAudit(data));
  useEffect(() => { Promise.all([api.get('/admin/settings'), api.get('/admin/audit-log')]).then(([config, log]) => { setSettings(config.data); setDraftSettings(config.data); setAudit(log.data); }).catch(err => setError(err.response?.data?.error || 'Nao foi possivel carregar as configuracoes.')).finally(() => setLoading(false)); }, []);
  function changeDraft(key, value) { setDraftSettings(current => ({...current,[key]:value})); setError(''); setNotice(''); }
  async function saveSettings(keys) {
    const changedKeys = keys.filter(key => draftSettings[key] !== settings[key]);
    if (!changedKeys.length) return;
    setSaving('settings'); setError(''); setNotice('');
    try {
      for (const key of changedKeys) {
        const {data} = await api.patch(`/admin/settings/${key}`, {value:draftSettings[key]});
        setSettings(data);
        setDraftSettings(current => ({...current,[key]:data[key]}));
        if (key === 'site_name') window.dispatchEvent(new CustomEvent('site-name-updated', { detail: data.site_name }));
      }
      await refreshAudit(); setNotice('Configurações salvas.');
    }
    catch (err) { setError(err.response?.data?.error || 'Não foi possível salvar todas as alterações.'); }
    finally { setSaving(''); }
  }
  const actionNames = { setting_updated: 'Configura\u00e7\u00e3o alterada', assistant_config_updated: 'Assistente configurado', account_disabled: 'Conta desativada', account_reactivated: 'Conta reativada', announcement_created: 'Banner criado', announcement_updated: 'Banner atualizado', announcement_deleted: 'Banner excluído' };
  const tabs = [{id:'general',label:'Geral'},{id:'security',label:'Segurança'},{id:'study',label:'Estudo'},{id:'banners',label:'Banners'},{id:'assistant',label:'Assistente'},{id:'activity',label:'Atividade'}];
  function handleTabKeyDown(event, index) {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault(); setActiveTab(tabs[next].id); document.getElementById(`settings-tab-${tabs[next].id}`)?.focus();
  }
  return <section className="admin-settings-panel">
    <div className="admin-settings-tabs" role="tablist" aria-label="Grupos de configurações">
      {tabs.map((tab,index)=><button key={tab.id} id={`settings-tab-${tab.id}`} type="button" role="tab" aria-selected={activeTab===tab.id} aria-controls="admin-settings-tabpanel" tabIndex={activeTab===tab.id?0:-1} onClick={()=>setActiveTab(tab.id)} onKeyDown={event=>handleTabKeyDown(event,index)}>{tab.label}</button>)}
    </div>
    <div id="admin-settings-tabpanel" className="admin-settings-tabpanel" role="tabpanel" aria-labelledby={`settings-tab-${activeTab}`} tabIndex="0">
      {error && <div className="error-box" role="alert">{error}</div>}{notice && <div className="admin-notice" role="status">{notice}</div>}
      {loading && activeTab !== 'banners' && activeTab !== 'assistant' && <p>Carregando configurações…</p>}
      {!loading && settings && draftSettings && activeTab === 'general' && <>
        <section className="admin-settings-group"><h3>Identidade</h3>
          <SettingText id="site-name" title="Nome do site" description="Nome exibido na marca e nas telas da plataforma. Use de 2 a 40 caracteres." value={draftSettings.site_name} disabled={Boolean(saving)} onChange={value=>changeDraft('site_name',value)}/>
        </section>
        <section className="admin-settings-group"><h3>Operação</h3>
          <SettingToggle id="registration-open" title="Permitir novos cadastros" description="Quando desligado, novas contas não podem ser criadas." checked={draftSettings.registration_open} disabled={Boolean(saving)} onChange={value=>changeDraft('registration_open',value)}/>
          <SettingToggle id="maintenance-mode" title="Modo de manutenção" description="Suspende o acesso das contas de usuário e encerra as sessões ativas. Administradores continuam com acesso." checked={draftSettings.maintenance_mode} disabled={Boolean(saving)} onChange={value=>changeDraft('maintenance_mode',value)}/>
        </section>
        <SettingsSaveButton disabled={Boolean(saving) || !['site_name','registration_open','maintenance_mode'].some(key=>draftSettings[key] !== settings[key])} onClick={()=>saveSettings(['site_name','registration_open','maintenance_mode'])}/>
      </>}
      {!loading && settings && draftSettings && activeTab === 'security' && <section className="admin-settings-group"><h3>Segurança</h3>
        <SettingChoice id="session-duration" title="Duração da sessão" description="Validade dos tokens emitidos em novos logins. Sessões atuais não mudam." value={draftSettings.session_duration_days} disabled={Boolean(saving)} options={[[1,'1 dia'],[7,'7 dias'],[30,'30 dias']]} onChange={value=>changeDraft('session_duration_days',value)}/>
        <SettingChoice id="password-minimum" title="Tamanho mínimo da senha" description="Aplicado a novas contas. A conta master continua sujeita à regra própria do ambiente." value={draftSettings.min_password_length} disabled={Boolean(saving)} options={[[10,'10 caracteres'],[12,'12 caracteres'],[14,'14 caracteres'],[16,'16 caracteres']]} onChange={value=>changeDraft('min_password_length',value)}/>
        <SettingsSaveButton disabled={Boolean(saving) || !['session_duration_days','min_password_length'].some(key=>draftSettings[key] !== settings[key])} onClick={()=>saveSettings(['session_duration_days','min_password_length'])}/>
      </section>}
      {!loading && settings && draftSettings && activeTab === 'study' && <section className="admin-settings-group"><h3>Estudo</h3>
        <SettingChoice id="daily-review-limit" title="Limite diário de revisões" description="Limite por conta; zero deixa as revisões sem limite." value={draftSettings.daily_review_limit} disabled={Boolean(saving)} options={[[0,'Sem limite'],[20,'20 por dia'],[50,'50 por dia'],[100,'100 por dia']]} onChange={value=>changeDraft('daily_review_limit',value)}/>
        <SettingToggle id="study-audio" title="Áudio de estudo" description="Permite voz sintetizada pelo navegador durante a revisão." checked={draftSettings.study_audio_enabled} disabled={Boolean(saving)} onChange={value=>changeDraft('study_audio_enabled',value)}/>
        <SettingsSaveButton disabled={Boolean(saving) || !['daily_review_limit','study_audio_enabled'].some(key=>draftSettings[key] !== settings[key])} onClick={()=>saveSettings(['daily_review_limit','study_audio_enabled'])}/>
      </section>}
      {activeTab === 'banners' && <AnnouncementManager/>}
      {activeTab === 'assistant' && <AssistantSettings/>}
      {!loading && activeTab === 'activity' && <section className="admin-audit-section"><div className="eyebrow">RASTREABILIDADE</div><h3>Atividade administrativa</h3><p>Alterações de configuração e estado das contas, mais recentes primeiro.</p>
        {audit.length ? <div className="admin-audit-table-wrap"><table className="admin-audit-table"><caption className="visually-hidden">Alterações administrativas</caption><thead><tr><th scope="col">Data</th><th scope="col">Ação</th><th scope="col">Administrador</th><th scope="col">Detalhe</th></tr></thead><tbody>{audit.map(item=><tr key={item.id}><td><time dateTime={item.created_at}>{new Date(item.created_at + 'Z').toLocaleString('pt-BR')}</time></td><td><strong>{actionNames[item.action] || item.action}</strong></td><td>{item.actor_email}</td><td>{item.target || '-'}</td></tr>)}</tbody></table></div> : <p className="admin-audit-empty">Nenhuma alteração registrada.</p>}
      </section>}
    </div>
  </section>;
}

function SettingChoice({id,title,description,value,disabled,options,onChange}) {
  return <label className="admin-setting admin-setting-choice" htmlFor={id}><span className="admin-setting-copy"><strong>{title}</strong><small>{description}</small></span><select id={id} value={value} disabled={disabled} onChange={event=>onChange(Number(event.target.value))}>{options.map(([option,label])=><option key={option} value={option}>{label}</option>)}</select></label>;
}

function SettingText({id,title,description,value,disabled,onChange}) {
  return <div className="admin-setting admin-setting-text">
    <label className="admin-setting-copy" htmlFor={id}><strong>{title}</strong><small>{description}</small></label>
    <div className="admin-setting-text-controls"><input id={id} type="text" value={value || ''} maxLength="40" minLength="2" required disabled={disabled} onChange={event=>onChange(event.target.value)}/></div>
  </div>;
}

function SettingToggle({id,title,description,checked,disabled,onChange}) {
  return <label className="admin-setting" htmlFor={id}><span className="admin-setting-copy"><strong>{title}</strong><small>{description}</small></span><input id={id} type="checkbox" role="switch" checked={Boolean(checked)} disabled={disabled} onChange={event=>onChange(event.target.checked)}/></label>;
}

function SettingsSaveButton({disabled,onClick}) {
  return <div className="admin-settings-actions"><button className="admin-setting-save" type="button" disabled={disabled} onClick={onClick}>Salvar alterações</button></div>;
}
