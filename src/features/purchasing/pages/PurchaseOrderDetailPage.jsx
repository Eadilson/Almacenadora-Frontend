import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, PackageCheck, Truck, X } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Separator } from '@/components/ui/separator.jsx';
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
import { formatMoney } from '@/lib/money';
import { formatDate, formatDateTime, formatQuantity } from '@/lib/format';
import { usePurchaseOrder, usePurchasingMutations } from '../hooks/usePurchasing.js';

const STATUS_VARIANTS = {
  DRAFT: 'outline',
  CONFIRMED: 'default',
  PARTIALLY_RECEIVED: 'warning',
  RECEIVED: 'success',
  CANCELLED: 'secondary',
  CLOSED: 'secondary',
};

/**
 * Detalle de una orden de compra y registro de la recepción.
 *
 * Es la pantalla donde compras se conecta con inventario: al recibir, la mercancía
 * entra con su costo real —el de la factura más su parte del flete— y el costo
 * promedio se recalcula solo.
 */
export function PurchaseOrderDetailPage() {
  const { id } = useParams();
  const { can } = usePermission();
  const { data: order, isPending, isError, error, refetch } = usePurchaseOrder(id ?? null);
  const { confirmOrder, cancelOrder, receive } = usePurchasingMutations();

  const [receiving, setReceiving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [quantities, setQuantities] = useState(/** @type {Record<string, string>} */ ({}));
  const [receiptError, setReceiptError] = useState('');

  if (isPending) return <PageLoader label="Cargando orden…" />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const openReceive = () => {
    // Se propone recibir todo lo pendiente: es lo que ocurre la mayoría de las
    // veces, y así el usuario solo corrige las líneas que llegaron incompletas.
    setQuantities(
      Object.fromEntries(
        order.lines
          .filter((line) => Number(line.pendingQty) > 0)
          .map((line) => [line.productId, line.pendingQty]),
      ),
    );
    setReceiptError('');
    setReceiving(true);
  };

  const submitReceipt = async () => {
    const lines = Object.entries(quantities)
      .filter(([, quantity]) => Number(String(quantity).replace(',', '.')) > 0)
      .map(([productId, quantity]) => ({
        productId,
        quantity: String(quantity).replace(',', '.'),
      }));

    if (lines.length === 0) {
      setReceiptError('Indique al menos una cantidad recibida.');
      return;
    }

    try {
      await receive.mutateAsync({ id: /** @type {string} */ (id), lines });
      setReceiving(false);
      void refetch();
    } catch (mutationError) {
      const apiError = /** @type {any} */ (mutationError);
      setReceiptError(apiError?.message ?? 'No se pudo registrar la recepción.');
    }
  };

  const canReceive = can('purchases:receive') && order.isReceivable;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="-ml-3" asChild>
            <Link to="/compras">
              <ArrowLeft aria-hidden="true" />
              Compras
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold tracking-tight">{order.number}</h1>
            <Badge variant={STATUS_VARIANTS[order.status] ?? 'secondary'}>{order.statusLabel}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {order.supplier.name} · emitida {formatDate(order.issuedAt)}
            {order.expectedAt && <> · esperada {formatDate(order.expectedAt)}</>}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {order.status === 'DRAFT' && can('purchases:approve') && (
            <Button disabled={confirmOrder.isPending} onClick={() => confirmOrder.mutate(order.id)}>
              <CheckCircle2 aria-hidden="true" />
              Confirmar
            </Button>
          )}

          {canReceive && (
            <Button onClick={openReceive}>
              <PackageCheck aria-hidden="true" />
              Recibir mercancía
            </Button>
          )}

          {!order.hasReceipts && order.status !== 'CANCELLED' && can('purchases:void') && (
            <Button variant="outline" onClick={() => setCancelling(true)}>
              <X aria-hidden="true" />
              Cancelar
            </Button>
          )}
        </div>
      </header>

      {order.status === 'DRAFT' && (
        <Alert variant="info">
          <Truck aria-hidden="true" />
          <AlertDescription>
            La orden está en borrador. Confírmela para poder registrar la recepción de la mercancía.
          </AlertDescription>
        </Alert>
      )}

      {order.status === 'CANCELLED' && (
        <Alert variant="warning">
          <X aria-hidden="true" />
          <AlertDescription>
            Orden cancelada{order.cancelledAt && ` el ${formatDate(order.cancelledAt)}`}
            {order.cancelReason && `: ${order.cancelReason}`}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Productos</CardTitle>
          {order.additionalCostsTotal.amount > 0 && (
            <CardDescription>
              El costo real incluye el reparto de {formatMoney(order.additionalCostsTotal)} en cargos
              adicionales.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="scroll-x">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Producto</th>
                  <th className="pb-2 text-right font-medium">Pedido</th>
                  <th className="pb-2 text-right font-medium">Recibido</th>
                  <th className="pb-2 text-right font-medium">Costo factura</th>
                  <th className="pb-2 text-right font-medium">Costo real</th>
                  <th className="pb-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {order.lines.map((line) => {
                  const complete = Number(line.pendingQty) === 0;

                  return (
                    <tr key={line.productId}>
                      <td className="py-2 pr-3">
                        <p className="font-medium">{line.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{line.sku}</p>
                      </td>
                      <td className="py-2 pr-3 text-right tabular">{formatQuantity(line.quantity)}</td>
                      <td className="py-2 pr-3 text-right tabular">
                        <span className={complete ? 'text-success' : 'text-warning'}>
                          {formatQuantity(line.receivedQty)}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right tabular text-muted-foreground">
                        {formatMoney(line.unitCost)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular font-medium">
                        {formatMoney(line.landedUnitCost)}
                      </td>
                      <td className="py-2 text-right tabular">{formatMoney(line.lineTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Separator className="my-4" />

          <dl className="ml-auto max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular">{formatMoney(order.subtotal)}</dd>
            </div>
            {order.additionalCosts.map((cost) => (
              <div key={cost.concept} className="flex justify-between">
                <dt className="text-muted-foreground">
                  {cost.concept}
                  <span className="ml-1 text-xs">
                    ({cost.distribution === 'BY_VALUE' ? 'por valor' : 'por cantidad'})
                  </span>
                </dt>
                <dd className="tabular">{formatMoney(cost.amount)}</dd>
              </div>
            ))}
            <div className="flex justify-between border-t pt-1.5 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular">{formatMoney(order.total)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {order.receipts?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recepciones</CardTitle>
            <CardDescription>Cada una generó movimientos de entrada en el kardex.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {order.receipts.map((receipt) => (
                <li key={receipt.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="font-mono text-sm">{receipt.number}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(receipt.receivedAt)} ·{' '}
                      {receipt.lines.length} {receipt.lines.length === 1 ? 'producto' : 'productos'}
                    </p>
                  </div>
                  <span className="tabular text-sm font-medium">{formatMoney(receipt.total)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {order.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm text-muted-foreground">{order.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Recepción */}
      <Dialog open={receiving} onOpenChange={setReceiving}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recibir mercancía</DialogTitle>
            <DialogDescription>
              Lo que registre aquí entra al inventario con su costo real y actualiza el costo
              promedio de cada producto.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {order.lines
              .filter((line) => Number(line.pendingQty) > 0)
              .map((line) => (
                <div key={line.productId} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{line.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Pendiente: {formatQuantity(line.pendingQty)} de {formatQuantity(line.quantity)}
                    </p>
                  </div>
                  <Input
                    value={quantities[line.productId] ?? ''}
                    onChange={(event) =>
                      setQuantities((current) => ({
                        ...current,
                        [line.productId]: event.target.value,
                      }))
                    }
                    inputMode="decimal"
                    className="w-28 text-right tabular"
                    aria-label={`Cantidad recibida de ${line.name}`}
                  />
                </div>
              ))}

            {receiptError && (
              <Alert variant="destructive">
                <AlertDescription>{receiptError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiving(false)}>
              Cancelar
            </Button>
            <Button disabled={receive.isPending} onClick={submitReceipt}>
              <PackageCheck aria-hidden="true" />
              {receive.isPending ? 'Registrando…' : 'Registrar recepción'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancelación */}
      <Dialog open={cancelling} onOpenChange={setCancelling}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar orden</DialogTitle>
            <DialogDescription>
              Quedará registrada como cancelada, con el motivo y la fecha.
            </DialogDescription>
          </DialogHeader>

          <FormField name="cancelReason" label="Motivo" required>
            {({ id }) => (
              <Textarea
                id={id}
                rows={3}
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="El proveedor quedó sin existencias."
              />
            )}
          </FormField>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelling(false)}>
              Volver
            </Button>
            <Button
              variant="destructive"
              disabled={cancelReason.trim().length < 5 || cancelOrder.isPending}
              onClick={async () => {
                await cancelOrder.mutateAsync({ id: /** @type {string} */ (id), reason: cancelReason });
                setCancelling(false);
                void refetch();
              }}
            >
              Cancelar orden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
