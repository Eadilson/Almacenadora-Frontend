import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { DataTable } from '@/components/data/DataTable.jsx';
import { ErrorState, PageLoader } from '@/components/feedback/states.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { FormField } from '@/components/forms/FormField.jsx';
import { usePermission } from '@/hooks/usePermission';
import { useSession } from '@/hooks/useSession';
import { formatMoney } from '@/lib/money';
import { formatDateTime, formatQuantity } from '@/lib/format';
import { useInventoryMutations, useKardex } from '../hooks/useInventory.js';

/**
 * Kardex de un producto.
 *
 * Es el documento que explica de dónde salió la existencia actual: cada movimiento
 * con su saldo resultante. Un inventario sin esto es un número que nadie puede
 * defender ante una revisión.
 */
export function KardexPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { can } = usePermission();
  const { user, activeBranchId } = useSession();

  const branchId = searchParams.get('branchId') ?? activeBranchId ?? user?.branches?.[0]?.id ?? '';
  const [page, setPage] = useState(1);
  const [correcting, setCorrecting] = useState(/** @type {any} */ (null));
  const [reason, setReason] = useState('');

  const { data, isPending, isError, error, refetch } = useKardex(id ?? null, {
    branchId: branchId || undefined,
    page,
    limit: 50,
  });

  const { correct } = useInventoryMutations();
  const canAdjust = can('stock:adjust');
  const canSeeCost = can('products:cost:read');

  if (isPending) return <PageLoader label="Cargando kardex…" />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const { product, stock, movements, meta } = data;

  const columns = [
    {
      key: 'seq',
      header: '#',
      numeric: true,
      className: 'w-px',
      render: (row) => <span className="text-xs text-muted-foreground">{row.seq}</span>,
    },
    {
      key: 'occurredAt',
      header: 'Fecha',
      render: (row) => <span className="text-sm">{formatDateTime(row.occurredAt)}</span>,
    },
    {
      key: 'type',
      header: 'Movimiento',
      render: (row) => (
        <div className="flex items-center gap-2">
          {row.direction === 'IN' ? (
            <ArrowDownLeft className="size-4 shrink-0 text-success" aria-hidden="true" />
          ) : (
            <ArrowUpRight className="size-4 shrink-0 text-destructive" aria-hidden="true" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.typeLabel}</p>
            {row.correctionOf && (
              <Badge variant="outline" className="mt-0.5 text-[10px]">
                Corrección
              </Badge>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Motivo',
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.reason ?? row.reference?.docNumber ?? '—'}
        </span>
      ),
    },
    {
      key: 'quantity',
      header: 'Cantidad',
      numeric: true,
      render: (row) => (
        <span className={row.direction === 'IN' ? 'text-success' : 'text-destructive'}>
          {row.direction === 'IN' ? '+' : '−'}
          {formatQuantity(row.quantity)}
        </span>
      ),
    },
    {
      key: 'balanceAfter',
      header: 'Saldo',
      numeric: true,
      // La columna que da sentido al kardex: el saldo tras cada movimiento.
      render: (row) => <span className="font-medium">{formatQuantity(row.balanceAfter)}</span>,
    },
    ...(canSeeCost
      ? [
          {
            key: 'unitCost',
            header: 'Costo unit.',
            numeric: true,
            render: (row) => (row.unitCost ? formatMoney(row.unitCost) : '—'),
          },
        ]
      : []),
    ...(canAdjust
      ? [
          {
            key: 'actions',
            header: '',
            className: 'w-px',
            render: (row) =>
              row.correctionOf ? null : (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Corregir movimiento ${row.seq}`}
                  onClick={() => {
                    setCorrecting(row);
                    setReason('');
                  }}
                >
                  <Undo2 aria-hidden="true" />
                </Button>
              ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Button variant="ghost" size="sm" className="-ml-3" asChild>
          <Link to="/existencias">
            <ArrowLeft aria-hidden="true" />
            Existencias
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
        <p className="font-mono text-sm text-muted-foreground">{product.sku}</p>
      </header>

      {stock && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Existencia actual</CardDescription>
              <CardTitle className="text-2xl tabular">{formatQuantity(stock.onHand)}</CardTitle>
            </CardHeader>
          </Card>

          {canSeeCost && stock.averageCost && (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Costo promedio</CardDescription>
                  <CardTitle className="text-2xl">{formatMoney(stock.averageCost)}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Valor en existencia</CardDescription>
                  <CardTitle className="text-2xl">{formatMoney(stock.valuation)}</CardTitle>
                </CardHeader>
              </Card>
            </>
          )}
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-medium">Movimientos</h2>
          <p className="text-sm text-muted-foreground">
            {meta.total} {meta.total === 1 ? 'asiento' : 'asientos'}
          </p>
        </div>

        <DataTable
          columns={columns}
          rows={movements}
          rowKey={(row) => row.id}
          emptyTitle="Sin movimientos"
          emptyDescription="Este producto todavía no tiene existencias registradas en esta sucursal."
        />

        {meta.totalPages > 1 && (
          <nav className="flex items-center justify-between gap-4" aria-label="Paginación">
            <p className="text-sm text-muted-foreground">
              Página {meta.page} de {meta.totalPages}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={!meta.hasPrev} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={!meta.hasNext} onClick={() => setPage((p) => p + 1)}>
                Siguiente
              </Button>
            </div>
          </nav>
        )}
      </section>

      {/* Corregir es compensar: el original se conserva siempre. */}
      <Dialog open={Boolean(correcting)} onOpenChange={(open) => !open && setCorrecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Corregir movimiento</DialogTitle>
            <DialogDescription>
              Se registrará un movimiento inverso de {correcting && formatQuantity(correcting.quantity)}{' '}
              unidades. El original no se borra: ambos quedan en el historial.
            </DialogDescription>
          </DialogHeader>

          <FormField name="correctionReason" label="Motivo de la corrección" required>
            {({ id: fieldId }) => (
              <Textarea
                id={fieldId}
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="La pérdida se registró por error: el producto apareció."
              />
            )}
          </FormField>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrecting(null)}>
              Cancelar
            </Button>
            <Button
              disabled={reason.trim().length < 5 || correct.isPending}
              onClick={async () => {
                await correct.mutateAsync({ movementId: correcting.id, reason });
                setCorrecting(null);
                void refetch();
              }}
            >
              {correct.isPending ? 'Registrando…' : 'Registrar corrección'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
