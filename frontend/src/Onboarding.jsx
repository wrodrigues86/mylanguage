import React, { useState } from 'react';
import axios from 'axios';
import { voiceLanguages } from './data/voiceLanguages.js';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api' });
api.interceptors.request.use(config => {
  const token = localStorage.getItem('ml-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const steps = ['Boas-vindas', 'Seu idioma', 'Primeiro aprendizado', 'Seu primeiro cartão'];

export default function Onboarding({ userName, onComplete, siteName = 'MyLingua' }) {
  const [step, setStep] = useState(0);
  const [language, setLanguage] = useState(null);
  const [learning, setLearning] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submitLanguage(event) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    try {
      const { data } = await api.post('/languages', { name: form.get('name'), code: form.get('code'), level: form.get('level') });
      setLanguage(data); setStep(2);
    } catch (err) { setError(err.response?.data?.error || 'Não foi possível salvar o idioma.'); }
    finally { setBusy(false); }
  }

  async function submitLearning(event) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    const payload = { title: form.get('title'), translation: form.get('translation'), pronunciation: form.get('pronunciation'), example: form.get('example'), language_id: language?.id || null };
    try {
      const { data } = await api.post('/learnings', payload);
      setLearning(data); setStep(3);
    } catch (err) { setError(err.response?.data?.error || 'Não foi possível salvar o aprendizado.'); }
    finally { setBusy(false); }
  }

  async function createCard() {
    if (!learning?.translation) { onComplete(); return; }
    setBusy(true); setError('');
    try {
      await api.post('/flashcards', { front: learning.title, front_pronunciation: learning.pronunciation, back: learning.translation, learning_id: learning.id });
      onComplete();
    } catch (err) { setError(err.response?.data?.error || 'Não foi possível criar o flashcard.'); }
    finally { setBusy(false); }
  }

  return <main className="onboarding-page">
    <a className="skip-link" href="#onboarding-content">Pular para configuração</a>
    <header className="onboarding-header"><a className="brand" href="/"><span className="brand-mark" aria-hidden="true">{Array.from(siteName.trim())[0]?.toLowerCase() || 'm'}</span><span>{siteName}<span className="brand-period">.</span></span></a><button className="onboarding-skip" onClick={onComplete}>Configurar depois</button></header>
    <section id="onboarding-content" className="onboarding-card" aria-labelledby="onboarding-title" tabIndex="-1">
      <div className="onboarding-progress" aria-label={`Etapa ${step + 1} de ${steps.length}`} aria-live="polite">
        {steps.map((label, index) => <div className={`onboarding-progress-step ${index <= step ? 'is-active' : ''}`} key={label}><span aria-hidden="true">{index < step ? '✓' : index + 1}</span><small>{label}</small></div>)}
      </div>
      {error && <div className="error-box onboarding-error" role="alert">{error}</div>}
      {step === 0 && <div className="onboarding-body">
        <div className="onboarding-symbol" aria-hidden="true">✳</div><div className="eyebrow">SUA JORNADA COMEÇA AQUI</div>
        <h1 id="onboarding-title">Vamos preparar seu espaço{userName ? `, ${userName}` : ''}.</h1>
        <p>Em poucos passos, você terá um idioma, uma primeira descoberta salva e um cartão pronto para revisar.</p>
        <ol className="onboarding-intro-list"><li><span>01</span><div><strong>Escolha um idioma</strong><small>Defina o que quer aprender agora.</small></div></li><li><span>02</span><div><strong>Guarde uma descoberta</strong><small>Uma palavra ou expressão já é suficiente.</small></div></li><li><span>03</span><div><strong>Pratique quando quiser</strong><small>Transforme o aprendizado em flashcard.</small></div></li></ol>
        <button className="btn-primary-custom onboarding-primary" onClick={() => setStep(1)}>Começar configuração <span aria-hidden="true">→</span></button>
      </div>}
      {step === 1 && <form className="onboarding-body" onSubmit={submitLanguage}>
        <div className="eyebrow">ETAPA 1 · SEU IDIOMA</div><h1 id="onboarding-title">O que você quer aprender?</h1><p>Você pode adicionar outros idiomas depois.</p>
        <label className="onboarding-field">Idioma<input className="form-control" name="name" autoFocus required minLength="2" placeholder="Ex.: Inglês, Japonês, Espanhol"/></label>
        <label className="onboarding-field">Voz para áudio <span className="optional-label">Opcional</span><select className="form-select" name="code" defaultValue=""><option value="">Detectar automaticamente</option>{voiceLanguages.map(voice => <option key={voice.code} value={voice.code}>{voice.label}</option>)}</select><span className="onboarding-field-help">Escolha a pronúncia usada ao ouvir seus cartões.</span></label>
        <label className="onboarding-field">Seu nível<select className="form-select" name="level" defaultValue="Iniciante">{['Iniciante','Básico','Intermediário','Avançado','Fluente'].map(level => <option key={level}>{level}</option>)}</select></label>
        <div className="onboarding-actions"><button type="button" className="btn-soft" onClick={() => setStep(0)}>Voltar</button><button className="btn-primary-custom" disabled={busy}>{busy ? 'Salvando…' : 'Salvar e continuar'} <span aria-hidden="true">→</span></button></div>
      </form>}
      {step === 2 && <form className="onboarding-body" onSubmit={submitLearning}>
        <div className="eyebrow">ETAPA 2 · PRIMEIRA DESCOBERTA</div><h1 id="onboarding-title">O que você quer lembrar?</h1><p>Comece com uma palavra, frase ou expressão em {language?.name}.</p>
        <label className="onboarding-field">Palavra ou expressão<input className="form-control" name="title" autoFocus required placeholder="Ex.: uma palavra que aprendeu hoje"/></label>
        <label className="onboarding-field">Pronúncia <span className="optional-label">Opcional</span><input className="form-control" name="pronunciation" placeholder="Ex.: Kon'nichiwa"/></label>
        <label className="onboarding-field">Tradução ou significado<input className="form-control" name="translation" placeholder="O que significa?"/></label>
        <label className="onboarding-field">Exemplo de uso <span className="optional-label">Opcional</span><textarea className="form-control" name="example" rows="2" placeholder="Uma frase para ajudar a lembrar"/></label>
        <div className="onboarding-actions"><button type="button" className="btn-soft" onClick={() => setStep(1)}>Voltar</button><button className="btn-primary-custom" disabled={busy}>{busy ? 'Salvando…' : 'Salvar aprendizado'} <span aria-hidden="true">→</span></button></div>
      </form>}
      {step === 3 && <div className="onboarding-body">
        <div className="eyebrow">ETAPA 3 · REVISÃO</div><h1 id="onboarding-title">Seu primeiro cartão está quase pronto.</h1><p>Use a palavra como pergunta e a tradução como resposta. Você poderá revisar este cartão na área de Flashcards.</p>
        <div className="onboarding-preview"><span>FRENTE</span><strong>{learning?.title}</strong><i aria-hidden="true">↓</i><span>VERSO</span><strong>{learning?.translation || 'Adicione uma tradução depois'}</strong></div>
        {!learning?.translation && <p className="onboarding-note">Como não há tradução, você pode criar este cartão mais tarde na biblioteca.</p>}
        <div className="onboarding-actions"><button className="btn-soft" onClick={onComplete}>Fazer isso depois</button><button className="btn-primary-custom" onClick={createCard} disabled={busy}>{busy ? 'Criando…' : learning?.translation ? 'Criar cartão e finalizar' : 'Finalizar configuração'} <span aria-hidden="true">→</span></button></div>
      </div>}
      <div className="onboarding-privacy"><span aria-hidden="true">⌑</span> Seus dados ficam privados na sua conta.</div>
    </section>
  </main>;
}
