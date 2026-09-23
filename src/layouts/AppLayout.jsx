import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Bell, ChevronDown, Gem, LogOut, Menu, Moon, Search, Store, Sun, User, X } from 'lucide-react';
import { useSession } from '@/hooks/useSession';
import { useTheme } from '@/hooks/useTheme';
import { navigation, visibleNavigation } from '@/constants/navigation';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
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
import heroImage from '@/assets/dashboard/jewelry-hero.png';

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
  const navItems = groups.flatMap((group) => group.items);
  const branches = user?.branches ?? [];
  const activeBranch = branches.find((branch) => branch.id === activeBranchId) ?? branches[0];
  const brandName = tenant?.tradeName ?? import.meta.env.VITE_APP_NAME ?? 'Inventra';

  const sidebar = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-2 pb-5 pt-1">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center text-white">
            <Gem className="size-8" aria-hidden="true" strokeWidth={1.45} />
          </div>
          <p className="max-w-32 font-serif text-lg font-semibold leading-[1.05] text-white">
            {brandName}
          </p>
        </div>
      </div>

      <nav className="sidebar-scroll min-h-0 flex-1 overflow-y-auto py-2" aria-label="Navegación principal">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.to} className="relative">
              {item.status === 'pending' ? (
                <span className="flex min-h-11 cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/35">
                  <item.icon className="size-[18px] shrink-0" aria-hidden="true" />
                  <span className="flex-1 truncate">{item.label}</span>
                  <Badge variant="outline" className="border-white/15 text-[10px] text-white/50">pronto</Badge>
                </span>
              ) : (
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) => cn(
                    'relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition-[color,background-color,box-shadow] duration-150 ease-out',
                    isActive
                      ? 'bg-[#1d3d61] text-white shadow-[0_12px_24px_-18px_rgb(0_0_0/0.85)]'
                      : 'text-white/76 hover:bg-white/7 hover:text-white',
                  )}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="absolute -left-[18px] inset-y-0 w-1 rounded-r-full bg-[#69a3ff]" aria-hidden="true" />}
                      <span className={cn('flex size-7 shrink-0 items-center justify-center', isActive ? 'text-white' : 'text-white/70')}>
                        <item.icon className="size-[18px]" aria-hidden="true" strokeWidth={1.75} />
                      </span>
                      <span className="truncate font-medium">{item.label === 'Panel' ? 'Inicio' : item.label}</span>
                    </>
                  )}
                </NavLink>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-4 hidden overflow-hidden rounded-xl border border-white/8 bg-white/5 lg:block">
        <div className="h-24 bg-cover bg-[position:78%_center]" style={{ backgroundImage: `url(${heroImage})` }} />
        <div className="p-4">
          <p className="font-serif text-base leading-5 text-white">Cada detalle cuenta una historia</p>
          <div className="mt-3 h-px w-10 bg-white/70" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="app-shell-bg flex min-h-screen text-foreground">
      {/* Barra lateral fija en escritorio */}
      <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 bg-[var(--panel-ink)] p-[18px] text-white lg:block">
        {sidebar}
      </aside>

      {/* Panel deslizante en pantallas pequeñas */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-foreground/35 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar navegación"
          />
          <div className="absolute inset-y-3 left-3 w-72 rounded-2xl bg-[var(--panel-ink)] p-4 text-white shadow-xl">
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
        <header className="sticky top-0 z-30 border-b border-border/70 bg-card/95 px-3 backdrop-blur lg:px-7">
          <div className="flex h-20 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir navegación"
          >
            <Menu aria-hidden="true" />
          </Button>

          <div className="relative hidden w-full max-w-[645px] md:block">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              placeholder="Buscar clientes, ventas, productos..."
              className="h-12 w-full rounded-2xl border border-transparent bg-[#f3f6fa] pl-11 pr-20 text-sm outline-none transition-colors placeholder:text-muted-foreground hover:bg-muted focus:border-primary/25 focus:bg-background focus:ring-2 focus:ring-primary/15 dark:bg-muted/70"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-lg bg-card px-2 py-1 text-xs font-medium text-muted-foreground shadow-sm xl:block">
              Ctrl + K
            </span>
          </div>

          {branches.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-12 min-w-48 justify-between gap-3 bg-card px-4">
                  <Store className="size-4" aria-hidden="true" />
                  <span className="max-w-32 truncate">{activeBranch?.name ?? 'Sucursal'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Punto de venta activo</DropdownMenuLabel>
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

          <Button variant="ghost" size="icon" aria-label="Notificaciones" className="relative">
            <Bell aria-hidden="true" />
            <span className="absolute right-2 top-2 size-2 rounded-full bg-destructive ring-2 ring-card" />
          </Button>

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
              <Button variant="ghost" className="h-12 gap-3 px-2">
                <Avatar className="size-9">
                  <AvatarFallback>{initialsOf(user?.name ?? '')}</AvatarFallback>
                </Avatar>
                <span className="hidden min-w-0 text-left sm:block">
                  <span className="block max-w-36 truncate text-sm font-semibold">{user?.name}</span>
                  <span className="block max-w-36 truncate text-xs text-muted-foreground">
                    {user?.role?.name}
                  </span>
                </span>
                <ChevronDown className="hidden size-4 text-muted-foreground sm:block" aria-hidden="true" />
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
              <DropdownMenuItem asChild>
                <NavLink to="/perfil">
                  <User aria-hidden="true" />
                  Mi perfil
                </NavLink>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => void logout()}>
                <LogOut aria-hidden="true" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </header>

        <main className="min-w-0 flex-1 bg-[var(--panel-surface)] p-3 sm:p-4 xl:p-5">
          <div className="mx-auto w-full max-w-[1760px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
