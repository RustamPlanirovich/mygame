import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Error boundary for startup
try {
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error("Root element not found");

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} catch (e) {
  console.error("Startup Error:", e);
  document.body.innerHTML = `<div style="color: red; padding: 20px; font-family: monospace;">
    <h1>Startup Error</h1>
    <pre>${e instanceof Error ? e.message + '\n' + e.stack : String(e)}</pre>
  </div>`
}

// Global error handler
window.addEventListener('error', (event) => {
  const message = String(event.message ?? '');
  // Chrome иногда репортит это как error event с null error. Это не критично и не должно ломать UI.
  if (message.includes('ResizeObserver loop completed')) return;

  console.error("Runtime Error:", event.error ?? message);
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = "color: red; padding: 20px; border-top: 1px solid #333; font-family: monospace; background: #111; position: fixed; bottom: 0; left: 0; right: 0; z-index: 9999;";
  errorDiv.innerHTML = `<h3>Runtime Error</h3><pre>${message}</pre>`;
  document.body.appendChild(errorDiv);
});
