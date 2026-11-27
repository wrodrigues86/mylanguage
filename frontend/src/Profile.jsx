import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { voiceLanguages } from './data/voiceLanguages.js';
import './profile-crud.css';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api' });
api.interceptors.request.use(config => {
  const token = localStorage.getItem('ml-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const detectedLanguage = () => navigator.language || 'pt-BR';
function localeLabel(locale) {
  try { return new Intl.DisplayNames(['pt-BR'], { type: 'language' }).of(locale) || locale; }
  catch { return locale; }
}

async function optimizeAvatarPhoto(file) {
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 25000000) throw new Error('A foto tem dimensões muito grandes.');
    const canvas = document.createElement('canvas');
    for (const size of [256, 192, 128]) {
      canvas.width = size; canvas.height = size;
      const scale = Math.max(size / bitmap.width, size / bitmap.height);
      const cropWidth = size / scale; const cropHeight = size / scale;
      const left = (bitmap.width - cropWidth) / 2; const top = (bitmap.height - cropHeight) / 2;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Não foi possível processar a foto.');
      context.drawImage(bitmap, left, top, cropWidth, cropHeight, 0, 0, size, size);
      for (const quality of [0.84, 0.72, 0.6, 0.48]) {
        const data = canvas.toDataURL('image/jpeg', quality);
        if (Math.ceil(data.slice('data:image/jpeg;base64,'.length).length * 0.75) <= 150 * 1024) return data;
      }
    }
    throw new Error('A foto não pôde ser reduzida o suficiente.');
  } finally { bitmap.close?.(); }
}

export default function Profile({ onDeleted, onUpdated, siteName = 'MyLingua' }) {
  const [profile, setProfile] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState(detectedLanguage);
  const [minimumPasswordLength, setMinimumPasswordLength] = useState(10);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/me'), api.get('/settings/public')])
      .then(([profileResult, settingsResult]) => {
        setProfile(profileResult.data);
        setPreferredLanguage(profileResult.data.preferred_language || detectedLanguage());
        setMinimumPasswordLength(settingsResult.data.minPasswordLength || 10);
      })
      .catch(err => setError(err.response?.data?.error || 'Não foi possível carregar seu perfil.'));
  }, []);

  useEffect(() => () => {
    if (avatarPreview.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  async function saveLanguage(event) {
    event.preventDefault(); setBusy(true); setError(''); setSuccess('');
    try {
      const { data } = await api.patch('/me/preferences', { preferred_language: preferredLanguage });
      setProfile(data); onUpdated?.(data); setSuccess('Idioma do verso e do áudio atualizado.');
    } catch (err) { setError(err.response?.data?.error || 'Não foi possível salvar o idioma.'); }
    finally { setBusy(false); }
  }

  function chooseAvatarPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Escolha uma foto JPG, PNG ou WebP de até 5 MB.');
      return;
    }
    setError(''); setSuccess('');
    setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file));
  }

  async function saveAvatar(event) {
    event.preventDefault();
    if (!avatarFile) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      const avatarData = await optimizeAvatarPhoto(avatarFile);
      const { data } = await api.patch('/me/avatar', { avatar_data: avatarData });
      setProfile(data); onUpdated?.(data); setAvatarPreview(''); setAvatarFile(null); setSuccess('Foto de perfil atualizada.');
    } catch (err) { setError(err.response?.data?.error || err.message || 'Não foi possível salvar a foto.'); }
    finally { setBusy(false); }
  }

  async function removeAvatarPhoto() {
    setBusy(true); setError(''); setSuccess('');
    try {
      const { data } = await api.patch('/me/avatar', { avatar_data: '' });
      setProfile(data); onUpdated?.(data); setAvatarPreview(''); setAvatarFile(null); setSuccess('Foto removida. A inicial do seu nome será exibida.');
    } catch (err) { setError(err.response?.data?.error || 'Não foi possível remover a foto.'); }
    finally { setBusy(false); }
  }

  async function resetPassword(event) {
    event.preventDefault(); setPasswordError(''); setSuccess('');
    if (newPassword !== confirmPassword) { setPasswordError('A confirmação não corresponde à nova senha.'); return; }
    setBusy(true);
    try {
      await api.patch('/me/password', { current_password: currentPassword, new_password: newPassword });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setSuccess('Senha redefinida com sucesso.');
    } catch (err) { setPasswordError(err.response?.data?.error || 'Não foi possível redefinir a senha.'); }
    finally { setBusy(false); }
  }

  async function deleteAccount(event) {
    event.preventDefault();
    if (!window.confirm('Sua conta e todos os seus dados de estudo serão excluídos permanentemente. Deseja continuar?')) return;
    setBusy(true); setDeleteError('');
    try { await api.delete('/me', { data: { password: deletePassword } }); onDeleted(); }
    catch (err) { setDeleteError(err.response?.data?.error || 'Não foi possível excluir a conta.'); }
    finally { setBusy(false); }
  }

  const hasDetectedOption = preferredLanguage && !voiceLanguages.some(language => language.code === preferredLanguage);
  return <div className="profile-page">
    <header className="page-head"><div><div className="eyebrow">SUA CONTA</div><h1>Perfil</h1><p>Gerencie o idioma do verso, sua senha e sua conta.</p></div></header>
    {error && <div className="error-box profile-error" role="alert">{error}</div>}
    {success && <div className="profile-success" role="status">{success}</div>}
    <section className="profile-social-card" aria-labelledby="account-details-title">
      <div className="profile-social-cover" aria-hidden="true">
        <span className="profile-cover-wordmark">{siteName}<span>.</span></span>
        <span className="profile-cover-caption">APRENDA NO SEU RITMO</span>
      </div>
      <div className="profile-social-content">
        <div className="profile-social-identity">
          <div className="profile-social-avatar">
            {avatarPreview || profile?.avatar_data
              ? <img src={avatarPreview || profile.avatar_data} alt="" />
              : <span aria-hidden="true">{profile?.name?.trim()?.[0]?.toLocaleUpperCase('pt-BR') || 'U'}</span>}
          </div>
          <div className="profile-social-copy">
            <div className="eyebrow">PERFIL DO ESTUDANTE</div>
            <h2 id="account-details-title">{profile?.name || 'Carregando perfil…'}</h2>
            {profile && <>
              <p className="profile-social-email">{profile.email}</p>
              <div className="profile-social-meta">
                <span className="profile-account-tag">{profile.role === 'admin' ? 'Administrador' : 'Usuário'}</span>
                <span>Na {siteName} desde {profile.created_at ? new Date(profile.created_at + 'Z').toLocaleDateString('pt-BR') : '—'}</span>
              </div>
            </>}
          </div>
        </div>
        <form className="profile-avatar-controls" onSubmit={saveAvatar}>
          <div className="profile-avatar-actions">
            <label className="profile-avatar-file-button">
              Escolher foto
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseAvatarPhoto} disabled={!profile || busy} />
            </label>
            <button className="btn-primary-custom" disabled={busy || !profile || !avatarFile}>{busy ? 'Salvando...' : 'Salvar foto'}</button>
            {profile?.avatar_data && <button type="button" className="profile-avatar-remove" disabled={busy} onClick={removeAvatarPhoto}>Remover foto</button>}
          </div>
          <small>JPG, PNG ou WebP · até 5 MB</small>
        </form>
      </div>
    </section>
    <section className="panel profile-panel" aria-labelledby="language-title">
      <div className="eyebrow">IDIOMA DO VERSO E DO ÁUDIO</div><h2 id="language-title">Seu idioma</h2>
      <p className="profile-help">O idioma do seu dispositivo já vem selecionado. Ele determina a voz usada no verso dos cartões e pode ser alterado quando quiser.</p>
      <form className="profile-language-form" onSubmit={saveLanguage}>
        <label htmlFor="preferred-language">País / idioma do usuário</label>
        <select id="preferred-language" className="form-select" disabled={!profile} value={preferredLanguage} onChange={event => setPreferredLanguage(event.target.value)}>
          {hasDetectedOption && <option value={preferredLanguage}>{localeLabel(preferredLanguage)} ({preferredLanguage}) · detectado</option>}
          {voiceLanguages.map(language => <option key={language.code} value={language.code}>{language.label}</option>)}
        </select>
        <button className="btn-primary-custom" disabled={busy || !profile}>{busy ? 'Salvando…' : 'Salvar idioma'}</button>
      </form>
    </section>
    <section className="panel profile-panel" aria-labelledby="password-title">
      <div className="eyebrow">SEGURANÇA</div><h2 id="password-title">Redefinir senha</h2>
      <p className="profile-help">Escolha uma senha nova com pelo menos {minimumPasswordLength} caracteres.</p>
      {passwordError && <div className="error-box profile-error" role="alert">{passwordError}</div>}
      <form className="profile-password-form" onSubmit={resetPassword}>
        <label>Senha atual<input className="form-control" type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required autoComplete="current-password"/></label>
        <label>Nova senha<input className="form-control" type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} required minLength={minimumPasswordLength} maxLength="128" autoComplete="new-password"/></label>
        <label>Confirmar nova senha<input className="form-control" type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required minLength={minimumPasswordLength} maxLength="128" autoComplete="new-password"/></label>
        <button className="btn-primary-custom" disabled={busy}>{busy ? 'Salvando…' : 'Redefinir senha'}</button>
      </form>
    </section>
    {profile?.role === 'user' && <section className="panel profile-danger" aria-labelledby="delete-account-title">
      <div className="eyebrow">ENCERRAR CONTA</div><h2 id="delete-account-title">Excluir minha conta</h2>
      <p>A exclusão é permanente e remove seus dados de estudo. Confirme com sua senha atual.</p>
      {deleteError && <div className="error-box profile-error" role="alert">{deleteError}</div>}
      <form className="profile-cancel-form" onSubmit={deleteAccount}>
        <label htmlFor="delete-account-password">Senha atual</label>
        <input id="delete-account-password" className="form-control" type="password" value={deletePassword} onChange={event => setDeletePassword(event.target.value)} required autoComplete="current-password"/>
        <button className="profile-danger-button" disabled={busy}>{busy ? 'Aguarde…' : 'Excluir conta'}</button>
      </form>
    </section>}
  </div>;
}
