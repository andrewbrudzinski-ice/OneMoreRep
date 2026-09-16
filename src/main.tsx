import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import './index.css';

// Register the service worker for offline support (auto-updates).
registerSW({ immediate: true });

// Recover from a stale chunk after a redeploy: if a dynamically-imported module
// fails to load (its hashed filename changed on the server), reload once to pull
// the fresh assets. Guarded per session so it can never loop.
window.addEventListener('vite:preloadError', () => {
  if (!sessionStorage.getItem('chunk-reload')) {
    sessionStorage.setItem('chunk-reload', '1');
    window.location.reload();
  }
});

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element #root not found');
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
