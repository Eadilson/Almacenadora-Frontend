import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  PackageX,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { ErrorState, PageLoader } from '@/components/feedback/states.jsx';
import { ChartEmpty, ChartFrame, ChartTooltip } from '@/components/charts/ChartFrame.jsx';
import { SERIES_COLORS } from '@/components/charts/palette';
import { usePermission } from '@/hooks/usePermission';
import { useSession } from '@/hooks/useSession';
import { formatMoney } from '@/lib/money';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { useDashboardReport } from '@/features/reports/hooks/useReports.js';

/**
 * Panel de inicio.
 *
 * Responde, en ese orden, lo que alguien pregunta al abrir el sistema por la
 * mañana: cuánto se vendió, cómo va respecto al período anterior, qué se está
 * moviendo, y qué necesita atención hoy —lo que está por acabarse y lo que está
 * por cobrar—.
 *
 * Las cifras de utilidad aparecen solo si el servidor las envía, y las envía solo
 * a quien tiene el permiso financiero. Aquí no hay ninguna comprobación de
 * permisos sobre el dinero: la respuesta ya es la verdad.
 */
export function DashboardPage() {
  const { user, tenant } = useSession();
  const { can } = usePermission();

  const [days, setDays] = useState(30);

  const filters = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  }, [days]);

  const canSeeReports = can('reports:read');
  const { data, isPending, isError, error, refetch } = useDashboardReport(filters);

  // Quien no puede ver reportes conserva un panel de bienvenida, sin cifras.
  if (!canSeeReports) return <WelcomePanel user={user} tenant={tenant} />;

  if (isPending) return <PageLoader label="Calculando indicadores…" />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const financial = Boolean(data.totals.grossProfit);
  const trend = data.comparison.changeBasisPoints;

  const series = data.series.map((/** @type {any} */ point) => ({
    label: formatDate(point.date),
    total: point.total.amount,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Buen día, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-sm text-muted-foreground">
            {tenant?.tradeName || tenant?.legalName}
            {user?.lastLoginAt && <> · último acceso {formatDateTime(user.lastLoginAt)}</>}
          </p>
        </div>

        <div className="flex gap-1.5">
          {[7, 30, 90].map((option) => (
            <Button
              key={option}
              variant={days === option ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDays(option)}
            >
              {option} días
            </Button>
          ))}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Vendido</CardDescription>
            <CardTitle className="text-2xl">{formatMoney(data.totals.total)}</CardTitle>
            {trend !== null && (
              <p className="flex items-center gap-1 text-xs">
                {trend >= 0 ? (
                  <TrendingUp className="size-3 text-success" aria-hidden="true" />
                ) : (
                  <TrendingDown className="size-3 text-destructive" aria-hidden="true" />
                )}
                <span className={trend >= 0 ? 'text-success' : 'text-destructive'}>
                  {trend >= 0 ? '+' : ''}
                  {(trend / 100).toFixed(1)}%
                </span>
                <span className="text-muted-foreground">vs. período anterior</span>
              </p>
            )}
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Ventas</CardDescription>
            <CardTitle className="tabular text-2xl">{formatNumber(data.totals.count)}</CardTitle>
            <p className="text-xs text-muted-foreground">
              ticket promedio {formatMoney(data.totals.averageTicket)}
            </p>
          </CardHeader>
        </Card>

        {financial ? (
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Utilidad</CardDescription>
              <CardTitle className="text-2xl">{formatMoney(data.totals.grossProfit)}</CardTitle>
              <p className="text-xs text-muted-foreground">
                margen {(data.totals.marginBasisPoints / 100).toFixed(1)}%
              </p>
            </CardHeader>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Al crédito</CardDescription>
              <CardTitle className="text-2xl">{formatMoney(data.totals.credit)}</CardTitle>
            </CardHeader>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Por cobrar</CardDescription>
            <CardTitle className="text-2xl">
              {data.portfolio ? formatMoney(data.portfolio.balance) : '—'}
            </CardTitle>
            {data.portfolio?.overdue.amount > 0 && (
              <p className="text-xs text-destructive">
                {formatMoney(data.portfolio.overdue)} en mora
              </p>
            )}
          </CardHeader>
        </Card>
      </div>

      {(data.inventory.lowStock > 0 || data.portfolio?.overdueAccounts > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.inventory.lowStock > 0 && (
            <Alert variant="warning">
              <PackageX aria-hidden="true" />
              <AlertDescription className="flex flex-wrap items-center gap-2">
                <span>{data.inventory.lowStock} producto(s) por debajo del mínimo.</span>
                <Button variant="link" size="sm" className="h-auto p-0" asChild>
                  <Link to="/existencias">
                    Ver cuáles
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {data.portfolio?.overdueAccounts > 0 && (
            <Alert variant="destructive">
              <AlertTriangle aria-hidden="true" />
              <AlertDescription className="flex flex-wrap items-center gap-2">
                <span>{data.portfolio.overdueAccounts} cliente(s) con pagos vencidos.</span>
                <Button variant="link" size="sm" className="h-auto p-0" asChild>
                  <Link to="/creditos">
                    Ver cartera
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <ChartFrame
        title="Ventas por día"
        description={`Últimos ${days} días.`}
        table={{
          columns: [
            { key: 'label', label: 'Fecha' },
            { key: 'countText', label: 'Ventas' },
            { key: 'totalText', label: 'Total' },
          ],
          rows: data.series.map((/** @type {any} */ point) => ({
            label: formatDate(point.date),
            countText: formatNumber(point.count),
            totalText: formatMoney(point.total),
          })),
        }}
      >
        {series.length === 0 ? (
          <ChartEmpty label="Aún no hay ventas en este período." />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={series} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="panelVentas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES_COLORS[0]} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={SERIES_COLORS[0]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis
                tickFormatter={(/** @type {number} */ value) =>
                  formatNumber(Math.round(value / 100))
                }
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    format={(/** @type {number} */ value) =>
                      formatMoney({ amount: value, currency: data.currency })
                    }
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="total"
                name="Vendido"
                stroke={SERIES_COLORS[0]}
                strokeWidth={2}
                fill="url(#panelVentas)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartFrame>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lo que más se vende</CardTitle>
            <CardDescription>Por dinero generado en el período.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.topProducts.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Sin ventas todavía.</p>
            ) : (
              <ul className="divide-y">
                {data.topProducts.map((/** @type {any} */ product) => (
                  <li key={product.productId} className="flex items-center justify-between py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{product.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{product.sku}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tabular text-sm font-medium">{formatMoney(product.revenue)}</p>
                      <p className="tabular text-xs text-muted-foreground">
                        {formatNumber(product.quantity)} u.
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cómo entra el dinero</CardTitle>
            <CardDescription>Formas de pago del período.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.byPaymentMethod.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Sin cobros todavía.</p>
            ) : (
              <ul className="space-y-3">
                {data.byPaymentMethod.map((/** @type {any} */ row) => {
                  const share =
                    data.totals.total.amount > 0
                      ? Math.round((row.total.amount / data.totals.total.amount) * 100)
                      : 0;

                  return (
                    <li key={row.method} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{row.method}</span>
                        <span className="tabular font-medium">{formatMoney(row.total)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${share}%`, background: SERIES_COLORS[0] }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center">
        <Button variant="outline" asChild>
          <Link to="/reportes">
            <Receipt aria-hidden="true" />
            Ver todos los reportes
          </Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * Panel para quien no puede ver reportes.
 *
 * Un cajero no necesita indicadores del negocio, pero sí saber dónde está y qué
 * puede hacer. Mostrarle cifras vacías o un 403 sería peor que esto.
 *
 * @param {{ user: any, tenant: any }} props
 */
function WelcomePanel({ user, tenant }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Buen día, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          {tenant?.tradeName || tenant?.legalName}
          {user?.lastLoginAt && <> · último acceso {formatDateTime(user.lastLoginAt)}</>}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Su sesión</CardTitle>
          <CardDescription>
            Rol: {user?.role?.name}. Use el menú de la izquierda para trabajar.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/ventas/nueva">
              <Wallet aria-hidden="true" />
              Ir al punto de venta
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
