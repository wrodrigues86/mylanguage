import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './announcement-banner.css';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api' });
const exampleBanner = { id: 'example-fallback', image_data: `${import.meta.env.BASE_URL}banner-exemplo.jpg`, alt_text: 'Ilustração de um globo, um livro aberto e balões de conversa em tons de verde e creme.' };

export default function AnnouncementBanner() {
  const [items, setItems] = useState([exampleBanner]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let current = true;
    api.get('/announcements').then(({ data }) => { if (current) setItems(Array.isArray(data) ? data : [exampleBanner]); }).catch(() => {});
    return () => { current = false; };
  }, []);

  useEffect(() => {
    if (items.length < 2 || paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = window.setInterval(() => setIndex(value => (value + 1) % items.length), 7000);
    return () => window.clearInterval(timer);
  }, [items.length, paused]);

  useEffect(() => { if (index >= items.length) setIndex(0); }, [index, items.length]);

  if (!items.length) return null;
  const item = items[index];
  const move = direction => setIndex(value => (value + direction + items.length) % items.length);

  return <section className="announcement-banner" aria-label={`Banner da plataforma: ${item.alt_text}`} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}>
    <img className="announcement-banner-image" key={item.id} src={item.image_data} alt={item.alt_text} />
    {items.length > 1 && <div className="announcement-banner-controls" aria-label="Navegação dos banners">
      <div className="announcement-banner-arrows"><button type="button" onClick={() => move(-1)} aria-label="Imagem anterior"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12 4-6 6 6 6"/></svg></button><button type="button" onClick={() => move(1)} aria-label="Próxima imagem"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m8 4 6 6-6 6"/></svg></button></div>
      <div className="announcement-banner-dots">{items.map((entry, dotIndex) => <button type="button" key={entry.id} aria-label={`Mostrar imagem ${dotIndex + 1}`} aria-current={dotIndex === index ? 'true' : undefined} onClick={() => setIndex(dotIndex)} />)}</div>
    </div>}
  </section>;
}
