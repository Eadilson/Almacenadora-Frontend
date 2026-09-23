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
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Pagination } from '@/components/data/Pagination.jsx';
import { FormField } from '@/components/forms/FormField.jsx';
import { usePermission } from '@/hooks/usePermission';
import { useSession } from '@/hooks/useSession';
import { useDialogSubmit } from '@/hooks/useDialogSubmit';
import { formatMoney } from '@/lib/money';
import { formatDate, formatDateTime, formatQuantity } from '@/lib/format';
import { useInventoryMutations, useKardex } from '../hooks/useInventory.js';

/**
 * Cómo nombrar la entrada de la que salió una unidad: su propio documento si
 * tiene uno (una compra), o su tipo si es de las que no lo tienen (un ajuste,
 * el saldo inicial).
 *
 * @param {{ type: string, typeLabel: string, reference: any } | null} source
 * @returns {string}
 */
function originLabel(source) {
  if (!source) return 'origen sin registrar';
  return source.reference?.docNumber
    ? `${source.typeLabel} ${source.reference.docNumber}`
    : source.typeLabel;
}

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

  const branchId = activeBranchId ?? user?.branches?.[0]?.id ?? searchParams.get('branchId') ?? '';
  const [page, setPage] = useState(1);
  const [correcting, setCorrecting] = useState(/** @type {any} */ (null));
  const [reason, setReason] = useState('');
  const {
    error: correctError,
    clearError: clearCorrectError,
    submitting: correctSubmitting,
    run: runCorrect,
  } = useDialogSubmit();

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

  async function submitCorrection() {
    const ok = await runCorrect(() => correct.mutateAsync({ movementId: correcting.id, reason }));
    if (!ok) return;
    setCorrecting(null);
    setReason('');
    void refetch();
  }

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
            {/* De qué entrada salió: solo tiene sentido en una salida, y solo
                desde que existe esta función — una salida anterior no lleva nada. */}
            {row.direction === 'OUT' && row.consumedFrom?.length > 0 && (
              <>
                {row.consumedFrom.length === 1 ? (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    De {originLabel(row.consumedFrom[0].source)}
                    {row.consumedFrom[0].source && ` · ${formatDate(row.consumedFrom[0].source.occurredAt)}`}
                  </p>
                ) : (
                  <details className="mt-0.5">
                    <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                      De {row.consumedFrom.length} entradas
                    </summary>
                    <ul className="mt-1 space-y-0.5 pl-3 text-xs text-muted-foreground">
                      {row.consumedFrom.map((entry, index) => (
                        <li key={index}>
                          {formatQuantity(entry.quantity)} de {originLabel(entry.source)}
                          {entry.source && ` · ${formatDate(entry.source.occurredAt)}`}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
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
                    // La misma instancia de useDialogSubmit se reutiliza para
                    // movimientos distintos: sin esto, el error del intento
                    // anterior seguía visible al abrir el diálogo para este otro.
                    clearCorrectError();
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

        <Pagination meta={meta} onPageChange={setPage} />
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

          {correctError && (
            <Alert variant="destructive">
              <AlertDescription>{correctError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrecting(null)}>
              Cancelar
            </Button>
            <Button
              disabled={reason.trim().length < 5 || correct.isPending || correctSubmitting}
              onClick={() => void submitCorrection()}
            >
              {correct.isPending || correctSubmitting ? 'Registrando…' : 'Registrar corrección'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
