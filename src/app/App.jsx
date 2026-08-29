import { BrowserRouter } from 'react-router-dom';
import { AppProviders } from './providers/AppProviders.jsx';
import { AppRoutes } from './router/index.jsx';

export function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </BrowserRouter>
  );
}
