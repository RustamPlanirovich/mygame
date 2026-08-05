import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './utils/testCommands'; // Тестовые команды для dev режима

/*
 * The global error/unhandledrejection surface lives in index.html so it is armed before
 * this bundle evaluates. It used to be duplicated here, appending an unbounded stack of
 * red <div>s to <body> — one per error, forever — which meant a per-tick error grew
 * thousands of DOM nodes and pushed the game off screen. That handler is gone; errors are
 * reported once, deduped, dev-only.
 */

function hideBootSplash() {
  const splash = document.getElementById('boot-splash');
  if (!splash) return;
  splash.style.opacity = '0';
  window.setTimeout(() => splash.remove(), 320);
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  // Nothing to mount into: report without touching document.body.innerHTML, which would
  // destroy anything already rendered.
  const msg = document.createElement('pre');
  msg.style.cssText = 'color:#ff647f;padding:20px;font:12px ui-monospace,monospace';
  msg.textContent = 'Root element #root not found — не удалось запустить приложение.';
  document.body.appendChild(msg);
  hideBootSplash();
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary label="Приложение">
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );

  // Two frames after mount the first paint has landed, so removing the splash cannot
  // expose an unpainted root.
  requestAnimationFrame(() => requestAnimationFrame(hideBootSplash));
}
