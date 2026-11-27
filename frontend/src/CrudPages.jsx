import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { voiceLanguages } from './data/voiceLanguages.js';
import './crud.css';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api' });
api.interceptors.request.use(config => {
  const token = localStorage.getItem('ml-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function useResource(url) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = () => {
    setLoading(true);
    api.get(url).then(({ data }) => { setItems(data); setError(''); })
      .catch(err => setError(err.response?.data?.error || 'Não foi possível carregar os dados.'))
      .finally(() => setLoading(false));
  };
  useEffect(refresh, [url]);
  return { items, loading, error, refresh };
}

function Head({ kicker, title, desc, action }) {
  return <div className="page-head"><div><div className="eyebrow">{kicker}</div><h1>{title}</h1><p>{desc}</p></div>{action}</div>;
}

function Modal({ title, close, onSubmit, children }) {
  useEffect(() => {
    const onKeyDown = event => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [close]);
  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}>
    <form className="modal-card" role="dialog" aria-modal="true" aria-label={title} onSubmit={onSubmit}>
      <div className="modal-head"><h3>{title}</h3><button type="button" className="icon-button" aria-label="Fechar janela" onClick={close}>×</button></div>
      {children}
      <div className="modal-actions"><button type="button" className="btn-soft" onClick={close}>Cancelar</button><button className="btn-primary-custom">Salvar <span aria-hidden="true">→</span></button></div>
    </form>
  </div>;
}

function Field({ label, children }) { return <label className="modal-field">{label}{children}</label>; }
function Empty({ title, desc, action, label }) { return <div className="empty-state"><div className="empty-mark">✳</div><h2>{title}</h2><p>{desc}</p><button className="btn-soft" onClick={action}>{label} <span>→</span></button></div>; }
function Error({ children }) { return <div className="error-box page-error">{children}</div>; }
function IconAction({ label, onClick }) { return <button type="button" className="icon-button" aria-label={label} title={label} onClick={onClick}>{label === 'Excluir' ? '⌫' : '✎'}</button>; }
function confirmDelete(message) { return window.confirm(message); }

export function LanguagesPage({ notify }) {
  const { items, loading, error, refresh } = useResource('/languages');
  const [editing, setEditing] = useState(null);
  async function save(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = { name: form.get('name'), code: form.get('code'), level: form.get('level'), is_native: form.get('native') === 'on' };
    try {
      if (editing?.id) await api.put(`/languages/${editing.id}`, values); else await api.post('/languages', values);
      setEditing(null); refresh(); notify(editing?.id ? 'Idioma atualizado.' : 'Idioma adicionado à sua jornada.');
    } catch (err) { notify(err.response?.data?.error || 'Não foi possível salvar o idioma.'); }
  }
  async function remove(language) {
    if (!confirmDelete(`Excluir “${language.name}”? Os aprendizados associados serão mantidos.`)) return;
    try { await api.delete(`/languages/${language.id}`); refresh(); notify('Idioma removido.'); }
    catch (err) { notify(err.response?.data?.error || 'Não foi possível excluir o idioma.'); }
  }
  return <><Head kicker="SEU PRÓXIMO CAPÍTULO" title="Meus idiomas" desc="Acompanhe cada idioma no seu próprio ritmo." action={<button className="btn-primary-custom" onClick={() => setEditing({})}>＋ Adicionar idioma</button>}/>
    {error && <Error>{error}</Error>}
    <div className="language-grid">{items.map(lang => <article className="language-card" key={lang.id}>
      <div className="language-card-top"><span className="language-orb">{lang.name.slice(0, 2).toUpperCase()}</span><div className="crud-actions"><IconAction label="Editar" onClick={() => setEditing(lang)}/><IconAction label="Excluir" onClick={() => remove(lang)}/></div></div>
      <div className="language-level">{lang.is_native ? 'IDIOMA NATIVO' : lang.level.toUpperCase()}</div><h2>{lang.name}</h2><div className="language-progress"><span/><span/></div><div className="language-caption">Sua jornada está começando</div>
    </article>)}</div>
    {!loading && !items.length && <Empty title="Todo idioma começa com um olá" desc="Adicione um idioma para começar a construir sua jornada." action={() => setEditing({})} label="Adicionar idioma"/>}
    {editing && <Modal title={editing.id ? 'Editar idioma' : 'Adicionar idioma'} close={() => setEditing(null)} onSubmit={save}>
      <Field label="Idioma"><input name="name" className="form-control" required autoFocus defaultValue={editing.name || ''} placeholder="Ex.: Japonês"/></Field>
      <Field label="Voz para áudio (opcional)"><select name="code" className="form-select" defaultValue={editing.code || ''}><option value="">Detectar automaticamente</option>{voiceLanguages.map(voice => <option key={voice.code} value={voice.code}>{voice.label}</option>)}</select></Field>
      <Field label="Seu nível"><select className="form-select" name="level" defaultValue={editing.level || 'Iniciante'}>{['Iniciante','Básico','Intermediário','Avançado','Fluente'].map(level => <option key={level}>{level}</option>)}</select></Field>
      <label className="check-row"><input type="checkbox" name="native" defaultChecked={Boolean(editing.is_native)}/> Este é meu idioma nativo</label>
    </Modal>}
  </>;
}

export function LibraryPage({ notify }) {
  const { items, loading, error, refresh } = useResource('/learnings');
  const { items: languages } = useResource('/languages');
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const filtered = useMemo(() => items.filter(item => (!kindFilter || item.kind === kindFilter) && `${item.title} ${item.translation} ${item.language_name || ''}`.toLowerCase().includes(query.toLowerCase())), [items, query, kindFilter]);
  async function save(event) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const values = { title: form.get('title'), translation: form.get('translation'), pronunciation: form.get('pronunciation'), description: form.get('description'), example: form.get('example'), kind: form.get('kind'), language_id: form.get('language_id') || null };
    try {
      if (editing?.id) await api.patch(`/learnings/${editing.id}`, values); else await api.post('/learnings', values);
      setEditing(null); refresh(); notify(editing?.id ? 'Aprendizado atualizado.' : 'Aprendizado salvo na sua biblioteca.');
    } catch (err) { notify(err.response?.data?.error || 'Não foi possível salvar o aprendizado.'); }
  }
  async function remove(item) {
    if (!confirmDelete(`Excluir “${item.title}”?`)) return;
    try { await api.delete(`/learnings/${item.id}`); refresh(); notify('Aprendizado removido.'); }
    catch (err) { notify(err.response?.data?.error || 'Não foi possível excluir o aprendizado.'); }
  }
  return <><Head kicker="SEU CONHECIMENTO, BEM GUARDADO" title="Biblioteca" desc="Palavras, expressões e ideias que você quer levar com você." action={<button className="btn-primary-custom" onClick={() => setEditing({})}>＋ Novo aprendizado</button>}/>
    {error && <Error>{error}</Error>}
    <div className="library-tools"><div className="search-box"><span aria-hidden="true">⌕</span><input aria-label="Buscar na biblioteca" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar na biblioteca…"/></div><select className="filter-select" aria-label="Filtrar por tipo" value={kindFilter} onChange={event => setKindFilter(event.target.value)}><option value="">Todos os tipos</option>{['Palavra','Frase','Expressão','Verbo','Gramática','Anotação'].map(kind => <option key={kind}>{kind}</option>)}</select></div>
    <div className="library-meta">{filtered.length} {filtered.length === 1 ? 'aprendizado' : 'aprendizados'} <span>·</span> sua coleção pessoal</div>
    <div className="learning-list">{filtered.map(item => <article className="learning-card" key={item.id}>
      <div className="learning-main"><div className="learning-kind">{item.kind || 'PALAVRA'} {item.language_name && <><i/> {item.language_name.toUpperCase()}</>}</div><h3>{item.title}</h3><p>{item.translation || 'Sem tradução adicionada'}</p>{item.example && <div className="learning-example">“{item.example}”</div>}</div>
      <div className="crud-actions"><IconAction label="Editar" onClick={() => setEditing(item)}/><IconAction label="Excluir" onClick={() => remove(item)}/></div>
    </article>)}</div>
    {!loading && !filtered.length && <Empty title={query || kindFilter ? 'Nada encontrado' : 'Sua biblioteca está pronta'} desc={query || kindFilter ? 'Ajuste os filtros ou tente buscar outro termo.' : 'Guarde palavras, frases e expressões que queira lembrar.'} action={() => setEditing({})} label="Adicionar aprendizado"/>}
    {editing && <Modal title={editing.id ? 'Editar aprendizado' : 'Novo aprendizado'} close={() => setEditing(null)} onSubmit={save}>
      <Field label="Palavra ou expressão"><input name="title" className="form-control" required autoFocus defaultValue={editing.title || ''} placeholder="Ex.: serendipity"/></Field>
      <div className="form-row"><Field label="Tradução"><input name="translation" className="form-control" defaultValue={editing.translation || ''}/></Field><Field label="Idioma"><select name="language_id" className="form-select" defaultValue={editing.language_id || ''}><option value="">Sem idioma</option>{languages.map(lang => <option key={lang.id} value={lang.id}>{lang.name}</option>)}</select></Field></div>
      <Field label="Pronúncia"><input name="pronunciation" className="form-control" defaultValue={editing.pronunciation || ''}/></Field>
      <Field label="Descrição"><textarea name="description" className="form-control" rows="2" defaultValue={editing.description || ''}/></Field>
      <Field label="Exemplo de uso"><textarea name="example" className="form-control" rows="2" defaultValue={editing.example || ''}/></Field>
      <Field label="Tipo"><select className="form-select" name="kind" defaultValue={editing.kind || 'Palavra'}>{['Palavra','Frase','Expressão','Verbo','Gramática','Anotação'].map(kind => <option key={kind}>{kind}</option>)}</select></Field>
    </Modal>}
  </>;
}

export function CollectionsPage({ notify }) {
  const { items: collections, loading, error, refresh } = useResource('/collections');
  const { items: learnings } = useResource('/learnings');
  const [editing, setEditing] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [members, setMembers] = useState([]);
  const [memberId, setMemberId] = useState('');
  useEffect(() => {
    if (!activeId) { setMembers([]); return; }
    let current = true;
    setMembers([]);
    api.get(`/collections/${activeId}/items`).then(({ data }) => { if (current) setMembers(data); }).catch(err => { if (current) notify(err.response?.data?.error || 'Não foi possível abrir os itens.'); });
    return () => { current = false; };
  }, [activeId]);
  async function save(event) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const values = { name: form.get('name'), description: form.get('description') };
    try {
      if (editing?.id) await api.patch(`/collections/${editing.id}`, values); else await api.post('/collections', values);
      setEditing(null); refresh(); notify(editing?.id ? 'Coleção atualizada.' : 'Coleção criada.');
    } catch (err) { notify(err.response?.data?.error || 'Não foi possível salvar a coleção.'); }
  }
  async function remove(collection) {
    if (!confirmDelete(`Excluir a coleção “${collection.name}” e seus vínculos?`)) return;
    try { await api.delete(`/collections/${collection.id}`); if (activeId === collection.id) setActiveId(null); refresh(); notify('Coleção removida.'); }
    catch (err) { notify(err.response?.data?.error || 'Não foi possível excluir a coleção.'); }
  }
  async function addMember(event) {
    event.preventDefault(); if (!memberId || !activeId) return;
    try { await api.post(`/collections/${activeId}/items`, { learning_id: Number(memberId) }); const { data } = await api.get(`/collections/${activeId}/items`); setMembers(data); setMemberId(''); refresh(); notify('Aprendizado adicionado à coleção.'); }
    catch (err) { notify(err.response?.data?.error || 'Não foi possível adicionar o aprendizado.'); }
  }
  async function removeMember(item) {
    try { await api.delete(`/collections/${activeId}/items/${item.id}`); setMembers(members.filter(member => member.id !== item.id)); refresh(); notify('Aprendizado removido da coleção.'); }
    catch (err) { notify(err.response?.data?.error || 'Não foi possível remover o aprendizado.'); }
  }
  return <><Head kicker="ORGANIZE SEU APRENDIZADO" title="Coleções" desc="Reúna aprendizados por tema, momento ou curiosidade." action={<button className="btn-primary-custom" onClick={() => setEditing({})}>＋ Nova coleção</button>}/>
    {error && <Error>{error}</Error>}
    <div className="collection-grid">{collections.map((collection, index) => <article className="collection-card" key={collection.id}>
      <div className={`collection-cover cover-${index % 4}`}><span>{['✳','◉','⌁','✺'][index % 4]}</span><small>COLEÇÃO PESSOAL</small></div><h3>{collection.name}</h3><p>{collection.description || 'Uma coleção para suas descobertas.'}</p>
      <div className="collection-foot"><span>{collection.item_count || 0} itens</span><div className="crud-actions"><button className="text-link" onClick={() => { setActiveId(activeId === collection.id ? null : collection.id); setMemberId(''); }}>{activeId === collection.id ? 'Fechar itens' : 'Gerenciar itens'}</button><IconAction label="Editar" onClick={() => setEditing(collection)}/><IconAction label="Excluir" onClick={() => remove(collection)}/></div></div>
      {activeId === collection.id && <div className="collection-items"><form className="collection-add-form" onSubmit={addMember}><select className="form-select" aria-label="Aprendizado para adicionar" value={memberId} onChange={event => setMemberId(event.target.value)}><option value="">Escolha um aprendizado</option>{learnings.filter(item => !members.some(member => member.id === item.id)).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select><button className="btn-soft" disabled={!memberId}>Adicionar</button></form>{members.length ? members.map(item => <div className="collection-item" key={item.id}><span>{item.title}<small>{item.translation}</small></span><button className="text-link" onClick={() => removeMember(item)}>Remover</button></div>) : <p className="quiet-empty">Ainda não há aprendizados nesta coleção.</p>}</div>}
    </article>)}</div>
    {!loading && !collections.length && <Empty title="Uma ideia puxa a outra" desc="Crie coleções para organizar seus aprendizados por assunto." action={() => setEditing({})} label="Criar primeira coleção"/>}
    {editing && <Modal title={editing.id ? 'Editar coleção' : 'Nova coleção'} close={() => setEditing(null)} onSubmit={save}><Field label="Nome da coleção"><input name="name" className="form-control" required autoFocus defaultValue={editing.name || ''} placeholder="Ex.: Inglês para viagens"/></Field><Field label="Descrição"><textarea name="description" className="form-control" rows="3" defaultValue={editing.description || ''}/></Field></Modal>}
  </>;
}

export function FlashcardsPage({ notify }) {
  const navigate = useNavigate();
  const { items: cards, loading, error, refresh } = useResource('/flashcards');
  const { items: learnings } = useResource('/learnings');
  const { items: languages } = useResource('/languages');
  const [editing, setEditing] = useState(null);
  async function save(event) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const values = { front: form.get('front'), front_pronunciation: form.get('front_pronunciation'), back: form.get('back'), language_id: form.get('language_id') || null, learning_id: form.get('learning_id') || null };
    try {
      if (editing?.id) await api.patch(`/flashcards/${editing.id}`, values); else await api.post('/flashcards', values);
      setEditing(null); refresh(); notify(editing?.id ? 'Flashcard atualizado.' : 'Flashcard criado.');
    } catch (err) { notify(err.response?.data?.error || 'Não foi possível salvar o flashcard.'); }
  }
  async function remove(card) {
    if (!confirmDelete('Excluir este flashcard e seu histórico de revisões?')) return;
    try { await api.delete(`/flashcards/${card.id}`); refresh(); notify('Flashcard removido.'); }
    catch (err) { notify(err.response?.data?.error || 'Não foi possível excluir o flashcard.'); }
  }
  const due = cards.filter(card => new Date(card.due_at) <= new Date()).length;
  return <><Head kicker="MEMÓRIA EM MOVIMENTO" title="Flashcards" desc="Revisões inteligentes, no tempo certo para você." action={<button className="btn-primary-custom" onClick={() => setEditing({})}>＋ Criar flashcard</button>}/>
    {error && <Error>{error}</Error>}
    <div className="review-banner"><div><div className="eyebrow">SESSÃO DE HOJE</div><h2>{due ? 'Seus cartões estão prontos para revisão.' : 'Tudo em dia por agora.'}</h2><p>{due ? 'Cada revisão fortalece o que você já aprendeu.' : 'Crie um flashcard para começar a praticar.'}</p></div><button className="btn-primary-custom" onClick={() => navigate('/study')}>{due ? 'Começar revisão →' : 'Ver sessão de estudo'}</button></div>
    <div className="panel card-list-panel"><div className="panel-heading"><div><div className="eyebrow">SUA COLEÇÃO</div><h2>Todos os flashcards</h2></div></div>
      {cards.length ? cards.map(card => <div className="flashcard-row" key={card.id}><span className="flashcard-front"><small className="flashcard-pronunciation">{card.front_pronunciation}</small>{card.front}</span><span className="flashcard-arrow">→</span><span className="flashcard-back">{card.back}</span><span className={`due-badge ${new Date(card.due_at) <= new Date() ? 'is-due' : ''}`}>{new Date(card.due_at) <= new Date() ? 'Revisar' : 'Depois'}</span><span className="crud-actions"><IconAction label="Editar" onClick={() => setEditing(card)}/><IconAction label="Excluir" onClick={() => remove(card)}/></span></div>) : <div className="quiet-empty">Seus flashcards aparecerão aqui. Crie um cartão manualmente ou a partir de um aprendizado.</div>}
    </div>
    {!loading && !cards.length && <Empty title="Comece a praticar" desc="Crie cartões para revisar seus aprendizados no momento certo." action={() => setEditing({})} label="Criar flashcard"/>}
    {editing && <Modal title={editing.id ? 'Editar flashcard' : 'Criar flashcard'} close={() => setEditing(null)} onSubmit={save}><Field label="Idioma / áudio da frente"><select name="language_id" className="form-select" autoFocus defaultValue={editing.language_id || ''}><option value="">Detectar pelo aprendizado ou texto</option>{languages.map(language => <option key={language.id} value={language.id}>{language.name} {language.code ? `(${language.code})` : ''}</option>)}</select></Field><Field label="Pronúncia da frente (opcional)"><input name="front_pronunciation" className="form-control" maxLength="300" defaultValue={editing.front_pronunciation || ''} placeholder="Ex.: Kon'nichiwa"/></Field><Field label="Como se escreve (frente)"><input name="front" className="form-control" required maxLength="500" defaultValue={editing.front || ''} placeholder="Ex.: こんにちは"/></Field><Field label="Verso no idioma definido no perfil"><textarea name="back" className="form-control" required maxLength="2000" rows="3" defaultValue={editing.back || ''} placeholder="Ex.: Olá"/></Field><Field label="Vincular aprendizado (opcional)"><select name="learning_id" className="form-select" defaultValue={editing.learning_id || ''}><option value="">Nenhum</option>{learnings.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></Field></Modal>}
  </>;
}
