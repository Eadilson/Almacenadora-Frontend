import { useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  CircleDollarSign,
  Clock3,
  HandCoins,
  Landmark,
  LockKeyhole,
  ReceiptText,
  Undo2,
  Vault,
  WalletCards,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { PageHeader } from '@/components/ui/page-header.jsx';
import { DataTable } from '@/components/data/DataTable.jsx';
import { Pagination } from '@/components/data/Pagination.jsx';
import { EmptyState, ErrorState, PageLoader } from '@/components/feedback/states.jsx';
import { usePermission } from '@/hooks/usePermission';
import { useSession } from '@/hooks/useSession';
import { formatDateTime } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import {
  useCashMutations,
  useCashSession,
  useCashSessions,
  useCurrentCash,
} from '../hooks/useCash.js';
import { CashMovementDialog, CloseCashDialog, OpenCashDialog } from '../components/CashDialogs.jsx';

const MOVEMENT_TONES = {
  CASH_IN: 'success',
  EXPENSE: 'warning',
  WITHDRAWAL: 'secondary',
  REFUND: 'destructive',
};

function Metric({ label, value, icon, detail, prominent = false }) {
  return (
    <Card className={prominent ? 'border-foreground/25 bg-foreground text-background' : ''}>
      <CardContent className="flex min-h-32 items-start justify-between gap-4 p-5">
        <div className="min-w-0 space-y-3">
          <p
            className={`text-xs font-semibold uppercase tracking-[0.14em] ${prominent ? 'text-background/65' : 'text-muted-foreground'}`}
          >
            {label}
          </p>
          <p className="text-2xl font-semibold tabular-nums sm:text-3xl">{value}</p>
          {detail && (
            <p className={`text-xs ${prominent ? 'text-background/65' : 'text-muted-foreground'}`}>
              {detail}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 ${prominent ? 'text-background/70' : 'text-muted-foreground'}`}
          aria-hidden="true"
        >
          {icon}
        </span>
      </CardContent>
    </Card>
  );
}

export function CashPage() {
  const { activeBranchId, tenant, user } = useSession();
  const { can, canAny } = usePermission();
  const branchId = activeBranchId ?? user?.branches?.[0]?.id;
  const branch = user?.branches?.find((item) => item.id === branchId);
  const currency = tenant?.currency ?? 'GTQ';
  const mutations = useCashMutations();

  const [opening, setOpening] = useState(false);
  const [closing, setClosing] = useState(false);
  const [movementType, setMovementType] = useState(null);
  const [movementPage, setMovementPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);

  const currentQuery = useCurrentCash(branchId);
  const current = currentQuery.data;
  const detailQuery = useCashSession(current?.id, { page: movementPage, limit: 10 });
  const historyFilters = useMemo(
    () => ({ page: historyPage, limit: 10 }),
    [historyPage],
  );
  const historyQuery = useCashSessions(historyFilters);

  const currentDetail = detailQuery.data ?? current;
  const summary = currentDetail?.summary;
  const movementRows = currentDetail?.movements ?? [];

  const movementColumns = [
    {
      key: 'occurredAt',
      header: 'Hora',
      render: (row) => (
        <span className="whitespace-nowrap text-sm">{formatDateTime(row.occurredAt)}</span>
      ),
    },
    {
      key: 'type',
      header: 'Movimiento',
      render: (row) => (
        <Badge variant={MOVEMENT_TONES[row.type] ?? 'secondary'}>{row.typeLabel}</Badge>
      ),
    },
    {
      key: 'reason',
      header: 'Motivo',
      render: (row) => (
        <div className="max-w-lg">
          <p className="font-medium">{row.reason}</p>
          {row.reference && (
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{row.reference}</p>
          )}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Importe',
      numeric: true,
      render: (row) => (
        <span
          className={`font-semibold tabular-nums ${row.direction === 'IN' ? 'text-success' : 'text-foreground'}`}
        >
          {row.direction === 'IN' ? '+' : '−'} {formatMoney(row.amount)}
        </span>
      ),
    },
  ];

  const historyRows = historyQuery.data?.items ?? [];
  const historyColumns = [
    { key: 'openedAt', header: 'Apertura', render: (row) => formatDateTime(row.openedAt) },
    {
      key: 'closedAt',
      header: 'Cierre',
      render: (row) => (row.closedAt ? formatDateTime(row.closedAt) : 'En curso'),
    },
    {
      key: 'openingFloat',
      header: 'Fondo',
      numeric: true,
      render: (row) => formatMoney(row.openingFloat),
    },
    {
      key: 'expectedCash',
      header: 'Esperado',
      numeric: true,
      render: (row) => formatMoney(row.expectedCash),
    },
    {
      key: 'countedCash',
      header: 'Contado',
      numeric: true,
      render: (row) => formatMoney(row.countedCash),
    },
    {
      key: 'difference',
      header: 'Diferencia',
      numeric: true,
      render: (row) => (
        <span
          className={
            row.difference?.amount ? 'font-semibold text-destructive' : 'text-muted-foreground'
          }
        >
          {formatMoney(row.difference)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => (
        <Badge variant={row.isOpen ? 'success' : 'secondary'}>
          {row.isOpen ? 'Abierta' : 'Cerrada'}
        </Badge>
      ),
    },
  ];

  if (currentQuery.isPending) return <PageLoader label="Consultando la caja de la sucursal…" />;
  if (currentQuery.isError) {
    return <ErrorState error={currentQuery.error} onRetry={() => void currentQuery.refetch()} />;
  }

  const openMovement = (type) => {
    setMovementType(type);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Caja"
        icon={Landmark}
        description={`Efectivo operativo de ${branch?.name ?? 'la sucursal activa'}. Ventas y abonos se incorporan automáticamente.`}
      >
        {current && can('cash:close') && (
          <Button variant="outline" onClick={() => setClosing(true)}>
            <LockKeyhole aria-hidden="true" />
            Cerrar caja
          </Button>
        )}
      </PageHeader>

      {!current ? (
        <EmptyState
          icon={Vault}
          title="La caja está cerrada"
          description="Registre el fondo inicial para comenzar una jornada de efectivo en esta sucursal."
          className="min-h-72"
          action={
            can('cash:open') ? (
              <Button onClick={() => setOpening(true)}>
                <Banknote aria-hidden="true" />
                Abrir caja
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <section className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-40" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-success" />
                </span>
                <p className="text-sm font-semibold text-success">Jornada abierta</p>
              </div>
              <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Clock3 className="size-4" aria-hidden="true" />
                Desde {formatDateTime(current.openedAt)}
              </p>
            </div>

            {canAny(['cash:movement:create']) && (
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Button variant="outline" onClick={() => openMovement('CASH_IN')}>
                  <ArrowDownToLine aria-hidden="true" /> Ingreso
                </Button>
                <Button variant="outline" onClick={() => openMovement('EXPENSE')}>
                  <ReceiptText aria-hidden="true" /> Gasto
                </Button>
                <Button variant="outline" onClick={() => openMovement('WITHDRAWAL')}>
                  <ArrowUpFromLine aria-hidden="true" /> Retiro
                </Button>
                <Button variant="outline" onClick={() => openMovement('REFUND')}>
                  <Undo2 aria-hidden="true" /> Devolución
                </Button>
              </div>
            )}
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Efectivo esperado"
              value={formatMoney(summary?.expectedCash)}
              icon={<WalletCards className="size-5" />}
              prominent
              detail="Disponible según el sistema"
            />
            <Metric
              label="Ventas en efectivo"
              value={formatMoney(summary?.salesCash)}
              icon={<CircleDollarSign className="size-5" />}
              detail="Cobros del punto de venta"
            />
            <Metric
              label="Abonos en efectivo"
              value={formatMoney(summary?.paymentsCash)}
              icon={<HandCoins className="size-5" />}
              detail="Cobranza recibida en esta caja"
            />
            <Metric
              label="Fondo inicial"
              value={formatMoney(current.openingFloat)}
              icon={<Banknote className="size-5" />}
              detail="Efectivo al abrir"
            />
          </section>

          {(summary?.expenses?.amount > 0 ||
            summary?.withdrawals?.amount > 0 ||
            summary?.refunds?.amount > 0) && (
            <Alert variant="info">
              <AlertTitle>Salidas de la jornada</AlertTitle>
              <AlertDescription>
                Gastos {formatMoney(summary.expenses)} · Retiros {formatMoney(summary.withdrawals)}{' '}
                · Devoluciones {formatMoney(summary.refunds)}
              </AlertDescription>
            </Alert>
          )}

          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Movimientos manuales</h2>
              <p className="text-sm text-muted-foreground">
                Ventas y abonos ya están incluidos arriba; aquí solo aparecen ajustes físicos.
              </p>
            </div>
            <DataTable
              columns={movementColumns}
              rows={movementRows}
              isPending={detailQuery.isPending}
              isError={detailQuery.isError}
              error={detailQuery.error}
              onRetry={() => void detailQuery.refetch()}
              emptyTitle="Sin movimientos manuales"
              emptyDescription="La jornada solo contiene los cobros automáticos del sistema."
            />
            <Pagination
              meta={currentDetail?.movementMeta ?? {}}
              onPageChange={setMovementPage}
              itemLabel="movimientos"
            />
          </section>
        </>
      )}

      <section className="space-y-4 border-t border-border pt-6">
        <div>
          <h2 className="text-lg font-semibold">Historial de jornadas</h2>
          <p className="text-sm text-muted-foreground">Arqueos conservados para esta sucursal.</p>
        </div>
        <DataTable
          columns={historyColumns}
          rows={historyRows}
          isPending={historyQuery.isPending}
          isError={historyQuery.isError}
          error={historyQuery.error}
          onRetry={() => void historyQuery.refetch()}
          emptyTitle="Todavía no hay cierres"
          emptyDescription="La primera jornada aparecerá aquí en cuanto abra la caja."
        />
        <Pagination
          meta={historyQuery.data?.meta ?? {}}
          onPageChange={setHistoryPage}
          itemLabel="jornadas"
        />
      </section>

      <OpenCashDialog
        open={opening}
        onOpenChange={setOpening}
        currency={currency}
        mutation={mutations.open}
      />
      {current && (
        <>
          <CashMovementDialog
            open={Boolean(movementType)}
            onOpenChange={(open) => !open && setMovementType(null)}
            sessionId={current.id}
            currency={currency}
            initialType={movementType ?? 'CASH_IN'}
            mutation={mutations.addMovement}
          />
          <CloseCashDialog
            open={closing}
            onOpenChange={setClosing}
            session={currentDetail}
            currency={currency}
            mutation={mutations.close}
          />
        </>
      )}
    </div>
  );
}
