import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, CreditCard, Receipt, TriangleAlert } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { FormField } from '@/components/forms/FormField.jsx';
import { MoneyInput } from '@/components/forms/MoneyInput.jsx';
import { useSession } from '@/hooks/useSession';
import { formatMoney, parseMoneyInput } from '@/lib/money';
import { useSalesMutations } from '../hooks/useSales.js';

/** Formas de cobro que ofrece la caja. */
const METHODS = [
  { value: 'CASH', label: 'Efectivo', icon: Banknote },
  { value: 'CARD', label: 'Tarjeta', icon: CreditCard },
  { value: 'TRANSFER', label: 'Transferencia', icon: Receipt },
];

/**
 * Cobro de la venta.
 *
 * Aquí se decide cómo se paga y se confirma. Dos detalles importan más que el resto:
 *
 * - **La clave de idempotencia se genera una vez por venta**, al abrir el cobro, y
 *   se conserva mientras el diálogo siga abierto. Si la respuesta se pierde y el
 *   cajero vuelve a pulsar, el servidor devuelve la venta original en lugar de
 *   cobrar dos veces. Generarla en cada envío anularía esa protección.
 * - **El cambio se calcula, pero no se envía**: lo que se registra es el importe de
 *   la venta, no lo que el cliente puso sobre el mostrador.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {any[]} props.cart
 * @param {number} props.total Total previsto, en unidad mínima.
 * @param {string} props.branchId
 * @param {any} props.customer
 * @param {() => void} props.onCompleted
 */
export function CheckoutDialog({ open, onOpenChange, cart, total, branchId, customer, onCompleted }) {
  const { tenant } = useSession();
  const { createSale } = useSalesMutations();
  const currency = tenant?.currency ?? 'GTQ';

  const [method, setMethod] = useState('CASH');
  const [received, setReceived] = useState('');
  const [onCredit, setOnCredit] = useState(false);
  const [creditTermDays, setCreditTermDays] = useState(30);
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(/** @type {any} */ (null));

  // Una clave por intento de venta, no por envío.
  const idempotencyKey = useRef('');

  useEffect(() => {
    if (open) {
      idempotencyKey.current = crypto.randomUUID();
      setMethod('CASH');
      setReceived('');
      setOnCredit(false);
      setCreditTermDays(customer?.credit?.termDays ?? 30);
      setReference('');
      setError('');
      setResult(null);
    }
  }, [open, customer]);

  const canUseCredit = Boolean(customer?.credit?.enabled);

  const change = useMemo(() => {
    const cash = parseMoneyInput(received, currency);
    if (!cash || onCredit) return null;
    return cash.amount - total;
  }, [received, total, currency, onCredit]);

  const confirm = async () => {
    setError('');

    const payload = {
      branchId,
      customerId: customer?.id ?? null,
      lines: cart.map((line) => ({ productId: line.productId, quantity: String(line.quantity) })),
      payments: onCredit
        ? []
        : [{ method, amount: { amount: total, currency }, reference: reference || null }],
      ...(onCredit ? { creditAmount: { amount: total, currency }, creditTermDays } : {}),
    };

    try {
      const sale = await createSale.mutateAsync({
        payload,
        idempotencyKey: idempotencyKey.current,
      });

      setResult(sale);
    } catch (mutationError) {
      const apiError = /** @type {any} */ (mutationError);

      // El caso más frecuente aquí: alguien vendió la última unidad mientras esta
      // venta se preparaba. Conviene decirlo con claridad.
      if (apiError?.code === 'INSUFFICIENT_STOCK') {
        setError(
          `Ya no hay existencia suficiente de ${apiError.meta?.sku ?? 'un producto'}: quedan ${apiError.meta?.available ?? '0'}.`,
        );
        return;
      }

      setError(apiError?.message ?? 'No se pudo confirmar la venta.');
    }
  };

  // Venta confirmada: se muestra el comprobante y se ofrece continuar.
  if (result) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="size-5 text-success" aria-hidden="true" />
              Venta confirmada
            </DialogTitle>
            <DialogDescription>
              <span className="font-mono">{result.sale.number}</span>
              {result.invoice && (
                <>
                  {' · factura '}
                  <span className="font-mono">{result.invoice.number}</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 rounded-lg border p-4">
            <div className="flex justify-between text-lg font-semibold">
              <span>Total</span>
              <span className="tabular">{result.sale.total.formatted}</span>
            </div>

            {result.sale.creditAmount.amount > 0 && (
              <div className="flex justify-between text-sm text-warning">
                <span>Queda a deber</span>
                <span className="tabular">{result.sale.creditAmount.formatted}</span>
              </div>
            )}

            {change !== null && change > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cambio</span>
                <span className="tabular">{formatMoney({ amount: change, currency })}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" asChild>
              <Link to={`/ventas/${result.sale.id}`}>Ver detalle</Link>
            </Button>
            <Button onClick={onCompleted} autoFocus>
              Nueva venta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cobrar</DialogTitle>
          <DialogDescription>
            {cart.length} {cart.length === 1 ? 'producto' : 'productos'} ·{' '}
            {customer?.name ?? 'Consumidor final'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-baseline justify-between rounded-lg border bg-muted/30 p-4">
            <span className="text-sm text-muted-foreground">Total a cobrar</span>
            <span className="text-3xl font-semibold tabular">
              {formatMoney({ amount: total, currency })}
            </span>
          </div>

          {canUseCredit && (
            <label className="flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm">
              <input
                type="checkbox"
                className="size-4"
                checked={onCredit}
                onChange={(event) => setOnCredit(event.target.checked)}
              />
              <span className="flex-1">Dejar a crédito</span>
              <Badge variant="secondary">Límite {customer.credit.limit.formatted}</Badge>
            </label>
          )}

          {onCredit ? (
            <FormField name="creditTermDays" label="Plazo de pago (días)">
              {({ id }) => (
                <Input
                  id={id}
                  type="number"
                  min={1}
                  max={365}
                  value={creditTermDays}
                  onChange={(event) => setCreditTermDays(Number(event.target.value))}
                  className="text-right tabular"
                />
              )}
            </FormField>
          ) : (
            <>
              <FormField name="method" label="Forma de pago" required>
                {({ id }) => (
                  <div className="grid grid-cols-3 gap-2" id={id}>
                    {METHODS.map((option) => {
                      const Icon = option.icon;
                      const active = method === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setMethod(option.value)}
                          className={[
                            'flex flex-col items-center gap-1 rounded-lg border p-3 text-xs transition-colors',
                            active ? 'border-primary bg-accent font-medium' : 'hover:bg-accent/60',
                          ].join(' ')}
                        >
                          <Icon className="size-5" aria-hidden="true" />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </FormField>

              {method === 'CASH' ? (
                <FormField
                  name="received"
                  label="Efectivo recibido"
                  hint="Solo para calcular el cambio; se registra el importe de la venta."
                >
                  {({ id }) => (
                    <MoneyInput
                      id={id}
                      currency={currency}
                      value={received}
                      onChange={(event) => setReceived(event.target.value)}
                      autoFocus
                    />
                  )}
                </FormField>
              ) : (
                <FormField name="reference" label="Referencia" hint="Últimos dígitos, autorización…">
                  {({ id }) => (
                    <Input
                      id={id}
                      value={reference}
                      onChange={(event) => setReference(event.target.value)}
                      autoFocus
                    />
                  )}
                </FormField>
              )}

              {change !== null && (
                <>
                  <Separator />
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">
                      {change >= 0 ? 'Cambio' : 'Falta'}
                    </span>
                    <span
                      className={`text-xl font-semibold tabular ${change < 0 ? 'text-destructive' : ''}`}
                    >
                      {formatMoney({ amount: Math.abs(change), currency })}
                    </span>
                  </div>
                </>
              )}
            </>
          )}

          {error && (
            <Alert variant="destructive">
              <TriangleAlert aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createSale.isPending}>
            Cancelar
          </Button>
          <Button
            size="lg"
            disabled={createSale.isPending || cart.length === 0}
            onClick={confirm}
          >
            {createSale.isPending ? 'Confirmando…' : 'Confirmar venta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
