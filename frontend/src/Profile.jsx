import React, { useEffect, useState } from 'react';
import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api' });
api.interceptors.request.use(config => {
  const token = localStorage.getItem('ml-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default function Profile({ onDeleted }) {
  const [profile, setProfile] = useState(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get('/me').then(({ data }) => setProfile(data)).catch(err => setError(err.response?.data?.error || 'Não foi possível carregar seu perfil.'));
  }, []);

  async function cancelAccount(event) {
    event.preventDefault();
    if (!window.confirm('Sua conta e todos os seus dados de estudo serão excluídos permanentemente. Deseja continuar?')) return;
    setBusy(true); setError('');
    try { await api.delete('/me', { data: { password } }); onDeleted(); }
    catch (err) { setError(err.response?.data?.error || 'Não foi possível cancelar a conta.'); }
    finally { setBusy(false); }
  }

  return <div className="profile-page">
    <header className="page-head"><div><div className="eyebrow">SUA CONTA</div><h1>Perfil</h1><p>Confira seus dados de cadastro e gerencie sua conta.</p></div></header>
    {error && <div className="error-box profile-error" role="alert">{error}</div>}
    <section className="panel profile-panel" aria-labelledby="account-details-title">
      <div className="eyebrow">DADOS DE CADASTRO</div><h2 id="account-details-title">Informações da conta</h2>
      {!profile ? <p>Carregando perfil…</p> : <dl className="profile-details"><div><dt>Nome</dt><dd>{profile.name}</dd></div><div><dt>E-mail</dt><dd>{profile.email}</dd></div><div><dt>Tipo de conta</dt><dd>{profile.role === 'admin' ? 'Administrador' : 'Usuário'}</dd></div><div><dt>Data de cadastro</dt><dd>{profile.created_at ? new Date(profile.created_at + 'Z').toLocaleDateString('pt-BR') : '—'}</dd></div></dl>}
    </section>
  </div>;
}
