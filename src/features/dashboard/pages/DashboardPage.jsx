import { Suspense, createElement, lazy, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Bell,
  Boxes,
  Clock3,
  CreditCard,
  HandCoins,
  PackagePlus,
  PackageX,
  ShoppingCart,
  Tag,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { PageHeader } from '@/components/ui/page-header.jsx';
import { ErrorState, PageLoader } from '@/components/feedback/states.jsx';
import { ChartFrame } from '@/components/charts/ChartFrame.jsx';
import { usePermission } from '@/hooks/usePermission';
import { useSession } from '@/hooks/useSession';
import { formatMoney } from '@/lib/money';
import { formatDateTime, formatNumber, formatRelative, localISODate } from '@/lib/format';
import { useDashboardReport } from '@/features/reports/hooks/useReports.js';
import { useSalesList } from '@/features/sales/hooks/useSales.js';
import heroImage from '@/assets/dashboard/jewelry-hero.png';

const SalesTrendChart = lazy(() =>
  import('@/features/dashboard/components/SalesTrendChart.jsx').then((module) => ({
    default: module.SalesTrendChart,
  })),
);

const PERIODS = [
  { key: 'today', label: 'Hoy' },
  { key: '7d', label: '7 días' },
  { key: '30d', label: '30 días' },
  { key: '90d', label: '90 días' },
  { key: 'month', label: 'Este mes' },
  { key: 'year', label: 'Este año' },
];

const TONE_STYLES = {
  blue: 'bg-[#edf3ff] text-[#2f68e9]',
  green: 'bg-[#e7f8f2] text-[#07966c]',
  amber: 'bg-[#fff3df] text-[#c87408]',
  rose: 'bg-[#ffebee] text-[#df3149]',
};

/** Panel principal con indicadores del punto de venta activo. */
export function DashboardPage() {
  const { user, tenant, activeBranchId } = useSession();
  const { can } = usePermission();
  const [period, setPeriod] = useState('30d');

  const range = useMemo(() => resolvePeriod(period), [period]);
  const filters = useMemo(
    () => ({ from: range.from, to: range.to, branchId: activeBranchId ?? undefined }),
    [activeBranchId, range],
  );

  const canSeeReports = can('reports:read');
  const canSeeSales = can('sales:read');
  const { data, isPending, isError, error, refetch } = useDashboardReport(filters);
  const { data: recentSalesData } = useSalesList(
    { branchId: activeBranchId ?? undefined, status: 'CONFIRMED', page: 1, limit: 3 },
    { enabled: canSeeSales },
  );

  if (!canSeeReports) return <WelcomePanel user={user} tenant={tenant} />;
  if (isPending) return <PageLoader label="Calculando indicadores…" />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const recentSales = recentSalesData?.items ?? [];
  const financial = Boolean(data.totals.grossProfit);
  const trend = data.comparison.changeBasisPoints;
  const firstName = user?.name?.split(' ')[0] ?? 'usuario';
  const todayLabel = new Intl.DateTimeFormat('es-GT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const metricCards = [
    {
      label: 'Ventas del período',
      value: formatMoney(data.totals.total),
      hint: trend !== null ? `${trend >= 0 ? '+' : ''}${(trend / 100).toFixed(1)}% vs. anterior` : 'Sin comparación',
      icon: TrendingUp,
      tone: 'blue',
      positive: trend === null || trend >= 0,
    },
    {
      label: 'Total de ventas',
      value: formatNumber(data.totals.count),
      hint: `${formatNumber(data.totals.count)} tickets generados`,
      icon: ShoppingCart,
      tone: 'blue',
      positive: true,
    },
    {
      label: 'Ticket promedio',
      value: formatMoney(data.totals.averageTicket),
      hint: 'Promedio por operación',
      icon: Tag,
      tone: 'amber',
      positive: true,
    },
    {
      label: data.portfolio ? 'Por cobrar' : 'Ventas a crédito',
      value: data.portfolio ? formatMoney(data.portfolio.balance) : formatMoney(data.totals.credit),
      hint: data.portfolio?.overdue.amount > 0 ? `${formatMoney(data.portfolio.overdue)} en mora` : 'Cartera controlada',
      icon: CreditCard,
      tone: data.portfolio?.overdue.amount > 0 ? 'rose' : 'green',
      positive: !data.portfolio?.overdue.amount,
    },
  ];

  return (
    <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_292px]">
      <div className="min-w-0 space-y-4">
        <section
          className="relative min-h-[218px] overflow-hidden rounded-2xl border border-border bg-card bg-cover bg-[position:70%_center] px-5 py-7 shadow-[0_16px_34px_-30px_rgb(13_34_61/0.55)] sm:px-7 lg:bg-center lg:px-8"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 to-white/10 dark:from-[#101b2d] dark:via-[#101b2d]/95 dark:to-transparent" />
          <div className="relative z-10 max-w-[620px]">
            <p className="text-[11px] font-semibold uppercase text-[#53647b] [letter-spacing:0.18em] dark:text-white/60">
              {todayLabel}
            </p>
            <h1 className="mt-2 font-serif text-[clamp(2.35rem,3.5vw,3.7rem)] font-semibold leading-[0.98] text-[var(--panel-ink-strong)]">
              Buenos días, {firstName}
            </h1>
            <p className="mt-2 text-base text-[#53647b] dark:text-white/66">
              Que hoy sea un gran día para hacer crecer tu negocio.
            </p>

            <div className="mt-6 flex max-w-[590px] flex-wrap gap-2" aria-label="Período del dashboard">
              {PERIODS.map((option) => (
                <Button
                  key={option.key}
                  variant={period === option.key ? 'default' : 'outline'}
                  size="sm"
                  aria-pressed={period === option.key}
                  onClick={() => setPeriod(option.key)}
                  className={period === option.key ? 'bg-[var(--panel-ink)] hover:bg-[var(--panel-ink)]/90' : 'bg-white/80'}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
          <blockquote className="absolute right-[22%] top-4 z-10 hidden max-w-56 font-serif text-xs italic leading-4 text-[#53647b] 2xl:block">
            “Las grandes historias también comienzan con un detalle.”
          </blockquote>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((card) => <DashboardMetric key={card.label} {...card} />)}
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(270px,0.82fr)]">
          <Suspense fallback={<SalesTrendChartFallback days={range.days} />}>
            <SalesTrendChart points={data.series} days={range.days} currency={data.currency} />
          </Suspense>

          <Card className="h-full">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 p-5 pb-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="size-4" aria-hidden="true" />
                  Resumen financiero
                </CardTitle>
                <CardDescription className="mt-1 text-xs">Período seleccionado</CardDescription>
              </div>
              <Link to="/reportes" className="flex items-center gap-1 text-xs font-semibold text-primary">
                Ver detalles <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-1 px-5 pb-5">
              <FinanceRow
                icon={TrendingUp}
                label={financial ? 'Utilidad' : 'A crédito'}
                value={financial ? formatMoney(data.totals.grossProfit) : formatMoney(data.totals.credit)}
                hint={financial ? `Margen ${(data.totals.marginBasisPoints / 100).toFixed(1)}%` : undefined}
                tone="blue"
              />
              <FinanceRow icon={Wallet} label="Ingresos" value={formatMoney(data.totals.total)} tone="green" />
              <FinanceRow icon={CreditCard} label="A crédito" value={formatMoney(data.totals.credit)} tone="blue" />
              <FinanceRow
                icon={PackageX}
                label="Bajo el mínimo"
                value={`${formatNumber(data.inventory.lowStock)} productos`}
                tone={data.inventory.lowStock > 0 ? 'rose' : 'green'}
              />
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <TopProducts products={data.topProducts} />
          <PaymentMethods rows={data.byPaymentMethod} />
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-5 pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Boxes className="size-4" aria-hidden="true" /> Estado del inventario
              </CardTitle>
              <Link to="/existencias" className="text-xs font-semibold text-primary">Ver más</Link>
            </CardHeader>
            <CardContent className="space-y-4 px-5 pb-5">
              <InventoryLine label="Productos activos" value={formatNumber(data.inventory.activeProducts)} />
              <InventoryLine label="Bajo el mínimo" value={formatNumber(data.inventory.lowStock)} alert={data.inventory.lowStock > 0} />
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-[#2f6bff]"
                  style={{
                    width: `${Math.max(5, Math.min(100, data.inventory.activeProducts > 0
                      ? ((data.inventory.activeProducts - data.inventory.lowStock) / data.inventory.activeProducts) * 100
                      : 100))}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">Disponibilidad general del punto de venta.</p>
            </CardContent>
          </Card>
        </section>
      </div>

      <DashboardRail data={data} recentSales={recentSales} canSeeSales={canSeeSales} />
    </div>
  );
}

function DashboardRail({ data, recentSales, canSeeSales }) {
  return (
    <aside className="grid gap-4 md:grid-cols-2 2xl:sticky 2xl:top-[92px] 2xl:grid-cols-1" aria-label="Actividad del negocio">
      <Card>
        <CardHeader className="p-5 pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Zap className="size-4" /> Acciones rápidas</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 px-5 pb-5">
          <RailAction to="/ventas/nueva" icon={ShoppingCart} label="Nueva venta" primary />
          <RailAction to="/abonos" icon={HandCoins} label="Registrar abono" />
          <RailAction to="/clientes" icon={UserPlus} label="Nuevo cliente" />
          <RailAction to="/productos/nuevo" icon={PackagePlus} label="Nuevo producto" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-5 pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Bell className="size-4" /> Notificaciones</CardTitle>
          <Link to="/movimientos" className="text-xs font-semibold text-primary">Ver todas</Link>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <ul className="space-y-4">
            <Notification
              tone={data.inventory.lowStock > 0 ? 'rose' : 'green'}
              title={data.inventory.lowStock > 0 ? `${data.inventory.lowStock} productos bajo el mínimo` : 'Inventario bajo control'}
              detail="Estado actual"
            />
            <Notification tone="blue" title={`${formatNumber(data.totals.count)} ventas registradas`} detail="Período seleccionado" />
            <Notification tone="green" title="Punto de venta sincronizado" detail="Información actualizada" />
          </ul>
        </CardContent>
      </Card>

      {canSeeSales && (
        <Card className="md:col-span-2 2xl:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-5 pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Clock3 className="size-4" /> Últimas ventas</CardTitle>
            <Link to="/ventas" className="text-xs font-semibold text-primary">Ver todas</Link>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {recentSales.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Sin ventas recientes.</p>
            ) : (
              <ul className="space-y-4">
                {recentSales.map((sale) => (
                  <li key={sale.id} className="flex items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#eaf2f8] text-xs font-semibold text-[#244460]">
                      {initials(sale.customer?.name ?? 'Cliente general')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link to={`/ventas/${sale.id}`} className="block truncate text-sm font-semibold hover:text-primary">{sale.number}</Link>
                      <p className="truncate text-xs text-muted-foreground">{sale.customer?.name ?? 'Cliente general'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular">{formatMoney(sale.total)}</p>
                      <p className="text-xs text-muted-foreground">{formatRelative(sale.issuedAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </aside>
  );
}

function DashboardMetric({ label, value, hint, icon, tone, positive = true }) {
  return (
    <Card>
      <CardContent className="flex min-h-[126px] items-center gap-3 p-4">
        <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${TONE_STYLES[tone]}`}>
          {createElement(icon, { className: 'size-5', 'aria-hidden': true })}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[#4f6078] dark:text-muted-foreground">{label}</p>
          <p className="mt-1 whitespace-nowrap text-[1.32rem] font-bold text-[var(--panel-ink-strong)] tabular">{value}</p>
          <p className={`mt-1 flex items-center gap-1 truncate text-xs ${positive ? 'text-[#07966c]' : 'text-destructive'}`}>
            {positive ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
            {hint}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function FinanceRow({ icon, label, value, hint, tone }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/70 py-3 last:border-0">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${TONE_STYLES[tone]}`}>
          {createElement(icon, { className: 'size-5', 'aria-hidden': true })}
        </span>
        <span className="truncate text-sm font-medium">{label}</span>
      </div>
      <div className="text-right">
        <p className="whitespace-nowrap text-sm font-semibold tabular">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

function RailAction({ to, icon, label, primary = false }) {
  return (
    <Link
      to={to}
      className={`flex h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold transition-colors ${
        primary ? 'bg-[var(--panel-ink)] text-white hover:bg-[#163659]' : 'bg-[#f0f5fb] text-[#17304f] hover:bg-[#e6eef8] dark:bg-white/8 dark:text-white'
      }`}
    >
      {createElement(icon, { className: 'size-5', 'aria-hidden': true })}
      <span className="flex-1">{label}</span>
      <ArrowRight className="size-4" aria-hidden="true" />
    </Link>
  );
}

function Notification({ tone, title, detail }) {
  return (
    <li className="flex gap-3">
      <span className={`mt-1 size-3 shrink-0 rounded-full ring-4 ${
        tone === 'rose' ? 'bg-[#ef4056] ring-[#fff0f2]' : tone === 'green' ? 'bg-[#0ba67a] ring-[#e9f8f3]' : 'bg-[#4384ff] ring-[#edf3ff]'
      }`} />
      <div className="min-w-0">
        <p className="text-sm font-medium leading-5">{title}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </li>
  );
}

function TopProducts({ products }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-5 pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><Boxes className="size-4" /> Productos más vendidos</CardTitle>
        <Link to="/productos" className="text-xs font-semibold text-primary">Ver más</Link>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {products.length === 0 ? <p className="py-5 text-center text-sm text-muted-foreground">Sin ventas todavía.</p> : (
          <ul className="space-y-3">
            {products.slice(0, 3).map((product) => {
              const max = products[0]?.revenue?.amount || 1;
              const share = Math.max(8, Math.round((product.revenue.amount / max) * 100));
              return (
                <li key={product.productId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{formatNumber(product.quantity)} unidades</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-[#2f6bff]" style={{ width: `${share}%` }} />
                    </div>
                  </div>
                  <span className="text-sm font-semibold tabular">{formatMoney(product.revenue)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function PaymentMethods({ rows }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-5 pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><Wallet className="size-4" /> Formas de pago</CardTitle>
        <Link to="/reportes" className="text-xs font-semibold text-primary">Ver más</Link>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {rows.length === 0 ? <p className="py-5 text-center text-sm text-muted-foreground">Sin cobros todavía.</p> : (
          <ul className="space-y-3">
            {rows.slice(0, 4).map((row, index) => (
              <li key={row.method} className="flex items-center gap-3">
                <span className={`grid size-9 place-items-center rounded-full text-xs font-semibold ${index % 2 ? TONE_STYLES.green : TONE_STYLES.blue}`}>
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{paymentLabel(row.method)}</p>
                  <p className="text-xs text-muted-foreground">{formatNumber(row.count)} operaciones</p>
                </div>
                <p className="text-sm font-semibold tabular">{formatMoney(row.total)}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function InventoryLine({ label, value, alert = false }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={alert ? 'font-semibold text-destructive' : 'font-semibold'}>{value}</span>
    </div>
  );
}

function WelcomePanel({ user, tenant }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={`Buen día, ${user?.name?.split(' ')[0]}`}
        icon={Users}
        description={<>{tenant?.tradeName || tenant?.legalName}{user?.lastLoginAt && <> · último acceso {formatDateTime(user.lastLoginAt)}</>}</>}
      />
      <Card>
        <CardHeader><CardTitle className="text-base">Su sesión</CardTitle><CardDescription>Rol: {user?.role?.name}. Use el menú para trabajar.</CardDescription></CardHeader>
        <CardContent><Button asChild><Link to="/ventas/nueva"><Wallet /> Ir al punto de venta</Link></Button></CardContent>
      </Card>
    </div>
  );
}

function SalesTrendChartFallback({ days }) {
  return <ChartFrame title="Evolución de ventas" description={`Últimos ${days} días.`}><div className="h-[260px] animate-pulse rounded-md bg-muted" /></ChartFrame>;
}

function resolvePeriod(period) {
  const to = new Date();
  const from = new Date(to);
  if (period === 'today') from.setHours(0, 0, 0, 0);
  if (period === '7d') from.setDate(from.getDate() - 6);
  if (period === '30d') from.setDate(from.getDate() - 29);
  if (period === '90d') from.setDate(from.getDate() - 89);
  if (period === 'month') from.setDate(1);
  if (period === 'year') {
    from.setMonth(0);
    from.setDate(1);
  }
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1);
  return { from: localISODate(from), to: localISODate(to), days };
}

function initials(name) {
  return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function paymentLabel(method) {
  return { CASH: 'Efectivo', CARD: 'Tarjeta', TRANSFER: 'Transferencia', CHECK: 'Cheque' }[method] ?? method;
}
