import { ThemeProvider } from './ThemeProvider.jsx';
import { ToastProvider } from './ToastProvider.jsx';
import { QueryProvider } from './QueryProvider.jsx';
import { SessionProvider } from './SessionProvider.jsx';
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary.jsx';

/**
 * Composición de proveedores.
 *
 * El orden importa: `ErrorBoundary` envuelve todo para capturar cualquier fallo de
 * renderizado; el tema va fuera para que la pantalla de error también se muestre en
 * modo oscuro; y la sesión va dentro de las consultas porque las usa para cargar el
 * perfil.
 */
export function AppProviders({ children }) {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <QueryProvider>
            <SessionProvider>{children}</SessionProvider>
          </QueryProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
