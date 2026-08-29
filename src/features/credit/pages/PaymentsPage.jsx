import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ban, Search } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { FormField } from '@/components/forms/FormField.jsx';
import { DataTable } from '@/components/data/DataTable.jsx';
import { usePermission } from '@/hooks/usePermission';
import { useDebounced } from '@/hooks/useDebounced';
import { formatMoney } from '@/lib/money';
import { formatDateTime } from '@/lib/format';
import { useCreditMutations, usePayments } from '../hooks/useCredit.js';

const STATUS_VARIANTS = {
  APPLIED: 'success',
  PARTIALLY_APPLIED: 'warning',
  VOIDED: 'destructive',
};

/**
 * Abonos recibidos.
 *
 * Un abono confirmado no se edita: se anula, y la anulación queda a la vista junto
 * a él. Es dinero que entró en caja y alguien tiene que poder explicar por qué
 * dejó de contar.
 */
export function PaymentsPage() {
  const { can } = usePermission();
  const { voidPayment } = useCreditMutations();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [page, setPage] = useState(1);

  const [voiding, setVoiding] = useState(/** @type {any} */ (null));
  const [reason, setReason] = useState('');

  const debouncedSearch = useDebounced(search, 300);

  const filters = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      status: status || undefined,
      method: method || undefined,
      page,
      limit: 25,
    }),
    [debouncedSearch, status, method, page],
  );

  const { data, isPending, isError, error, refetch } = usePayments(filters);

  const rows = data?.items ?? [];
  const meta = data?.meta ?? {};

  const columns = [
    {
      key: 'number',
      header: 'Recibo',
      render: (/** @type {any} */ row) => <span className="font-mono text-xs">{row.number}</span>,
    },
    {
      key: 'receivedAt',
      header: 'Fecha',
      render: (/** @type {any} */ row) => (
        <span className="text-sm">{formatDateTime(row.receivedAt)}</span>
      ),
    },
    {
      key: 'method',
      header: 'Forma',
      render: (/** @type {any} */ row) => (
        <div>
          <span>{row.methodLabel}</span>
          {row.reference && (
            <p className="font-mono text-xs text-muted-foreground">{row.reference}</p>
          )}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Importe',
      numeric: true,
      render: (/** @type {any} */ row) => (
        <span className="font-medium">{formatMoney(row.amount)}</span>
      ),
    },
    {
      key: 'unappliedAmount',
      header: 'A favor',
      numeric: true,
      render: (/** @type {any} */ row) =>
        row.unappliedAmount.amount > 0 ? (
          formatMoney(row.unappliedAmount)
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'allocations',
      header: 'Facturas',
      numeric: true,
      render: (/** @type {any} */ row) => (
        <span className="tabular text-muted-foreground">{row.allocations.length}</span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (/** @type {any} */ row) => (
        <Badge variant={STATUS_VARIANTS[row.status] ?? 'secondary'}>{row.statusLabel}</Badge>
      ),
    },
    ...(can('payments:void')
      ? [
          {
            key: 'actions',
            header: '',
            render: (/** @type {any} */ row) =>
              row.isVoided ? null : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(/** @type {any} */ event) => {
                    event.stopPropagation();
                    setReason('');
                    setVoiding(row);
                  }}
                >
                  <Ban aria-hidden="true" />
                  Anular
                </Button>
              ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Abonos</h1>
          <p className="text-sm text-muted-foreground">
            Cada abono reduce la deuda del cliente y deja su recibo.
          </p>
        </div>

        <Button variant="outline" asChild>
          <Link to="/creditos">Ver cartera</Link>
        </Button>
      </header>

      <div className="flex flex-wrap gap-3 rounded-lg border bg-card p-4">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar por recibo o referencia…"
            className="pl-9"
            aria-label="Buscar abonos"
          />
        </div>

        <Select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          className="w-48"
          aria-label="Estado"
        >
          <option value="">Todos los estados</option>
          <option value="APPLIED">Aplicados</option>
          <option value="PARTIALLY_APPLIED">Con saldo a favor</option>
          <option value="VOIDED">Anulados</option>
        </Select>

        <Select
          value={method}
          onChange={(event) => {
            setMethod(event.target.value);
            setPage(1);
          }}
          className="w-44"
          aria-label="Forma de pago"
        >
          <option value="">Toda forma</option>
          <option value="CASH">Efectivo</option>
          <option value="CARD">Tarjeta</option>
          <option value="TRANSFER">Transferencia</option>
          <option value="CHECK">Cheque</option>
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        isPending={isPending}
        isError={isError}
        error={error}
        onRetry={() => void refetch()}
        emptyTitle="Sin abonos"
        emptyDescription="Los abonos que registre desde la cartera aparecerán aquí."
      />

      {meta.totalPages > 1 && (
        <nav className="flex items-center justify-between gap-4" aria-label="Paginación">
          <p className="text-sm text-muted-foreground">
            Página {meta.page} de {meta.totalPages} · {meta.total} abonos
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.hasPrev}
              onClick={() => setPage((value) => value - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.hasNext}
              onClick={() => setPage((value) => value + 1)}
            >
              Siguiente
            </Button>
          </div>
        </nav>
      )}

      <Dialog open={Boolean(voiding)} onOpenChange={(open) => !open && setVoiding(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular abono {voiding?.number}</DialogTitle>
            <DialogDescription>
              Las facturas que este abono pagó volverán a quedar pendientes y el saldo del cliente
              subirá {voiding ? formatMoney(voiding.appliedAmount) : ''}. Nada se borra: el abono
              queda visible como anulado.
            </DialogDescription>
          </DialogHeader>

          <FormField name="voidReason" label="Motivo" required>
            {({ id }) => (
              <Textarea
                id={id}
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="El cheque fue devuelto por el banco."
              />
            )}
          </FormField>

          <DialogFooter>
            <Button variant="outline" onClick={() => setVoiding(null)}>
              Volver
            </Button>
            <Button
              variant="destructive"
              disabled={reason.trim().length < 5 || voidPayment.isPending}
              onClick={async () => {
                await voidPayment.mutateAsync({ id: voiding.id, reason });
                setVoiding(null);
              }}
            >
              {voidPayment.isPending ? 'Anulando…' : 'Anular abono'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
