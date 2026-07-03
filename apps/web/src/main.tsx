import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { initSentry } from './lib/sentry';
import './index.css';

// Initialize Sentry before React mounts so error boundaries pick up the hub
// (R7.2). No-op when VITE_SENTRY_DSN is unset (R7.3); idempotent (R7.4).
initSentry();

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
