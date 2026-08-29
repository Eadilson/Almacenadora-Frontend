import { forwardRef } from 'react';
import { Input } from '@/components/ui/input.jsx';
import { decimalsFor } from '@/lib/money';
import { cn } from '@/lib/utils';

/**
 * Campo de importe.
 *
 * El usuario escribe en la unidad mayor («2960.00») y el formulario guarda ese
 * texto; la conversión a entero de unidad mínima ocurre al enviar, con
 * `parseMoneyInput`. No se convierte en cada pulsación a propósito: hacerlo
 * impediría escribir «2960.» mientras se teclea el decimal.
 *
 * Nunca se calcula con estos valores en el cliente. Los totales, impuestos y
 * márgenes los produce el servidor, que es la única fuente de verdad; duplicar esa
 * aritmética aquí garantizaría que algún día difieran.
 *
 * @param {object} props
 * @param {string} props.currency
 * @param {boolean} [props.invalid]
 * @param {string} [props.className]
 */
export const MoneyInput = forwardRef(({ currency, invalid = false, className, ...props }, ref) => {
  const decimals = decimalsFor(currency);

  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
        aria-hidden="true"
      >
        {currency}
      </span>
      <Input
        ref={ref}
        // `inputMode` decimal abre el teclado numérico en móvil sin perder la
        // posibilidad de escribir el separador.
        inputMode="decimal"
        autoComplete="off"
        placeholder={decimals === 0 ? '0' : `0.${'0'.repeat(decimals)}`}
        invalid={invalid}
        className={cn('pl-12 text-right tabular', className)}
        {...props}
      />
    </div>
  );
});

MoneyInput.displayName = 'MoneyInput';
