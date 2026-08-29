import { Outlet } from 'react-router-dom';
import { Boxes } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/button.jsx';
import { Moon, Sun } from 'lucide-react';

const APP_NAME = import.meta.env.VITE_APP_NAME ?? 'Inventra';

/**
 * Contenedor de las pantallas sin sesión.
 *
 * Deliberadamente sobrio: el inicio de sesión es lo primero que ve el usuario cada
 * mañana y no debe distraer. La marca es neutra porque en esta pantalla todavía no
 * se sabe a qué empresa pertenece quien está entrando.
 */
export function AuthLayout() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Boxes className="size-5" aria-hidden="true" />
          </div>
          <span className="font-semibold tracking-tight">{APP_NAME}</span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema oscuro'}
        >
          {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        </Button>
      </header>

      <main className="flex flex-1 items-center justify-center p-4 pb-16">
        <Outlet />
      </main>

      <footer className="p-4 text-center text-xs text-muted-foreground">
        Sistema de gestión comercial · inventario, ventas, créditos y facturación
      </footer>
    </div>
  );
}
