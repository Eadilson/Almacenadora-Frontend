import { Outlet } from 'react-router-dom';
import { Boxes, CircleDollarSign, PackageCheck, ShieldCheck, TrendingUp } from 'lucide-react';
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
    <div className="app-shell-bg flex min-h-screen flex-col">
      <header className="flex items-center justify-between p-4 lg:px-6">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-foreground text-background">
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

      <main className="grid flex-1 items-center gap-5 p-4 pb-10 lg:grid-cols-[minmax(0,1fr)_440px] lg:p-6">
        <section className="relative hidden min-h-[calc(100vh-8.5rem)] overflow-hidden rounded-[2rem] bg-foreground p-8 text-background shadow-[0_24px_70px_-46px_rgb(0_0_0/0.9)] lg:flex lg:flex-col">
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
              backgroundSize: '56px 56px',
            }}
            aria-hidden="true"
          />

          <div className="relative z-10 max-w-2xl">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.28em] text-background/55">
              Operación comercial
            </p>
            <h1 className="text-balance text-6xl font-semibold leading-[0.96] tracking-[-0.045em]">
              Un centro de control para vender, cobrar y reponer.
            </h1>
            <p className="mt-6 max-w-xl text-sm leading-7 text-background/62">
              Diseñado para leer la operación en segundos: inventario, caja y cartera con el mismo
              criterio visual.
            </p>
          </div>

          <div className="relative z-10 mt-auto grid gap-3">
            <div className="grid grid-cols-[1.2fr_0.8fr] gap-3">
              <div className="rounded-[1.5rem] border border-background/12 bg-background/[0.07] p-5 shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-background/48">
                    Ventas hoy
                  </p>
                  <TrendingUp className="size-4 text-background/55" aria-hidden="true" />
                </div>
                <p className="mt-8 text-4xl font-semibold tracking-tight">Q 18,420</p>
                <div className="mt-5 flex h-16 items-end gap-1.5">
                  {[42, 58, 34, 70, 52, 86, 64, 94, 78].map((height, index) => (
                    <span
                      key={index}
                      className="flex-1 rounded-t bg-background/70"
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
              </div>

              <div className="grid gap-3">
                {[
                  { icon: PackageCheck, label: 'Stock crítico', value: '12' },
                  { icon: CircleDollarSign, label: 'Por cobrar', value: 'Q 31k' },
                  { icon: ShieldCheck, label: 'Caja', value: 'Cerrada' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[1.25rem] border border-background/12 bg-background/[0.07] p-4"
                  >
                    <div className="flex items-center gap-2 text-background/52">
                      <item.icon className="size-4" aria-hidden="true" />
                      <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">
                        {item.label}
                      </span>
                    </div>
                    <p className="mt-3 text-xl font-semibold tracking-tight">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-[1.5rem] border border-background/12 bg-background/[0.07] px-5 py-4 text-sm">
              <span className="text-background/55">Sucursal activa</span>
              <span className="font-medium">Sucursal de prueba #1</span>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md lg:mx-0">
          <Outlet />
        </section>
      </main>

      <footer className="p-4 text-center text-xs text-muted-foreground lg:px-8 lg:text-left">
        Sistema de gestión comercial · inventario, ventas, créditos y facturación
      </footer>
    </div>
  );
}
