/**
 * Cabecera de página: título, descripción, y sus acciones a la derecha.
 *
 * La primera versión metía esto en una caja con degradado de marca detrás —
 * la clase de "hero" que trae cualquier plantilla de panel armada con un kit
 * de componentes. Esta es más callada: una regla fina abajo, el icono de la
 * sección (el mismo que ya la identifica en la barra lateral) en tinta
 * discreta junto al título, y el peso puesto en la tipografía, no en el
 * color de fondo. Se nota menos a primera vista y se sostiene mejor: no
 * compite con las cifras de abajo, que son lo que de verdad hay que mirar.
 *
 * @param {object} props
 * @param {string} props.title
 * @param {React.ReactNode} [props.description]
 * @param {React.ComponentType<{ className?: string }>} [props.icon]
 * @param {React.ReactNode} [props.children] Botones de acción, alineados a la derecha.
 */
export function PageHeader({ title, description, icon: Icon, children }) {
  return (
    <header className="border-b border-border/80 pb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground shadow-card">
              <Icon className="size-5" aria-hidden="true" strokeWidth={1.75} />
            </div>
          )}
          <div className="min-w-0 space-y-1">
            <h1 className="text-balance text-3xl font-semibold tracking-tight">{title}</h1>
            {description && <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>}
          </div>
        </div>

        {children && (
          <div className="flex flex-wrap items-center gap-2">
            {children}
          </div>
        )}
      </div>
    </header>
  );
}
