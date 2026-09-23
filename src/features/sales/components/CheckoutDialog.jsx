import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, CreditCard, History, Receipt, TriangleAlert } from 'lucide-react';
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
import { usePermission } from '@/hooks/usePermission';
import { formatMoney, parseMoneyInput } from '@/lib/money';
import { formatDate } from '@/lib/format';
import { useCustomerAccount } from '@/features/credit/hooks/useCredit.js';
import { useSalesMutations } from '../hooks/useSales.js';

/** Formas de cobro que ofrece la caja. */
const METHODS = [
  { value: 'CASH', label: 'Efectivo', icon: Banknote },
  { value: 'CARD', label: 'Tarjeta', icon: CreditCard },
  { value: 'TRANSFER', label: 'Transferencia', icon: Receipt },
];

/**
 * Selector de forma de pago. Se usa tanto para el importe completo de una
 * venta de contado como para el abono de una venta a crédito: la mecánica es
 * la misma, solo cambia qué importe termina cobrando.
 *
 * @param {{ id?: string, value: string, onChange: (value: string) => void }} props
 */
function PaymentMethodPicker({ id, value, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-2" id={id}>
      {METHODS.map((option) => {
        const Icon = option.icon;
        const active = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
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
  );
}

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
  const { can } = usePermission();
  const { createSale } = useSalesMutations();
  const currency = tenant?.currency ?? 'GTQ';

  const [method, setMethod] = useState('CASH');
  const [received, setReceived] = useState('');
  const [onCredit, setOnCredit] = useState(false);
  const [deposit, setDeposit] = useState('');
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
      setDeposit('');
      setCreditTermDays(customer?.credit?.termDays ?? 30);
      setReference('');
      setError('');
      setResult(null);
    }
  }, [open, customer]);

  // Sin interruptor aparte: un límite en cero es, por sí mismo, un cliente sin
  // crédito. Lo que de verdad queda disponible ahora mismo —descontando lo que ya
  // debe— lo vuelve a comprobar el servidor al confirmar.
  const canUseCredit = Boolean(customer?.credit?.limit?.amount > 0);

  /**
   * El historial de pagos, para decidir con algo más que el límite.
   *
   * El límite dice cuánto se le podría fiar en teoría; no dice si esta persona
   * paga. Antes de dejar a crédito conviene ver si ya debe, si está en mora, y si
   * alguna vez ha abonado algo —un cliente nuevo con crédito recién asignado no es
   * lo mismo que uno con meses de cuentas saldadas a tiempo—.
   *
   * Se pide con el mismo permiso que abre la Cartera: quien no puede verla ahí
   * tampoco la ve aquí, y el diálogo sigue funcionando igual sin este bloque.
   */
  const canSeeAccount = can('credit:read');
  const { data: accountData, isSuccess: accountLoaded } = useCustomerAccount(
    canUseCredit && canSeeAccount ? (customer?.id ?? null) : null,
  );
  // Un cliente nuevo, que nunca ha comprado a crédito, todavía no tiene cuenta:
  // eso no es un error, es justo el caso de «nunca ha abonado» que se quiere ver.
  const account = accountData?.account ?? null;

  const change = useMemo(() => {
    const cash = parseMoneyInput(received, currency);
    if (!cash || onCredit) return null;
    return cash.amount - total;
  }, [received, total, currency, onCredit]);

  // Lo que se abona de una vez, al confirmar una venta a crédito. No es
  // obligatorio: dejarlo en blanco deja el total entero a deber, como antes.
  // Pero escrito-y-mal-formado no es lo mismo que vacío: lo primero es una
  // decisión, lo segundo es una equivocación que no debe pasar como cero.
  const depositAmount = useMemo(() => {
    if (!onCredit) return 0;
    const parsed = parseMoneyInput(deposit, currency);
    if (!parsed) return 0;
    return Math.min(Math.max(parsed.amount, 0), total);
  }, [deposit, onCredit, total, currency]);

  const depositInvalid = onCredit && deposit.trim() !== '' && !parseMoneyInput(deposit, currency);

  const creditRemaining = total - depositAmount;

  const confirm = async () => {
    setError('');

    if (depositInvalid) {
      setError('El abono no es un importe válido.');
      return;
    }

    const payload = {
      branchId,
      customerId: customer?.id ?? null,
      lines: cart.map((line) => ({ productId: line.productId, quantity: String(line.quantity) })),
      payments: onCredit
        ? depositAmount > 0
          ? [{ method, amount: { amount: depositAmount, currency }, reference: reference || null }]
          : []
        : [{ method, amount: { amount: total, currency }, reference: reference || null }],
      ...(onCredit
        ? { creditAmount: { amount: creditRemaining, currency }, creditTermDays }
        : {}),
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

            {result.sale.creditAmount.amount > 0 && result.sale.paidAmount.amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Abonado ahora</span>
                <span className="tabular">{result.sale.paidAmount.formatted}</span>
              </div>
            )}

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
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={onCredit}
                  onChange={(event) => setOnCredit(event.target.checked)}
                />
                <span className="flex-1">Dejar a crédito</span>
                <Badge variant="secondary">
                  Disponible {account ? account.availableCredit.formatted : customer.credit.limit.formatted}
                </Badge>
              </label>

              {/*
                El límite dice cuánto se le podría fiar; no dice si esta persona
                paga. Esto se ve pase lo que pase con la casilla, porque es
                justo lo que ayuda a decidir si marcarla.
              */}
              {canSeeAccount && accountLoaded && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  {account && account.balance.amount > 0 && (
                    <span>
                      Ya debe{' '}
                      <span className="font-medium text-foreground">{account.balance.formatted}</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <History className="size-3" aria-hidden="true" />
                    {account?.lastPaymentAt
                      ? `Último abono ${formatDate(account.lastPaymentAt)}`
                      : 'Nunca ha abonado'}
                  </span>
                  {account && account.overdueAmount.amount > 0 && (
                    <Badge variant="destructive" className="text-[10px]">
                      En mora
                    </Badge>
                  )}
                </div>
              )}
            </div>
          )}

          {onCredit ? (
            <>
              <FormField
                name="deposit"
                label="Abono ahora (opcional)"
                hint="Lo que no se abone aquí queda registrado a crédito."
                error={depositInvalid ? 'Importe inválido.' : undefined}
              >
                {({ id, invalid, describedBy }) => (
                  <MoneyInput
                    id={id}
                    currency={currency}
                    value={deposit}
                    onChange={(event) => setDeposit(event.target.value)}
                    invalid={invalid}
                    aria-describedby={describedBy}
                    autoFocus
                  />
                )}
              </FormField>

              {depositAmount > 0 && (
                <FormField name="method" label="Forma de pago del abono" required>
                  {({ id }) => <PaymentMethodPicker id={id} value={method} onChange={setMethod} />}
                </FormField>
              )}

              {depositAmount > 0 && method !== 'CASH' && (
                <FormField name="reference" label="Referencia" hint="Últimos dígitos, autorización…">
                  {({ id }) => (
                    <Input
                      id={id}
                      value={reference}
                      onChange={(event) => setReference(event.target.value)}
                    />
                  )}
                </FormField>
              )}

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

              <Separator />
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Queda a crédito</span>
                <span className="text-xl font-semibold tabular">
                  {formatMoney({ amount: creditRemaining, currency })}
                </span>
              </div>
            </>
          ) : (
            <>
              <FormField name="method" label="Forma de pago" required>
                {({ id }) => <PaymentMethodPicker id={id} value={method} onChange={setMethod} />}
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
            disabled={createSale.isPending || cart.length === 0 || depositInvalid}
            onClick={confirm}
          >
            {createSale.isPending ? 'Confirmando…' : 'Confirmar venta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
