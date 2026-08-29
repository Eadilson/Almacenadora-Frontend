import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Boxes, LogOut, Menu, Moon, Store, Sun, User, X } from 'lucide-react';
import { useSession } from '@/hooks/useSession';
import { useTheme } from '@/hooks/useTheme';
import { navigation, visibleNavigation } from '@/constants/navigation';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { Avatar, AvatarFallback } from '@/components/ui/avatar.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.jsx';
import { cn, initialsOf } from '@/lib/utils';

/**
 * Estructura de la aplicación con sesión: barra lateral, cabecera y contenido.
 *
 * La barra lateral se construye filtrando la navegación por permisos y capacidades
 * del plan, de modo que cada usuario vea solo lo que puede usar. Es experiencia de
 * uso, no seguridad: el servidor decide en cada petición.
 */
export function AppLayout() {
  const { user, tenant, logout, can, hasFeature, activeBranchId, setActiveBranch } = useSession();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const groups = visibleNavigation(navigation, can, hasFeature);
  const branches = user?.branches ?? [];
  const activeBranch = branches.find((branch) => branch.id === activeBranchId) ?? branches[0];
  const brandName = tenant?.tradeName ?? import.meta.env.VITE_APP_NAME ?? 'Inventra';

  const sidebar = (
    <div className="flex h-full flex-col gap-1">
      <div className="flex items-center gap-2 px-3 py-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Boxes className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          {/* El nombre viene de la configuración de la empresa (white-label): nunca
              se escribe literal en el código. */}
          <p className="truncate text-sm font-semibold leading-tight">{brandName}</p>
          {tenant?.plan && (
            <p className="truncate text-xs text-muted-foreground">Plan {tenant.plan.name}</p>
          )}
        </div>
      </div>

      <Separator />

      <nav className="flex-1 overflow-y-auto py-3" aria-label="Navegación principal">
        {groups.map((group) => (
          <div key={group.title ?? 'principal'} className="mb-4">
            {group.title && (
              <p className="px-3 pb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {group.title}
              </p>
            )}
            <ul className="space-y-0.5 px-2">
              {group.items.map((item) => (
                <li key={item.to}>
                  {item.status === 'pending' ? (
                    <span
                      className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground/60"
                      title="Módulo en construcción"
                    >
                      <item.icon className="size-4 shrink-0" aria-hidden="true" />
                      <span className="flex-1 truncate">{item.label}</span>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        pronto
                      </Badge>
                    </span>
                  ) : (
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                          isActive
                            ? 'bg-primary/10 font-medium text-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                        )
                      }
                    >
                      <item.icon className="size-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-muted/20">
      {/* Barra lateral fija en escritorio */}
      <aside className="hidden w-60 shrink-0 border-r bg-background lg:block">{sidebar}</aside>

      {/* Panel deslizante en pantallas pequeñas */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar navegación"
          />
          <div className="absolute inset-y-0 left-0 w-64 border-r bg-background shadow-xl">
            <div className="flex justify-end p-2">
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                <X aria-hidden="true" />
                <span className="sr-only">Cerrar</span>
              </Button>
            </div>
            {sidebar}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir navegación"
          >
            <Menu aria-hidden="true" />
          </Button>

          {/* Selector de sucursal: solo cuando hay más de una y el plan lo permite.
              En una empresa de un local, un selector con una única opción es ruido. */}
          {branches.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Store className="size-4" aria-hidden="true" />
                  <span className="max-w-32 truncate">{activeBranch?.name ?? 'Sucursal'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Sucursal activa</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={activeBranch?.id ?? ''}
                  onValueChange={setActiveBranch}
                >
                  {branches.map((branch) => (
                    <DropdownMenuRadioItem key={branch.id} value={branch.id}>
                      <span className="truncate">{branch.name}</span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <div className="flex-1" />

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema oscuro'}
          >
            {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-2">
                <Avatar className="size-7">
                  <AvatarFallback>{initialsOf(user?.name ?? '')}</AvatarFallback>
                </Avatar>
                <span className="hidden max-w-32 truncate text-sm sm:inline">{user?.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="px-2 py-1.5">
                <p className="truncate text-sm font-medium">{user?.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                <Badge variant="secondary" className="mt-2">
                  {user?.role?.name}
                </Badge>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                <User aria-hidden="true" />
                Mi perfil
                <Badge variant="outline" className="ml-auto text-[10px]">
                  pronto
                </Badge>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => void logout()}>
                <LogOut aria-hidden="true" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="min-w-0 flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
