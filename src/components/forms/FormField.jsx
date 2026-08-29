import { Label } from '@/components/ui/label.jsx';
import { cn } from '@/lib/utils';

/**
 * Envoltorio de campo: etiqueta, ayuda, error y accesibilidad.
 *
 * Centraliza el vínculo entre la etiqueta, el control y su mensaje de error
 * (`aria-describedby`). Repetir esto campo por campo garantiza que en algún
 * formulario se olvide, y un error que el lector de pantalla no anuncia deja al
 * usuario sin saber por qué no puede guardar.
 *
 * @param {object} props
 * @param {string} props.name
 * @param {string} props.label
 * @param {boolean} [props.required]
 * @param {string} [props.hint]
 * @param {string} [props.error]
 * @param {string} [props.className]
 * @param {(field: { id: string, invalid: boolean, describedBy: string|undefined }) => React.ReactNode} props.children
 */
export function FormField({ name, label, required = false, hint, error, className, children }) {
  const id = `campo-${name}`;
  const hintId = hint ? `${id}-ayuda` : null;
  const errorId = error ? `${id}-error` : null;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>

      {children({ id, invalid: Boolean(error), describedBy })}

      {error ? (
        <p id={errorId ?? undefined} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId ?? undefined} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
