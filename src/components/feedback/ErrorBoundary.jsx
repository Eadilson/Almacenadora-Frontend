import { Component } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';

/**
 * Captura fallos de renderizado.
 *
 * Sin esto, un error en un componente deja la pantalla en blanco y el usuario no
 * sabe si perdió su trabajo. Aquí al menos ve qué pasó y puede recargar.
 *
 * Es una clase porque React solo ofrece `componentDidCatch` en componentes de
 * clase: no existe equivalente con hooks.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  /**
   * @param {Error} error
   */
  static getDerivedStateFromError(error) {
    return { error };
  }

  /**
   * @param {Error} error
   * @param {{ componentStack: string }} info
   */
  componentDidCatch(error, info) {
    // En producción esto va al servicio de seguimiento de errores (F5). La consola
    // es el destino provisional y por eso está permitida aquí de forma explícita.
    console.error('Fallo de renderizado:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md space-y-4 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <TriangleAlert className="size-6 text-destructive" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <h1 className="text-lg font-semibold">Algo salió mal</h1>
            <p className="text-sm text-muted-foreground">
              La pantalla no pudo mostrarse. Sus datos guardados no se han perdido.
            </p>
          </div>

          {import.meta.env.DEV && (
            <pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 text-left font-mono text-xs">
              {this.state.error.message}
            </pre>
          )}

          <Button onClick={() => window.location.reload()} className="w-full">
            <RefreshCw aria-hidden="true" />
            Recargar la aplicación
          </Button>
        </div>
      </div>
    );
  }
}
