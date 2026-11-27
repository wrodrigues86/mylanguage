import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './announcements-admin.css';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api' });
api.interceptors.request.use(config => {
  const token = localStorage.getItem('ml-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

async function optimizeBannerImage(file) {
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 35000000) throw new Error('A imagem tem dimensões muito grandes.');
    const canvas = document.createElement('canvas');
    for (const [width, height] of [[1200, 300], [960, 240], [800, 200]]) {
      canvas.width = width; canvas.height = height;
      const scale = Math.max(width / bitmap.width, height / bitmap.height);
      const cropWidth = width / scale; const cropHeight = height / scale;
      const left = (bitmap.width - cropWidth) / 2; const top = (bitmap.height - cropHeight) / 2;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Não foi possível processar a imagem.');
      context.drawImage(bitmap, left, top, cropWidth, cropHeight, 0, 0, width, height);
      for (const quality of [0.84, 0.72, 0.6, 0.48]) {
        const data = canvas.toDataURL('image/jpeg', quality);
        if (Math.ceil(data.slice('data:image/jpeg;base64,'.length).length * 0.75) <= 150 * 1024) return data;
      }
    }
    throw new Error('A imagem não pôde ser reduzida o suficiente.');
  } finally { bitmap.close?.(); }
}

const emptyForm = { imageFile: null, imagePreview: '', imageData: '', altText: '', active: true };

export default function AnnouncementManager() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadBanners() {
    try { const { data } = await api.get('/admin/announcements'); setItems(data); }
    catch (err) { setError(err.response?.data?.error || 'Não foi possível carregar os banners.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadBanners(); }, []);
  useEffect(() => () => {
    if (form.imagePreview.startsWith('blob:')) URL.revokeObjectURL(form.imagePreview);
  }, [form.imagePreview]);

  function resetForm() { setForm(emptyForm); setEditingId(null); }

  function chooseImage(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
      setError('Escolha uma imagem JPG, PNG ou WebP de até 8 MB.');
      return;
    }
    setError(''); setNotice('');
    setForm(current => ({ ...current, imageFile: file, imagePreview: URL.createObjectURL(file) }));
  }

  async function submit(event) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const imageData = form.imageFile ? await optimizeBannerImage(form.imageFile) : form.imageData;
      const payload = { image_data: imageData, alt_text: form.altText.trim(), active: form.active };
      const { data } = editingId
        ? await api.patch(`/admin/announcements/${editingId}`, payload)
        : await api.post('/admin/announcements', payload);
      setItems(current => editingId ? current.map(item => item.id === data.id ? data : item) : [data, ...current]);
      setNotice(editingId ? 'Banner atualizado.' : 'Banner criado.');
      resetForm();
    } catch (err) { setError(err.response?.data?.error || err.message || 'Não foi possível salvar o banner.'); }
    finally { setSaving(false); }
  }

  function edit(item) {
    setEditingId(item.id);
    setForm({ imageFile: null, imagePreview: '', imageData: item.image_data, altText: item.alt_text, active: Boolean(item.active) });
    setError(''); setNotice('');
    document.getElementById('banner-alt-text')?.focus();
  }

  async function toggle(item) {
    setSaving(true); setError(''); setNotice('');
    try {
      const { data } = await api.patch(`/admin/announcements/${item.id}`, { active: !Boolean(item.active) });
      setItems(current => current.map(entry => entry.id === data.id ? data : entry));
      setNotice(data.active ? 'Banner ativado.' : 'Banner pausado.');
    } catch (err) { setError(err.response?.data?.error || 'Não foi possível alterar o banner.'); }
    finally { setSaving(false); }
  }

  async function remove(item) {
    if (!window.confirm('Excluir este banner de imagem?')) return;
    setSaving(true); setError(''); setNotice('');
    try {
      await api.delete(`/admin/announcements/${item.id}`);
      setItems(current => current.filter(entry => entry.id !== item.id));
      if (editingId === item.id) resetForm();
      setNotice('Banner excluído.');
    } catch (err) { setError(err.response?.data?.error || 'Não foi possível excluir o banner.'); }
    finally { setSaving(false); }
  }

  const preview = form.imagePreview || form.imageData;
  return <section className="announcement-manager" aria-labelledby="announcement-manager-title">
    <header className="announcement-manager-heading">
      <div><div className="eyebrow">VISÃO GERAL</div><h3 id="announcement-manager-title">Banners de imagem</h3><p>{items.length} de 4 banners cadastrados. Os ativos alternam automaticamente na Visão geral.</p></div>
    </header>
    {error && <div className="error-box" role="alert">{error}</div>}
    {notice && <div className="admin-notice" role="status">{notice}</div>}

    <form className="announcement-editor" onSubmit={submit}>
      <h4>{editingId ? 'Editar banner' : 'Adicionar banner de imagem'}</h4>
      <div className="announcement-image-preview">{preview ? <img src={preview} alt="Prévia do banner" /> : <span>A prévia da imagem aparecerá aqui</span>}</div>
      <div className="announcement-image-fields">
        <label className="announcement-image-upload">Escolher imagem<input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} disabled={saving} /></label>
        <small>JPG, PNG ou WebP · até 8 MB. A imagem será recortada para o formato do banner.</small>
        <label className="announcement-alt-label" htmlFor="banner-alt-text">Descrição acessível da imagem<input id="banner-alt-text" value={form.altText} maxLength="160" required placeholder="Descreva o conteúdo visual do banner" onChange={event => setForm(current => ({ ...current, altText: event.target.value }))} /></label>
        <label className="announcement-active-choice"><input type="checkbox" checked={form.active} onChange={event => setForm(current => ({ ...current, active: event.target.checked }))} /> Exibir na Visão geral</label>
        <div className="announcement-editor-actions"><button className="btn-primary-custom" disabled={saving || (!form.imageFile && !form.imageData) || (!editingId && items.length >= 4)}>{saving ? 'Salvando…' : editingId ? 'Salvar banner' : 'Adicionar banner'}</button>{editingId && <button type="button" className="btn-soft" disabled={saving} onClick={resetForm}>Cancelar</button>}</div>
      </div>
    </form>

    <div className="announcement-list" aria-label="Banners cadastrados">
      <div className="announcement-list-heading"><h4>Banners cadastrados</h4><span>Até 4 imagens</span></div>
      {loading ? <p>Carregando banners…</p> : !items.length ? <p className="announcement-empty">Nenhum banner cadastrado.</p> : items.map(item => <article className="announcement-admin-item" key={item.id}>
        <img className="announcement-admin-image" src={item.image_data} alt="" />
        <div className="announcement-admin-copy"><div className="announcement-admin-title"><span className={item.active ? 'announcement-status active' : 'announcement-status'}>{item.active ? 'Ativo' : 'Pausado'}</span></div><p>{item.alt_text}</p></div>
        <div className="announcement-admin-actions"><button type="button" disabled={saving} onClick={() => toggle(item)}>{item.active ? 'Pausar' : 'Ativar'}</button><button type="button" disabled={saving} onClick={() => edit(item)}>Editar</button><button type="button" className="danger" disabled={saving} onClick={() => remove(item)}>Excluir</button></div>
      </article>)}
    </div>
  </section>;
}
