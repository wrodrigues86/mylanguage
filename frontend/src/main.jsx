import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles.css';
import './mobile.css';
import './type-scale.css';
import './accessibility.css';
import './onboarding.css';
import './study.css';
import './study-language-picker.css';
import './study-audio.css';
import './simplify.css';
import './dark-contrast.css';
import './admin.css';
import './admin-settings.css';
import './profile.css';
import './assistant.css';
import './assistant-mobile.css';
import App from './App.jsx';

if ('serviceWorker' in navigator) window.addEventListener('load', async () => {
  if (import.meta.env.DEV) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.filter(registration => registration.active?.scriptURL === `${location.origin}/sw.js`).map(registration => registration.unregister()));
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('mylingua-')).map(key => caches.delete(key)));
    return;
  }
  navigator.serviceWorker.register('/sw.js').catch(() => {});
});
createRoot(document.getElementById('root')).render(<React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>);
