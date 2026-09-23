import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartEmpty, ChartFrame, ChartTooltip } from '@/components/charts/ChartFrame.jsx';
import { SERIES_COLORS } from '@/components/charts/palette';
import { formatDate, formatNumber } from '@/lib/format';
import { formatMoney } from '@/lib/money';

/**
 * Grafica principal del panel.
 *
 * Vive fuera de `DashboardPage` para que Recharts se descargue solo cuando el
 * usuario realmente puede ver reportes. Un cajero sin permiso conserva un panel
 * liviano y el login no arrastra la libreria de graficas.
 *
 * @param {object} props
 * @param {Array<Record<string, any>>} props.points
 * @param {number} props.days
 * @param {string} props.currency
 */
export function SalesTrendChart({ points, days, currency }) {
  const series = points.map((point) => ({
    label: formatDate(point.date),
    total: point.total.amount,
  }));

  return (
    <ChartFrame
      title="Evolución de ventas"
      description={`Últimos ${days} días.`}
      table={{
        columns: [
          { key: 'label', label: 'Fecha' },
          { key: 'countText', label: 'Ventas' },
          { key: 'totalText', label: 'Total' },
        ],
        rows: points.map((point) => ({
          label: formatDate(point.date),
          countText: formatNumber(point.count),
          totalText: formatMoney(point.total),
        })),
      }}
    >
      {series.length === 0 ? (
        <ChartEmpty label="Aún no hay ventas en este período." />
      ) : (
        <ResponsiveContainer width="100%" height={230}>
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
              tickFormatter={(value) => formatNumber(Math.round(value / 100))}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <Tooltip
              content={
                <ChartTooltip
                  format={(value) => formatMoney({ amount: value, currency })}
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
  );
}
