import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import { initTheme } from '@/app/theme';
import '@/styles/design-system/index.css';
import '@/styles/app.css';

initTheme(); // apply the stored/default theme before first paint (no flash)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
