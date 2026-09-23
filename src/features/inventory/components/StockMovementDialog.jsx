import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { FormField } from '@/components/forms/FormField.jsx';
import { MoneyInput } from '@/components/forms/MoneyInput.jsx';
import { useSession } from '@/hooks/useSession';
import { parseMoneyInput } from '@/lib/money';
import { applyServerErrors } from '@/lib/applyServerErrors';
import { useInventoryMutations } from '../hooks/useInventory.js';

/**
 * El motivo se pide con contenido real, no como un trámite.
 *
 * Es la explicación que quedará en el historial: dentro de seis meses, alguien
 * revisando un faltante necesita entender qué pasó.
 */
const reason = z
  .string()
  .trim()
  .min(5, 'Explique el motivo: quedará registrado en el historial.')
  .max(300);

const schema = z
  .object({
    operation: z.enum(['OPENING', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'LOSS']),
    quantity: z
      .string()
      .trim()
      .min(1, 'Indique la cantidad.')
      .refine((value) => /^\d+([.,]\d+)?$/.test(value), 'Cantidad inválida.')
      .refine((value) => Number(value.replace(',', '.')) > 0, 'Debe ser mayor que cero.'),
    unitCost: z.string().optional().default(''),
    reason: z.string().optional().default(''),
    notes: z.string().trim().max(300).optional().default(''),
  })
  .superRefine((values, ctx) => {
    // El saldo inicial necesita costo: es el que fija el valor del inventario.
    if (values.operation === 'OPENING' && !values.unitCost.trim()) {
      ctx.addIssue({ path: ['unitCost'], code: z.ZodIssueCode.custom, message: 'Indique el costo unitario.' });
    }

    if (values.operation !== 'OPENING') {
      const result = reason.safeParse(values.reason);
      if (!result.success) {
        ctx.addIssue({
          path: ['reason'],
          code: z.ZodIssueCode.custom,
          message: result.error.issues[0].message,
        });
      }
    }
  });

const OPERATIONS = {
  OPENING: { label: 'Saldo inicial', hint: 'Registra la existencia con la que arranca el producto y fija su costo.' },
  ADJUSTMENT_IN: { label: 'Ajuste de entrada', hint: 'Sobrante encontrado en un conteo físico.' },
  ADJUSTMENT_OUT: { label: 'Ajuste de salida', hint: 'Faltante detectado en un conteo físico.' },
  LOSS: { label: 'Pérdida o daño', hint: 'Mercancía rota, vencida o robada.' },
};

/**
 * Registro de un movimiento manual de inventario.
 *
 * Solo existen estos cuatro: el resto de los movimientos los produce el sistema al
 * confirmar una compra o una venta. Permitir crear a mano una «salida por venta»
 * dejaría inventario descontado sin venta que lo respalde.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {{ id: string, sku: string, name: string }|null} props.product
 * @param {string} props.branchId
 * @param {string} [props.currentStock]
 * @param {boolean} [props.hasMovements] Si ya tiene historial, el saldo inicial no aplica.
 */
export function StockMovementDialog({
  open,
  onOpenChange,
  product,
  branchId,
  currentStock,
  hasMovements = true,
}) {
  const { tenant } = useSession();
  const { openingBalance, adjust, registerLoss } = useInventoryMutations();
  const currency = tenant?.currency ?? 'GTQ';

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      operation: hasMovements ? 'ADJUSTMENT_IN' : 'OPENING',
      quantity: '',
      unitCost: '',
      reason: '',
      notes: '',
    },
  });

  const [saveError, setSaveError] = useState('');

  // Al abrir para otro producto, el formulario debe empezar limpio: conservar lo
  // escrito antes provocaría registrar una cantidad en el producto equivocado.
  // El mismo diálogo se reutiliza para productos distintos, así que un error
  // de un intento fallido también debe limpiarse, o se queda visible sobre el
  // producto equivocado.
  useEffect(() => {
    if (open) {
      form.reset({
        operation: hasMovements ? 'ADJUSTMENT_IN' : 'OPENING',
        quantity: '',
        unitCost: '',
        reason: '',
        notes: '',
      });
      setSaveError('');
    }
  }, [open, product?.id, hasMovements, form]);

  const operation = form.watch('operation');
  const errors = form.formState.errors;
  const saving = openingBalance.isPending || adjust.isPending || registerLoss.isPending;

  const submit = form.handleSubmit(async (values) => {
    if (!product) return;

    const base = {
      productId: product.id,
      branchId,
      quantity: values.quantity.replace(',', '.'),
      notes: values.notes || undefined,
    };

    try {
      if (values.operation === 'OPENING') {
        const cost = parseMoneyInput(values.unitCost, currency);
        if (!cost) {
          form.setError('unitCost', { message: 'Importe inválido.' });
          return;
        }
        await openingBalance.mutateAsync({ ...base, unitCost: cost });
      } else if (values.operation === 'LOSS') {
        await registerLoss.mutateAsync({ ...base, reason: values.reason });
      } else {
        await adjust.mutateAsync({
          ...base,
          direction: values.operation === 'ADJUSTMENT_IN' ? 'IN' : 'OUT',
          reason: values.reason,
        });
      }

      onOpenChange(false);
    } catch (error) {
      const apiError = /** @type {any} */ (error);

      // Existencias insuficientes es la respuesta más frecuente aquí: se coloca
      // sobre el campo de cantidad, que es donde el usuario debe corregir.
      if (apiError?.code === 'INSUFFICIENT_STOCK') {
        form.setError('quantity', {
          message: `Solo hay ${apiError.meta?.available ?? '0'} disponibles.`,
        });
        return;
      }

      // Cualquier otro error —incluido uno que no señale ningún campo real—
      // se muestra en `saveError` en vez de callarse.
      applyServerErrors(form, apiError, setSaveError, {
        fallbackMessage: 'No se pudo registrar el movimiento. Inténtelo de nuevo.',
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Movimiento de inventario</DialogTitle>
          <DialogDescription>
            {product ? (
              <>
                <span className="font-mono text-xs">{product.sku}</span> · {product.name}
                {currentStock !== undefined && <> · existencia actual: {currentStock}</>}
              </>
            ) : (
              'Seleccione un producto'
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4" noValidate>
          <FormField
            name="operation"
            label="Tipo de movimiento"
            required
            error={errors.operation?.message}
            hint={OPERATIONS[operation]?.hint}
          >
            {({ id, invalid, describedBy }) => (
              <Select id={id} invalid={invalid} aria-describedby={describedBy} {...form.register('operation')}>
                {Object.entries(OPERATIONS)
                  // El saldo inicial solo se ofrece si el producto no tiene historial:
                  // se registra una sola vez.
                  .filter(([key]) => key !== 'OPENING' || !hasMovements)
                  .map(([key, option]) => (
                    <option key={key} value={key}>
                      {option.label}
                    </option>
                  ))}
              </Select>
            )}
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField name="quantity" label="Cantidad" required error={errors.quantity?.message}>
              {({ id, invalid, describedBy }) => (
                <Input
                  id={id}
                  invalid={invalid}
                  aria-describedby={describedBy}
                  inputMode="decimal"
                  autoFocus
                  className="text-right tabular"
                  {...form.register('quantity')}
                />
              )}
            </FormField>

            {operation === 'OPENING' && (
              <FormField
                name="unitCost"
                label="Costo unitario"
                required
                error={errors.unitCost?.message}
                hint="Fija el valor del inventario."
              >
                {({ id, invalid, describedBy }) => (
                  <MoneyInput
                    id={id}
                    currency={currency}
                    invalid={invalid}
                    aria-describedby={describedBy}
                    {...form.register('unitCost')}
                  />
                )}
              </FormField>
            )}
          </div>

          {operation !== 'OPENING' && (
            <FormField
              name="reason"
              label="Motivo"
              required
              error={errors.reason?.message}
              hint="Quedará en el historial junto a su nombre y la hora."
            >
              {({ id, invalid, describedBy }) => (
                <Textarea
                  id={id}
                  invalid={invalid}
                  aria-describedby={describedBy}
                  rows={2}
                  placeholder="Faltante detectado en el conteo del 30 de julio"
                  {...form.register('reason')}
                />
              )}
            </FormField>
          )}

          <Alert variant="info">
            <Info aria-hidden="true" />
            <AlertDescription>
              El movimiento no se puede borrar. Si se equivoca, se corrige con otro que lo compensa y
              ambos quedan visibles.
            </AlertDescription>
          </Alert>

          {saveError && (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !product}>
              {saving ? 'Registrando…' : 'Registrar movimiento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
