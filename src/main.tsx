import '@fontsource-variable/golos-text/wght.css';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';

createRoot(document.getElementById('root')!).render(<App />);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // Only speeds up repeat visits, so a failed registration changes nothing for the guest.
  addEventListener('load', () => void navigator.serviceWorker.register('sw.js').catch(() => {}));
}
