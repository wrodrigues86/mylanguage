import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import StudyCard from './StudyCard.jsx';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api' });
api.interceptors.request.use(config => {
  const token = localStorage.getItem('ml-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const voiceByLanguage = { ingles:'en-US', english:'en-US', japones:'ja-JP', japanese:'ja-JP', espanhol:'es-ES', spanish:'es-ES', frances:'fr-FR', french:'fr-FR', alemao:'de-DE', german:'de-DE', italiano:'it-IT', italian:'it-IT', coreano:'ko-KR', korean:'ko-KR', chines:'zh-CN', chinese:'zh-CN', portugues:'pt-BR', português:'pt-BR' };
function dueTime(value) { return new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`).getTime(); }
function intervalText(days) { return days === 1 ? '1 dia' : `${days} dias`; }
function languageForText(text, fallback) {
  if (/[\u3040-\u30ff]/.test(text)) return 'ja-JP';
  if (/[\uac00-\ud7af]/.test(text)) return 'ko-KR';
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh-CN';
  if (/[\u0400-\u04ff]/.test(text)) return 'ru-RU';
  if (/[\u0600-\u06ff]/.test(text)) return 'ar-SA';
  return fallback || 'pt-BR';
}

export default function Study() {
  const [cards, setCards] = useState([]), [languages, setLanguages] = useState([]);
  const [userLanguage, setUserLanguage] = useState(() => navigator.language || 'pt-BR');
  const [selectedLanguageId, setSelectedLanguageId] = useState(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [dailyProgress, setDailyProgress] = useState({ dailyLimit: 0, todayReviewed: 0, remaining: null });
  const [sessionTotal, setSessionTotal] = useState(0), [reviewedCount, setReviewedCount] = useState(0);
  const [revealed, setRevealed] = useState(false), [saving, setSaving] = useState(false), [message, setMessage] = useState('');
  const [speechRate, setSpeechRate] = useState(0.85), [audioPlaying, setAudioPlaying] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api.get('/flashcards'), api.get('/languages'), api.get('/settings/public'), api.get('/study/progress'), api.get('/me')])
      .then(([cardResult, languageResult, settingsResult, progressResult, profileResult]) => { setCards(cardResult.data); setLanguages(languageResult.data); setAudioEnabled(settingsResult.data.studyAudioEnabled); setDailyProgress(progressResult.data); setUserLanguage(profileResult.data.preferred_language || navigator.language || 'pt-BR'); })
      .catch(err => setError(err.response?.data?.error || 'Não foi possível carregar os dados de estudo.'))
      .finally(() => setLoading(false));
    return () => window.speechSynthesis?.cancel();
  }, []);

  const selectedCards = useMemo(() => {
    if (selectedLanguageId === 'unassigned') return cards.filter(card => !card.language_id);
    if (selectedLanguageId === null) return [];
    return cards.filter(card => String(card.language_id) === String(selectedLanguageId));
  }, [cards, selectedLanguageId]);
  const dueCards = useMemo(() => { const due = selectedCards.filter(card => dueTime(card.due_at) <= Date.now()); return dailyProgress.remaining === null ? due : due.slice(0, dailyProgress.remaining); }, [selectedCards, dailyProgress.remaining]);
  const card = dueCards[0];
  const selectedLanguage = languages.find(language => String(language.id) === String(selectedLanguageId));
  const selectedName = selectedLanguageId === 'unassigned' ? 'Sem idioma' : selectedLanguage?.name;

  function dueCountFor(languageId) {
    return cards.filter(card => (languageId === 'unassigned' ? !card.language_id : String(card.language_id) === String(languageId)) && dueTime(card.due_at) <= Date.now()).length;
  }
  function totalCountFor(languageId) {
    return cards.filter(card => languageId === 'unassigned' ? !card.language_id : String(card.language_id) === String(languageId)).length;
  }
  function startSession(languageId) {
    setSelectedLanguageId(languageId);
    setSessionTotal(dailyProgress.remaining === null ? dueCountFor(languageId) : Math.min(dueCountFor(languageId), dailyProgress.remaining));
    setReviewedCount(0); setRevealed(false); setError(''); setMessage('');
  }
  function chooseAnotherLanguage() {
    window.speechSynthesis?.cancel();
    setSelectedLanguageId(null); setSessionTotal(0); setReviewedCount(0); setRevealed(false); setMessage('');
  }

  useEffect(() => {
    function onKeyDown(event) {
      if (event.target.matches('input,textarea,select,[contenteditable="true"]')) return;
      if (event.code === 'Space' && card && !revealed) { event.preventDefault(); setRevealed(true); }
      if (!revealed) return;
      const rating = { '1':0, '2':3, '3':4, '4':5 }[event.key];
      if (rating !== undefined && card && !saving) { event.preventDefault(); review(rating); }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [card, revealed, saving]);

  function speak(text, preferredLanguage, detectScript = false) {
    if (!audioEnabled || !text?.trim()) return;
    if (!('speechSynthesis' in window)) { setMessage('A reprodução de voz não está disponível neste navegador.'); return; }
    window.speechSynthesis.cancel();
    setAudioPlaying(false);
    const utterance = new SpeechSynthesisUtterance(text);
    const name = (card?.language_name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const targetLanguage = card?.language_code || voiceByLanguage[name] || navigator.language || 'pt-BR';
    utterance.lang = detectScript ? languageForText(text, preferredLanguage || targetLanguage) : preferredLanguage || targetLanguage;
    utterance.rate = speechRate;
    utterance.onstart = () => setAudioPlaying(true);
    utterance.onend = () => setAudioPlaying(false);
    utterance.onerror = () => setAudioPlaying(false);
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeech() { window.speechSynthesis?.cancel(); setAudioPlaying(false); }

  async function review(quality) {
    if (!card || saving) return;
    setSaving(true); setError('');
    try {
      const {data} = await api.post(`/flashcards/${card.id}/review`, { quality });
      setMessage(`Próxima revisão em ${intervalText(data.interval)}.`);
      setCards(current => current.filter(item => item.id !== card.id));
      setReviewedCount(current => current + 1);
      setDailyProgress(current => ({...current, todayReviewed: current.todayReviewed + 1, remaining: current.remaining === null ? null : Math.max(0, current.remaining - 1)}));
      setRevealed(false); stopSpeech();
    } catch (err) { setError(err.response?.data?.error || 'Não foi possível registrar a revisão.'); }
    finally { setSaving(false); }
  }

  return <div className="study-page">
    <header className="study-topbar"><Link to="/cards" className="study-back"><span aria-hidden="true">←</span> Flashcards</Link><span className="study-session-label">SESSÃO DE ESTUDO</span>{selectedLanguageId !== null && <button className="study-exit" onClick={chooseAnotherLanguage}>Trocar idioma</button>}</header>
    {error && <div className="error-box study-error" role="alert">{error}</div>}
    {message && <div className="study-live" role="status" aria-live="polite">{message}<button aria-label="Fechar aviso" onClick={() => setMessage('')}>×</button></div>}
    {loading ? <div className="study-empty"><div className="study-spinner" aria-hidden="true"/><h1>Preparando sua sessão…</h1></div> : selectedLanguageId === null ? <main className="language-picker" aria-labelledby="study-title">
      <div className="eyebrow">UMA SESSÃO, UM IDIOMA</div><h1 id="study-title">O que vamos estudar agora?</h1><p>Escolha um idioma para esta sessão. Seus cartões de outros idiomas ficam separados.</p>
      {languages.length ? <div className="study-language-list">{languages.map(language => <button key={language.id} className="study-language-option" onClick={() => startSession(language.id)}><span className="study-language-mark" aria-hidden="true">{language.name.slice(0,2).toUpperCase()}</span><span className="study-language-copy"><strong>{language.name}</strong><small>{totalCountFor(language.id)} {totalCountFor(language.id) === 1 ? 'cartão' : 'cartões'}</small></span><span className="study-due-count">{dueCountFor(language.id)} para revisar</span><span className="study-option-arrow" aria-hidden="true">→</span></button>)}</div> : <div className="study-no-languages"><p>Adicione um idioma antes de começar uma sessão de estudo.</p><Link className="btn-primary-custom" to="/languages">Adicionar idioma <span aria-hidden="true">→</span></Link></div>}
      {cards.some(item => !item.language_id) && <button className="study-language-option study-unassigned" onClick={() => startSession('unassigned')}><span className="study-language-mark" aria-hidden="true">—</span><span className="study-language-copy"><strong>Sem idioma</strong><small>{totalCountFor('unassigned')} cartões sem idioma associado</small></span><span className="study-due-count">{dueCountFor('unassigned')} para revisar</span><span className="study-option-arrow" aria-hidden="true">→</span></button>}
    </main> : card ? <main className="study-content" aria-labelledby="study-title">
      <div className="study-progress-head"><div><div className="eyebrow">SESSÃO DE {selectedName?.toUpperCase()}</div><h1 id="study-title">Hora de lembrar.</h1></div><div className="study-count"><strong>{reviewedCount + 1}</strong><span> / {sessionTotal}</span></div></div>
      <div className="study-progress-track" role="progressbar" aria-label={`Progresso da sessão de ${selectedName}`} aria-valuemin="0" aria-valuemax={sessionTotal} aria-valuenow={reviewedCount}><span style={{width:`${sessionTotal ? (reviewedCount/sessionTotal)*100 : 0}%`}}/></div>
    <StudyCard card={card} revealed={revealed} audioEnabled={audioEnabled} audioPlaying={audioPlaying} speechRate={speechRate} setSpeechRate={setSpeechRate} speak={speak} stopSpeech={stopSpeech} userLanguage={userLanguage}/> 
      {!revealed ? <button className="btn-primary-custom study-reveal" onClick={() => setRevealed(true)}>Revelar resposta <span aria-hidden="true">↓</span></button> : <section className="study-rating" aria-label="Avalie a dificuldade deste cartão"><h2>Como foi?</h2><p>Seu intervalo será ajustado com base nesta resposta.</p><div className="study-rating-grid">{[['Errei',0,'1 dia','rating-again','1'],['Difícil',3,'curto','rating-hard','2'],['Bom',4,'intervalo normal','rating-good','3'],['Fácil',5,'intervalo maior','rating-easy','4']].map(([label,quality,hint,tone,key])=><button key={label} className={`study-rating-button ${tone}`} onClick={() => review(Number(quality))} disabled={saving}><strong>{label}</strong><small>{hint}</small><kbd>{key}</kbd></button>)}</div></section>}
      <div className="study-help">A repetição espaçada usa suas respostas para escolher quando mostrar cada cartão novamente. Atalhos: espaço revela; 1 a 4 avaliam.</div>
    </main> : <main className="study-empty" aria-labelledby="study-title"><div className="study-empty-mark" aria-hidden="true">✳</div><div className="eyebrow">{reviewedCount ? 'SESSÃO CONCLUÍDA' : 'SEU ESTUDO'}</div><h1 id="study-title">{dailyProgress.remaining === 0 ? 'Limite diario atingido.' : reviewedCount ? 'Sessao concluida.' : selectedCards.length ? 'Tudo em dia por agora.' : 'Nenhum cartao neste idioma ainda.'}</h1><p>{dailyProgress.remaining === 0 ? 'Voce chegou ao limite diario de revisoes. Ele sera renovado amanha.' : reviewedCount ? 'Os intervalos foram atualizados. Você revisou apenas cartões de ' + selectedName + '.' : selectedCards.length ? `Os próximos cartões de ${selectedName} aparecerão aqui quando chegar a hora de revisar.` : `Crie ou associe flashcards a ${selectedName} para estudar este idioma.`}</p><div className="study-empty-actions"><button className="btn-soft" onClick={chooseAnotherLanguage}>Escolher outro idioma</button><Link to="/cards" className="btn-primary-custom">Ver flashcards <span aria-hidden="true">→</span></Link><Link to="/library" className="btn-soft">Abrir biblioteca</Link></div></main>}
  </div>;
}
