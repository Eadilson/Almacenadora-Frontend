import { badgeVariants } from './variants.js';
import { cn } from '@/lib/utils';

/**
 * Etiqueta de estado.
 *
 * El color acompaña al texto pero nunca lo sustituye: quien no distingue colores
 * debe poder leer el estado igual. Por eso no hay variantes «solo color».
 */
export function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
