import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.jsx';
import './styles/index.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('No se encontró el elemento #root en index.html.');
}

createRoot(container).render(
  // `StrictMode` monta los efectos dos veces en desarrollo: es intencionado y
  // revela efectos que no se limpian bien. Si algo se rompe solo aquí, el defecto
  // está en el efecto, no en React.
  <StrictMode>
    <App />
  </StrictMode>,
);
