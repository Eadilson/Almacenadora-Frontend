import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, Printer, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Input } from '@/components/ui/input.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { FormField } from '@/components/forms/FormField.jsx';
import { ErrorState, PageLoader } from '@/components/feedback/states.jsx';
import { usePermission } from '@/hooks/usePermission';
import { useDialogSubmit } from '@/hooks/useDialogSubmit';
import { formatMoney } from '@/lib/money';
import { formatDateTime, formatQuantity } from '@/lib/format';
import { useSale, useSalesMutations } from '../hooks/useSales.js';

/**
 * Detalle de una venta.
 *
 * Muestra lo vendido tal como quedó registrado, con los datos del cliente y los
 * precios del momento. Una venta confirmada no se edita: se anula, y la anulación
 * queda visible junto a ella.
 */
export function SaleDetailPage() {
  const { id } = useParams();
  const { can } = usePermission();
  const { data: sale, isPending, isError, error, refetch } = useSale(id ?? null);
  const { voidSale, returnSale } = useSalesMutations();

  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState('');

  const [returning, setReturning] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  /** @type {[Record<string, string>, Function]} */
  const [returnQuantities, setReturnQuantities] = useState({});
  const { error: returnError, clearError: clearReturnError, submitting, run } = useDialogSubmit();

  // Solo las líneas con algo pendiente tienen sentido en el diálogo: una que ya se
  // devolvió por completo no necesita una casilla que nunca se va a usar.
  const returnableLines = useMemo(
    () => (sale?.lines ?? []).filter((line) => Number(line.returnableQuantity ?? line.quantity) > 0),
    [sale],
  );

  if (isPending) return <PageLoader label="Cargando venta…" />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const canSeeProfit = can('products:cost:read');

  const returnLines = returnableLines
    .map((line) => ({ productId: line.productId, quantity: returnQuantities[line.productId] ?? '' }))
    .filter((entry) => Number(entry.quantity) > 0);

  async function submitReturn() {
    const ok = await run(() =>
      returnSale.mutateAsync({
        id: /** @type {string} */ (id),
        reason: returnReason,
        lines: returnLines,
      }),
    );

    if (!ok) return;
    setReturning(false);
    setReturnReason('');
    setReturnQuantities({});
    void refetch();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3 no-print">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="-ml-3" asChild>
            <Link to="/ventas">
              <ArrowLeft aria-hidden="true" />
              Ventas
            </Link>
          </Button>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold tracking-tight">{sale.number}</h1>
            <Badge variant={sale.status === 'VOIDED' ? 'destructive' : 'success'}>
              {sale.statusLabel}
            </Badge>
            <Badge variant="secondary">{sale.typeLabel}</Badge>
          </div>

          <p className="text-sm text-muted-foreground">
            {formatDateTime(sale.issuedAt)}
            {sale.invoiceNumber && <> · factura {sale.invoiceNumber}</>}
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer aria-hidden="true" />
            Imprimir
          </Button>

          {(sale.status === 'CONFIRMED' || sale.status === 'PARTIALLY_RETURNED') &&
            can('sales:return') &&
            returnableLines.length > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  clearReturnError();
                  setReturning(true);
                }}
              >
                <Undo2 aria-hidden="true" />
                Devolver
              </Button>
            )}

          {sale.status === 'CONFIRMED' && can('sales:void') && (
            <Button variant="outline" onClick={() => setVoiding(true)}>
              <Ban aria-hidden="true" />
              Anular
            </Button>
          )}
        </div>
      </header>

      {sale.status === 'VOIDED' && (
        <Alert variant="destructive">
          <Ban aria-hidden="true" />
          <AlertDescription>
            Venta anulada{sale.voidedAt && ` el ${formatDateTime(sale.voidedAt)}`}
            {sale.voidReason && `: ${sale.voidReason}`}. La mercancía volvió al inventario.
          </AlertDescription>
        </Alert>
      )}

      {(sale.status === 'PARTIALLY_RETURNED' || sale.status === 'RETURNED') && (
        <Alert variant="warning">
          <Undo2 aria-hidden="true" />
          <AlertDescription>
            {sale.status === 'RETURNED'
              ? 'Se devolvió todo lo vendido en esta factura.'
              : 'Parte de esta venta se devolvió.'}{' '}
            La factura sigue siendo válida por lo que sí se quedó el cliente; cada devolución tiene
            su propia nota de crédito.
          </AlertDescription>
        </Alert>
      )}

      {sale.creditNotes?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notas de crédito</CardTitle>
            <CardDescription>Documentan cada devolución de esta venta.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {sale.creditNotes.map((note) => (
                <li key={note.id} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    <span className="font-mono">{note.number}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {formatDateTime(note.issuedAt)}
                    </span>
                  </span>
                  <span className="tabular font-medium">{formatMoney(note.total)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cliente</CardTitle>
          <CardDescription>
            {sale.customer?.name ?? 'Consumidor final'}
            {sale.customer?.taxId && ` · ${sale.customer.taxId}`}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Productos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="scroll-x">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Producto</th>
                  <th className="pb-2 text-right font-medium">Cant.</th>
                  <th className="pb-2 text-right font-medium">Precio</th>
                  {canSeeProfit && <th className="pb-2 text-right font-medium">Costo</th>}
                  <th className="pb-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sale.lines.map((line) => (
                  <tr key={line.productId}>
                    <td className="py-2 pr-3">
                      <p className="font-medium">{line.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{line.sku}</p>
                    </td>
                    <td className="py-2 pr-3 text-right tabular">{formatQuantity(line.quantity)}</td>
                    <td className="py-2 pr-3 text-right tabular">{formatMoney(line.unitPrice)}</td>
                    {canSeeProfit && (
                      <td className="py-2 pr-3 text-right tabular text-muted-foreground">
                        {line.unitCost ? formatMoney(line.unitCost) : '—'}
                      </td>
                    )}
                    <td className="py-2 text-right tabular">{formatMoney(line.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Separator className="my-4" />

          <dl className="ml-auto max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular">{formatMoney(sale.subtotal)}</dd>
            </div>

            {sale.discountTotal.amount > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Descuento</dt>
                <dd className="tabular">−{formatMoney(sale.discountTotal)}</dd>
              </div>
            )}

            {sale.taxTotal.amount > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  Impuesto{sale.pricesIncludeTax ? ' (incluido)' : ''}
                </dt>
                <dd className="tabular">{formatMoney(sale.taxTotal)}</dd>
              </div>
            )}

            <div className="flex justify-between border-t pt-1.5 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular">{formatMoney(sale.total)}</dd>
            </div>

            {sale.creditAmount.amount > 0 && (
              <div className="flex justify-between text-warning">
                <dt>Queda a deber</dt>
                <dd className="tabular">{formatMoney(sale.creditAmount)}</dd>
              </div>
            )}

            {canSeeProfit && sale.grossProfit && (
              <div className="flex justify-between border-t pt-1.5 text-muted-foreground">
                <dt>Utilidad</dt>
                <dd className="tabular">
                  {formatMoney(sale.grossProfit)}
                  {sale.marginBasisPoints !== null && (
                    <span className="ml-1 text-xs">
                      ({(sale.marginBasisPoints / 100).toFixed(1)}%)
                    </span>
                  )}
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {sale.payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cobro</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {sale.payments.map((payment, index) => (
                <li key={index} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    {payment.method}
                    {payment.reference && (
                      <span className="ml-2 text-xs text-muted-foreground">{payment.reference}</span>
                    )}
                  </span>
                  <span className="tabular font-medium">{formatMoney(payment.amount)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {sale.dueDate && (
        <Alert variant="warning">
          <AlertDescription>
            Vence el {formatDateTime(sale.dueDate)} · plazo de {sale.creditTermDays} días.
          </AlertDescription>
        </Alert>
      )}

      <Dialog open={voiding} onOpenChange={setVoiding}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular venta</DialogTitle>
            <DialogDescription>
              La mercancía volverá al inventario y la factura quedará anulada. Nada se borra: la
              venta y su anulación quedan en el historial.
            </DialogDescription>
          </DialogHeader>

          <FormField name="voidReason" label="Motivo" required>
            {({ id: fieldId }) => (
              <Textarea
                id={fieldId}
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="El cliente devolvió la mercancía antes de salir."
              />
            )}
          </FormField>

          <DialogFooter>
            <Button variant="outline" onClick={() => setVoiding(false)}>
              Volver
            </Button>
            <Button
              variant="destructive"
              disabled={reason.trim().length < 5 || voidSale.isPending}
              onClick={async () => {
                await voidSale.mutateAsync({ id: /** @type {string} */ (id), reason });
                setVoiding(false);
                void refetch();
              }}
            >
              {voidSale.isPending ? 'Anulando…' : 'Anular venta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={returning} onOpenChange={setReturning}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Devolver productos</DialogTitle>
            <DialogDescription>
              La factura sigue siendo válida por lo que sí se quedó el cliente: esto emite una nota
              de crédito por lo que se devuelve y regresa la mercancía al inventario.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {returnableLines.map((line) => (
              <div key={line.productId} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{line.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Vendidas {formatQuantity(line.quantity)}
                    {Number(line.returnedQuantity) > 0 &&
                      ` · ya devueltas ${formatQuantity(line.returnedQuantity)}`}{' '}
                    · disponible {formatQuantity(line.returnableQuantity)}
                  </p>
                </div>
                <Input
                  type="number"
                  min="0"
                  max={line.returnableQuantity}
                  step="any"
                  className="w-24 text-right tabular"
                  placeholder="0"
                  value={returnQuantities[line.productId] ?? ''}
                  onChange={(event) =>
                    setReturnQuantities((current) => ({
                      ...current,
                      [line.productId]: event.target.value,
                    }))
                  }
                />
              </div>
            ))}
          </div>

          <FormField name="returnReason" label="Motivo" required>
            {({ id: fieldId }) => (
              <Textarea
                id={fieldId}
                rows={3}
                value={returnReason}
                onChange={(event) => setReturnReason(event.target.value)}
                placeholder="El cliente trajo el producto con un defecto de fábrica."
              />
            )}
          </FormField>

          {returnError && (
            <Alert variant="destructive">
              <AlertDescription>{returnError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReturning(false)}>
              Volver
            </Button>
            <Button
              variant="destructive"
              disabled={
                returnReason.trim().length < 5 || returnLines.length === 0 || submitting
              }
              onClick={() => void submitReturn()}
            >
              {submitting ? 'Devolviendo…' : 'Registrar devolución'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
