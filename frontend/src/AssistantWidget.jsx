import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api' });
api.interceptors.request.use(config => {
  const token = localStorage.getItem('ml-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function inlineFormatting(text) {
  return text.split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`)/g).map((part, index) => {
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
    return part;
  });
}
function formattedText(text) {
  const blocks = []; let paragraph = [], list = null;
  const flushParagraph = () => { if (paragraph.length) { blocks.push({ type: 'paragraph', lines: paragraph }); paragraph = []; } };
  const flushList = () => { if (list) { blocks.push(list); list = null; } };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim(), item = line.match(/^[-*]\s+(.+)$/) || line.match(/^\d+[.)]\s+(.+)$/);
    if (item) { flushParagraph(); const type = /^\d/.test(line) ? 'ol' : 'ul'; if (list && list.type !== type) flushList(); if (!list) list = { type, items: [] }; list.items.push(item[1]); }
    else if (!line) { flushParagraph(); flushList(); }
    else { flushList(); paragraph.push(line); }
  }
  flushParagraph(); flushList();
  return blocks.map((block, index) => block.type === 'paragraph'
    ? <p key={index}>{block.lines.map((line, lineIndex) => <React.Fragment key={lineIndex}>{lineIndex > 0 && <br/>}{inlineFormatting(line)}</React.Fragment>)}</p>
    : React.createElement(block.type, { key: index }, block.items.map((item, itemIndex) => <li key={itemIndex}>{inlineFormatting(item)}</li>)));
}

export default function AssistantWidget() {
  const [config, setConfig] = useState(null), [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]), [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [cardMode, setCardMode] = useState(false), [languages, setLanguages] = useState([]);
  const [languageId, setLanguageId] = useState(''), [topic, setTopic] = useState(''), [cardCount, setCardCount] = useState(5);
  const [generatedCards, setGeneratedCards] = useState([]), [selectedCards, setSelectedCards] = useState([]);
  const [cardBusy, setCardBusy] = useState(false), [cardError, setCardError] = useState(''), [cardNotice, setCardNotice] = useState('');
  const listRef = useRef(null), inputRef = useRef(null);

  useEffect(() => {
    let current = true;
    const refresh = () => api.get('/assistant/config').then(({ data }) => { if (current) setConfig(data); }).catch(() => { if (current) setConfig({ enabled: false }); });
    refresh(); const timer = setInterval(refresh, 30000);
    return () => { current = false; clearInterval(timer); };
  }, []);
  useEffect(() => { if (open && !cardMode) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, open, busy, cardMode]);
  useEffect(() => { if (open && !cardMode) inputRef.current?.focus(); }, [open, cardMode]);
  if (!config?.enabled) return null;

  function showChat() {
    if (!messages.length) setMessages([{ role: 'assistant', content: config.welcomeMessage || `Ola! Sou ${config.name}. Como posso ajudar?` }]);
    setOpen(true); setCardMode(false);
  }
  async function openCardMode() {
    setCardMode(true); setCardError(''); setCardNotice(''); setGeneratedCards([]); setSelectedCards([]);
    try {
      const { data } = await api.get('/languages'); setLanguages(data);
      if (data.length && !data.some(item => String(item.id) === String(languageId))) setLanguageId(String(data[0].id));
    } catch (err) { setCardError(err.response?.data?.error || 'Nao foi possivel carregar seus idiomas.'); }
  }
  async function send(event) {
    event?.preventDefault(); const text = draft.trim(); if (!text || busy) return;
    const next = [...messages, { role: 'user', content: text }].slice(-20);
    setMessages(next); setDraft(''); setBusy(true); setError('');
    try { const { data } = await api.post('/assistant/chat', { messages: next }); setMessages(current => [...current, { role: 'assistant', content: data.reply }].slice(-20)); }
    catch (err) { setError(err.response?.data?.error || 'Nao foi possivel obter uma resposta. Tente novamente.'); }
    finally { setBusy(false); }
  }
  async function generateCards(event) {
    event.preventDefault(); if (!languageId || !topic.trim() || cardBusy) return;
    setCardBusy(true); setCardError(''); setCardNotice(''); setGeneratedCards([]); setSelectedCards([]);
    try {
      const { data } = await api.post('/assistant/cards', { languageId: Number(languageId), topic: topic.trim(), count: Number(cardCount) });
      setGeneratedCards(data.cards); setSelectedCards(data.cards.map((_, index) => index));
    } catch (err) { setCardError(err.response?.data?.error || 'Nao foi possivel gerar os cards.'); }
    finally { setCardBusy(false); }
  }
  async function saveGeneratedCards() {
    const cards = selectedCards.map(index => generatedCards[index]).filter(Boolean); if (!cards.length || cardBusy) return;
    setCardBusy(true); setCardError('');
    try {
      const { data } = await api.post('/flashcards/bulk', { language_id: Number(languageId), cards });
      setCardNotice(`${data.created} ${data.created === 1 ? 'card salvo' : 'cards salvos'} para estudo.`);
      setGeneratedCards([]); setSelectedCards([]); setTopic('');
    } catch (err) { setCardError(err.response?.data?.error || 'Nao foi possivel salvar os cards.'); }
    finally { setCardBusy(false); }
  }

  return <>
    {open && <section className="assistant-chat" role="dialog" aria-label={`Conversa com ${config.name}`}>
      <header className="assistant-chat-header"><div><span className="assistant-chat-mark" aria-hidden="true">✦</span><span><strong>{config.name}</strong><small>Seu assistente de idiomas</small></span></div><div className="assistant-header-actions">{cardMode ? <button type="button" className="assistant-mode-toggle" onClick={() => { setCardMode(false); setCardError(''); }}>Voltar ao chat</button> : <button type="button" className="assistant-mode-toggle" onClick={openCardMode}>Criar cards</button>}<button type="button" onClick={() => setOpen(false)} aria-label="Fechar assistente">×</button></div></header>
      {cardMode ? <div className="assistant-card-maker">
        <p className="assistant-card-intro">Escolha um idioma e tema. Revise as sugestoes antes de salvar.</p>
        {!languages.length ? <div className="assistant-no-languages">{cardError || 'Adicione um idioma para criar cards.'}<Link to="/languages" onClick={() => setOpen(false)}>Adicionar idioma</Link></div> : <form className="assistant-card-form" onSubmit={generateCards}>
          <label>Idioma<select value={languageId} onChange={event => setLanguageId(event.target.value)} required><option value="">Selecione</option>{languages.map(language => <option key={language.id} value={language.id}>{language.name}</option>)}</select></label>
          <label>Tema<textarea rows="2" maxLength="200" value={topic} onChange={event => setTopic(event.target.value)} placeholder="Ex.: pedir comida em um restaurante" required /></label>
          <label>Quantidade<select value={cardCount} onChange={event => setCardCount(Number(event.target.value))}>{[3, 5, 8, 10].map(count => <option key={count} value={count}>{count} cards</option>)}</select></label>
          <button className="assistant-card-primary" type="submit" disabled={cardBusy || !languageId || !topic.trim()}>{cardBusy ? 'Aguarde...' : 'Gerar pre-visualizacao'}</button>
        </form>}
        {cardError && <p className="assistant-chat-error" role="alert">{cardError}</p>}{cardNotice && <p className="assistant-card-notice" role="status">{cardNotice}</p>}
        {!!generatedCards.length && <><div className="assistant-card-preview">{generatedCards.map((card, index) => <label className="assistant-card-preview-item" key={`${index}-${card.front}`}><input type="checkbox" checked={selectedCards.includes(index)} onChange={event => setSelectedCards(current => event.target.checked ? [...current, index] : current.filter(item => item !== index))} /><span><strong>{card.front}</strong><small>{card.back}</small></span></label>)}</div><button className="assistant-card-primary" type="button" onClick={saveGeneratedCards} disabled={cardBusy || !selectedCards.length}>{cardBusy ? 'Salvando...' : `Salvar ${selectedCards.length} ${selectedCards.length === 1 ? 'card' : 'cards'}`}</button></>}
        <div className="assistant-chat-foot">Confira o conteudo antes de adicionar a sua revisao.</div>
      </div> : <><div className="assistant-chat-messages" ref={listRef} aria-live="polite">{messages.map((message, index) => <div key={`${index}-${message.role}`} className={`assistant-message ${message.role}`}><div className="assistant-message-content">{message.role === 'assistant' ? formattedText(message.content) : message.content}</div></div>)}{busy && <div className="assistant-message assistant"><span className="assistant-typing" aria-label="Assistente digitando"><i/><i/><i/></span></div>}</div>
        {error && <p className="assistant-chat-error" role="alert">{error}</p>}
        <form className="assistant-chat-form" onSubmit={send}><label className="visually-hidden" htmlFor="assistant-message-input">Sua mensagem</label><textarea id="assistant-message-input" ref={inputRef} rows="2" maxLength="2000" value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(event); } }} placeholder="Escreva sua duvida..."/><button type="submit" aria-label="Enviar mensagem" disabled={busy || !draft.trim()}>↑</button></form>
        <div className="assistant-chat-foot">Respostas geradas por IA podem conter erros.</div></>}
    </section>}
    <button className="assistant-launcher" type="button" aria-expanded={open} aria-label={open ? 'Fechar assistente' : `Abrir assistente ${config.name}`} onClick={open ? () => setOpen(false) : showChat}><span aria-hidden="true">{open ? '×' : '✦'}</span>{!open && <span className="assistant-launcher-label">{config.name}</span>}</button>
  </>;
}
