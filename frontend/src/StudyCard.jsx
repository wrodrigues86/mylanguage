import React from 'react';
import './study-card.css';

function languageLabel(locale) {
  try { return new Intl.DisplayNames(['pt-BR'], { type: 'language' }).of(locale) || locale; }
  catch { return locale; }
}

export default function StudyCard({ card, revealed, audioEnabled, audioPlaying, speechRate, setSpeechRate, speak, stopSpeech, userLanguage }) {
  const userLanguageName = languageLabel(userLanguage);
  return <article className="study-card" aria-live="polite">
    <div className="study-card-top"><span>{revealed ? 'RESPOSTA' : 'FRENTE DO CARTÃO'}</span><span>{card.learning_title ? 'BIBLIOTECA' : 'FLASHCARD'}</span></div>
    <div className={`study-card-content ${revealed ? 'is-revealed' : ''}`}>
      {!revealed ? <section className="study-face study-front-face" aria-label="Frente do cartão">
        {card.front_pronunciation && <p className="study-pronunciation">{card.front_pronunciation}</p>}
        <p className="study-prompt">{card.front}</p>
        {audioEnabled && <button className="study-audio" aria-label="Ouvir a frente no idioma do cartão" onClick={() => speak(card.front, card.language_code, true)}><span aria-hidden="true">◖))</span> Ouvir frente</button>}
      </section> : <>
        <section className="study-face study-front-face" aria-label="Frente do cartão">
          <div className="study-face-label">FRENTE · {card.language_name || card.language_code || 'IDIOMA DO CARTÃO'}</div>
          {card.front_pronunciation && <p className="study-pronunciation">{card.front_pronunciation}</p>}
          <p className="study-prompt">{card.front}</p>
          {audioEnabled && <button className="study-audio" aria-label="Ouvir a frente no idioma do cartão" onClick={() => speak(card.front, card.language_code, true)}><span aria-hidden="true">◖))</span> Ouvir frente</button>}
          {card.learning_example && <div className="study-example-wrap"><p className="study-example">“{card.learning_example}”</p>{audioEnabled && <button className="study-audio" onClick={() => speak(card.learning_example, card.language_code, true)}><span aria-hidden="true">◖))</span> Ouvir exemplo</button>}</div>}
        </section>
        <section className="study-face study-back-face" aria-label="Verso do cartão">
          <div className="study-face-label">VERSO · {userLanguageName}</div>
          <p className="study-prompt">{card.back}</p>
          {audioEnabled && <button className="study-audio" aria-label="Ouvir o verso no idioma do usuário" onClick={() => speak(card.back, userLanguage)}><span aria-hidden="true">◖))</span> Ouvir verso</button>}
        </section>
      </>}
    </div>
    {audioEnabled ? <div className="study-audio-row">
      <div className="study-audio-buttons">{audioPlaying && <button className="study-audio study-audio-stop" onClick={stopSpeech}>Parar áudio</button>}</div>
      <label className="study-speed-control" htmlFor="study-speed"><span>Velocidade do áudio</span><input id="study-speed" type="range" min="0.55" max="1.25" step="0.05" value={speechRate} onChange={event => setSpeechRate(Number(event.target.value))}/><output htmlFor="study-speed">{speechRate.toFixed(2)}×</output></label>
    </div> : <p className="study-audio-disabled">O áudio está desativado nas configurações da aplicação.</p>}
  </article>;
}
