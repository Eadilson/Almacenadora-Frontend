import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download, TrendingDown, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { ErrorState, PageLoader } from '@/components/feedback/states.jsx';
import { ChartEmpty, ChartFrame, ChartTooltip } from '@/components/charts/ChartFrame.jsx';
import { SERIES_COLORS } from '@/components/charts/palette';
import { usePermission } from '@/hooks/usePermission';
import { formatMoney } from '@/lib/money';
import { formatDate, formatNumber } from '@/lib/format';
import { RangePicker } from '../components/RangePicker.jsx';
import { rangeFor } from '../lib/ranges.js';
import { useReport, useReportExport } from '../hooks/useReports.js';

/** Las pestañas disponibles, con el permiso que cada una exige. */
const TABS = [
  { key: 'sales', label: 'Ventas' },
  { key: 'profit', label: 'Utilidad', permission: 'reports:financial:read' },
  { key: 'inventory', label: 'Inventario' },
  { key: 'rotation', label: 'Rotación' },
  { key: 'customers', label: 'Clientes' },
  { key: 'purchases', label: 'Compras' },
];

/**
 * Reportes.
 *
 * Cada pestaña es un reporte distinto sobre el mismo período: el selector vive
 * arriba y no se reinicia al cambiar de pestaña, porque quien mira las ventas de
 * marzo suele querer ver también la utilidad de marzo.
 */
export function ReportsPage() {
  const { can } = usePermission();
  const exportReport = useReportExport();

  const tabs = TABS.filter((tab) => !tab.permission || can(tab.permission));
  const [tab, setTab] = useState(tabs[0]?.key ?? 'sales');
  const [range, setRange] = useState(() => ({ ...rangeFor('30d'), branchId: '' }));

  // El inventario es una foto de ahora mismo, no algo que ocurrió en un período:
  // el servidor rechaza `from`/`to` para ese reporte porque no significan nada
  // ahí, y mandarlos igual tumbaba la pestaña con «Los datos enviados no son
  // válidos» — un error que no decía qué campo sobraba ni por qué.
  const showDates = tab !== 'inventory';

  const filters = useMemo(
    () => ({
      ...(showDates ? { from: range.from, to: range.to } : {}),
      branchId: range.branchId || undefined,
    }),
    [range, showDates],
  );

  const { data, isPending, isError, error, refetch } = useReport(tab, filters);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>
        <p className="text-sm text-muted-foreground">
          Qué se vendió, qué se ganó y qué está parado.
        </p>
      </header>

      <nav className="flex flex-wrap gap-1 border-b" aria-label="Reportes">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            aria-current={tab === item.key ? 'page' : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              tab === item.key
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <RangePicker
        value={range}
        onChange={setRange}
        showDates={showDates}
        action={
          can('reports:export') && (
            <Button
              variant="outline"
              disabled={exportReport.isPending}
              onClick={() => exportReport.mutate({ report: tab, filters })}
            >
              <Download aria-hidden="true" />
              {exportReport.isPending ? 'Generando…' : 'Exportar a Excel'}
            </Button>
          )
        }
      />

      {isPending && <PageLoader label="Calculando…" />}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && tab === 'sales' && <SalesReport data={data} />}
      {data && tab === 'profit' && <ProfitReport data={data} />}
      {data && tab === 'inventory' && <InventoryReport data={data} />}
      {data && tab === 'rotation' && <RotationReport data={data} />}
      {data && tab === 'customers' && <CustomersReport data={data} />}
      {data && tab === 'purchases' && <PurchasesReport data={data} />}
    </div>
  );
}

/**
 * Tarjeta de indicador.
 *
 * @param {{ label: string, value: string, hint?: string, trend?: number|null }} props
 */
function Stat({ label, value, hint, trend = null }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
        {(hint || trend !== null) && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {trend !== null && (
              <>
                {trend >= 0 ? (
                  <TrendingUp className="size-3 text-success" aria-hidden="true" />
                ) : (
                  <TrendingDown className="size-3 text-destructive" aria-hidden="true" />
                )}
                <span className={trend >= 0 ? 'text-success' : 'text-destructive'}>
                  {trend >= 0 ? '+' : ''}
                  {(trend / 100).toFixed(1)}%
                </span>
              </>
            )}
            {hint}
          </p>
        )}
      </CardHeader>
    </Card>
  );
}

/** Eje de dinero: se muestra en unidad mayor, sin decimales, para que quepa. */
const moneyAxis = (/** @type {number} */ value) => formatNumber(Math.round(value / 100));

/** @param {{ data: any }} props */
function SalesReport({ data }) {
  const financial = Boolean(data.totals.grossProfit);

  const series = data.series.map((/** @type {any} */ point) => ({
    date: point.date,
    label: formatDate(point.date),
    total: point.total.amount,
    grossProfit: point.grossProfit?.amount,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Vendido" value={formatMoney(data.totals.total)} />
        <Stat label="Ventas" value={formatNumber(data.totals.count)} />
        <Stat label="Ticket promedio" value={formatMoney(data.totals.averageTicket)} />
        {financial ? (
          <Stat label="Utilidad" value={formatMoney(data.totals.grossProfit)} />
        ) : (
          <Stat label="Al crédito" value={formatMoney(data.totals.credit)} />
        )}
      </div>

      <ChartFrame
        title="Ventas por día"
        description="Cuánto entró cada día del período."
        series={
          financial
            ? [
                { key: 'total', label: 'Vendido' },
                { key: 'grossProfit', label: 'Utilidad' },
              ]
            : [{ key: 'total', label: 'Vendido' }]
        }
        table={{
          columns: [
            { key: 'label', label: 'Fecha' },
            { key: 'totalText', label: 'Vendido' },
            ...(financial ? [{ key: 'profitText', label: 'Utilidad' }] : []),
          ],
          rows: data.series.map((/** @type {any} */ point) => ({
            label: formatDate(point.date),
            totalText: formatMoney(point.total),
            profitText: point.grossProfit ? formatMoney(point.grossProfit) : '—',
          })),
        }}
      >
        {series.length === 0 ? (
          <ChartEmpty />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={series} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="ventas" x1="0" y1="0" x2="0" y2="1">
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
                tickFormatter={moneyAxis}
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
                fill="url(#ventas)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
              />
              {financial && (
                <Area
                  type="monotone"
                  dataKey="grossProfit"
                  name="Utilidad"
                  stroke={SERIES_COLORS[1]}
                  strokeWidth={2}
                  fill="none"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartFrame>

      <div className="grid gap-6 lg:grid-cols-2">
        <CategoryBars
          title="Por forma de pago"
          description="Cómo entró el dinero."
          currency={data.currency}
          rows={data.byPaymentMethod.map((/** @type {any} */ row) => ({
            name: row.method,
            value: row.total.amount,
          }))}
        />

        <CategoryBars
          title="Por vendedor"
          description="Quién vendió más en el período."
          currency={data.currency}
          rows={data.bySeller.map((/** @type {any} */ row) => ({
            name: row.name,
            value: row.total.amount,
          }))}
        />
      </div>
    </div>
  );
}

/** @param {{ data: any }} props */
function ProfitReport({ data }) {
  const series = data.series.map((/** @type {any} */ point) => ({
    label: formatDate(point.date),
    revenue: point.revenue.amount,
    cogs: point.cogs.amount,
    grossProfit: point.grossProfit.amount,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Ingresos" value={formatMoney(data.totals.revenue)} />
        <Stat label="Costo de lo vendido" value={formatMoney(data.totals.cogs)} />
        <Stat label="Utilidad bruta" value={formatMoney(data.totals.grossProfit)} />
        <Stat
          label="Margen"
          value={`${(data.totals.marginBasisPoints / 100).toFixed(1)}%`}
          hint="sobre las ventas del período"
        />
      </div>

      <ChartFrame
        title="Ingresos, costo y utilidad"
        description="Las tres cifras en la misma escala, día a día."
        series={[
          { key: 'revenue', label: 'Ingresos' },
          { key: 'cogs', label: 'Costo' },
          { key: 'grossProfit', label: 'Utilidad' },
        ]}
        table={{
          columns: [
            { key: 'label', label: 'Fecha' },
            { key: 'revenueText', label: 'Ingresos' },
            { key: 'cogsText', label: 'Costo' },
            { key: 'profitText', label: 'Utilidad' },
            { key: 'marginText', label: 'Margen' },
          ],
          rows: data.series.map((/** @type {any} */ point) => ({
            label: formatDate(point.date),
            revenueText: formatMoney(point.revenue),
            cogsText: formatMoney(point.cogs),
            profitText: formatMoney(point.grossProfit),
            marginText: `${(point.marginBasisPoints / 100).toFixed(1)}%`,
          })),
        }}
      >
        {series.length === 0 ? (
          <ChartEmpty />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={series} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              {/* Un solo eje: las tres series son dinero en la misma moneda. */}
              <YAxis
                tickFormatter={moneyAxis}
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
              {[
                { key: 'revenue', name: 'Ingresos' },
                { key: 'cogs', name: 'Costo' },
                { key: 'grossProfit', name: 'Utilidad' },
              ].map((line, index) => (
                <Line
                  key={line.key}
                  type="monotone"
                  dataKey={line.key}
                  name={line.name}
                  stroke={SERIES_COLORS[index]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartFrame>

      <ChartFrame
        title="Margen por producto"
        description="Ordenados por lo que dejan, no por lo que venden."
        table={{
          columns: [
            { key: 'name', label: 'Producto' },
            { key: 'quantityText', label: 'Unidades' },
            { key: 'revenueText', label: 'Ingresos' },
            { key: 'profitText', label: 'Utilidad' },
            { key: 'marginText', label: 'Margen' },
          ],
          rows: data.byProduct.map((/** @type {any} */ row) => ({
            name: row.name,
            quantityText: formatNumber(row.quantity),
            revenueText: formatMoney(row.revenue),
            profitText: formatMoney(row.grossProfit),
            marginText: `${(row.marginBasisPoints / 100).toFixed(1)}%`,
          })),
        }}
      >
        <div className="scroll-x">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Producto</th>
                <th className="pb-2 text-right font-medium">Unidades</th>
                <th className="pb-2 text-right font-medium">Ingresos</th>
                <th className="pb-2 text-right font-medium">Utilidad</th>
                <th className="pb-2 text-right font-medium">Margen</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.byProduct.map((/** @type {any} */ row) => (
                <tr key={row.productId}>
                  <td className="py-2 pr-3">
                    <p className="font-medium">{row.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{row.sku}</p>
                  </td>
                  <td className="py-2 pr-3 text-right tabular">{formatNumber(row.quantity)}</td>
                  <td className="py-2 pr-3 text-right tabular">{formatMoney(row.revenue)}</td>
                  <td className="py-2 pr-3 text-right tabular">{formatMoney(row.grossProfit)}</td>
                  <td className="py-2 text-right tabular">
                    {(row.marginBasisPoints / 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartFrame>
    </div>
  );
}

/** @param {{ data: any }} props */
function InventoryReport({ data }) {
  const financial = Boolean(data.totals.valuation);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Productos con existencia" value={formatNumber(data.totals.products)} />
        <Stat label="Unidades" value={formatNumber(data.totals.units)} />
        {financial && (
          <>
            <Stat label="Costo del inventario" value={formatMoney(data.totals.valuation)} />
            <Stat
              label="Utilidad potencial"
              value={formatMoney(data.totals.potentialProfit)}
              hint="si se vendiera todo al precio de lista"
            />
          </>
        )}
      </div>

      {!financial && (
        <Alert>
          <AlertDescription>
            Su rol no incluye ver costos, así que este reporte muestra cuánto hay pero no cuánto
            vale. Solicítelo al administrador si lo necesita.
          </AlertDescription>
        </Alert>
      )}

      <CategoryBars
        title="Por categoría"
        description={financial ? 'Dónde está el dinero del inventario.' : 'Unidades por categoría.'}
        currency={data.currency}
        unit={financial ? 'money' : 'number'}
        rows={data.byCategory.map((/** @type {any} */ row) => ({
          name: row.name,
          value: financial ? row.valuation.amount : row.units,
        }))}
      />
    </div>
  );
}

/** @param {{ data: any }} props */
function RotationReport({ data }) {
  const financial = Boolean(data.slowMoving[0]?.valuation);

  return (
    <div className="space-y-6">
      <CategoryBars
        title="Más vendidos"
        description="Por dinero generado en el período."
        currency={data.currency}
        rows={data.topProducts.slice(0, 10).map((/** @type {any} */ row) => ({
          name: row.name,
          value: row.revenue.amount,
        }))}
      />

      <ChartFrame
        title={`Sin movimiento en ${data.thresholdDays} días`}
        description="Mercancía parada, de mayor a menor dinero inmovilizado."
        table={{
          columns: [
            { key: 'name', label: 'Producto' },
            { key: 'quantityText', label: 'Existencia' },
            { key: 'daysText', label: 'Días parado' },
            ...(financial ? [{ key: 'valueText', label: 'Dinero parado' }] : []),
          ],
          rows: data.slowMoving.map((/** @type {any} */ row) => ({
            name: row.name,
            quantityText: formatNumber(row.quantity),
            daysText: row.daysStopped === null ? 'Nunca vendido' : formatNumber(row.daysStopped),
            valueText: row.valuation ? formatMoney(row.valuation) : '—',
          })),
        }}
      >
        {data.slowMoving.length === 0 ? (
          <ChartEmpty label="Todo se está moviendo." />
        ) : (
          <div className="scroll-x">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Producto</th>
                  <th className="pb-2 text-right font-medium">Existencia</th>
                  <th className="pb-2 text-right font-medium">Días parado</th>
                  {financial && <th className="pb-2 text-right font-medium">Dinero parado</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.slowMoving.slice(0, 25).map((/** @type {any} */ row) => (
                  <tr key={row.productId}>
                    <td className="py-2 pr-3">
                      <p className="font-medium">{row.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{row.sku}</p>
                    </td>
                    <td className="py-2 pr-3 text-right tabular">{formatNumber(row.quantity)}</td>
                    <td className="py-2 pr-3 text-right tabular">
                      {row.daysStopped === null ? (
                        <span className="text-muted-foreground">Nunca vendido</span>
                      ) : (
                        row.daysStopped
                      )}
                    </td>
                    {financial && (
                      <td className="py-2 text-right tabular font-medium">
                        {formatMoney(row.valuation)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartFrame>
    </div>
  );
}

/** @param {{ data: any }} props */
function CustomersReport({ data }) {
  return (
    <div className="space-y-6">
      {data.portfolio && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Por cobrar" value={formatMoney(data.portfolio.balance)} />
          <Stat label="En mora" value={formatMoney(data.portfolio.overdue)} />
          <Stat label="Clientes con deuda" value={formatNumber(data.portfolio.accounts)} />
          <Stat label="En mora" value={formatNumber(data.portfolio.overdueAccounts)} />
        </div>
      )}

      <CategoryBars
        title="Mejores clientes"
        description="Por lo que compraron en el período."
        currency={data.currency}
        rows={data.topCustomers.slice(0, 10).map((/** @type {any} */ row) => ({
          name: row.name,
          value: row.total.amount,
        }))}
      />
    </div>
  );
}

/** @param {{ data: any }} props */
function PurchasesReport({ data }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Stat label="Comprado" value={formatMoney(data.totals.total)} />
        <Stat label="Órdenes" value={formatNumber(data.totals.count)} />
      </div>

      <CategoryBars
        title="Por proveedor"
        description="A quién se le compró más."
        currency={data.currency}
        rows={data.bySupplier.slice(0, 10).map((/** @type {any} */ row) => ({
          name: row.name,
          value: row.total.amount,
        }))}
      />
    </div>
  );
}

/**
 * Barras horizontales para comparar categorías.
 *
 * Horizontales y no verticales porque las etiquetas son nombres —de producto, de
 * proveedor, de cliente— y en vertical habría que girarlas o recortarlas. Y barras
 * en lugar de un pastel: comparar longitudes es preciso, comparar ángulos no.
 *
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {string} props.currency
 * @param {{ name: string, value: number }[]} props.rows
 * @param {'money'|'number'} [props.unit]
 */
function CategoryBars({ title, description, currency, rows, unit = 'money' }) {
  const format = (/** @type {number} */ value) =>
    unit === 'money' ? formatMoney({ amount: value, currency }) : formatNumber(value);

  return (
    <ChartFrame
      title={title}
      description={description}
      table={{
        columns: [
          { key: 'name', label: 'Concepto' },
          { key: 'valueText', label: 'Total' },
        ],
        rows: rows.map((row) => ({ name: row.name, valueText: format(row.value) })),
      }}
    >
      {rows.length === 0 ? (
        <ChartEmpty />
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(180, rows.length * 34 + 20)}>
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
            barCategoryGap={6}
          >
            <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={unit === 'money' ? moneyAxis : formatNumber}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              width={140}
            />
            <Tooltip
              cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
              content={<ChartTooltip format={format} />}
            />
            {/* Una sola serie: todas las barras del mismo color. Pintarlas de
                colores distintos sugeriría que cada una es una categoría propia,
                cuando la categoría ya la dice la etiqueta. */}
            <Bar dataKey="value" name="Total" radius={[0, 4, 4, 0]} maxBarSize={22}>
              {rows.map((row) => (
                <Cell key={row.name} fill={SERIES_COLORS[0]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartFrame>
  );
}
