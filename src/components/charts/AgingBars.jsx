import { formatMoney } from '@/lib/money';

/**
 * Antigüedad de saldos, en tramos.
 *
 * Se extrae de Cartera porque Reportes necesita la misma lectura —cuánto
 * lleva pendiente cada tramo de la deuda— sobre el mismo dato de cartera,
 * y una segunda copia de estas barras se habría desincronizado de la primera
 * en el primer ajuste de color o de umbral.
 *
 * @param {object} props
 * @param {{ key: string, label: string, amount: import('@/lib/money').MoneyDto }[]} props.buckets
 * @param {number} props.total En centavos, para calcular la proporción de cada tramo.
 */
export function AgingBars({ buckets, total }) {
  return (
    <div className="scroll-x">
      <div className="flex min-w-[36rem] gap-3">
        {buckets.map((bucket) => {
          const share = total > 0 ? Math.round((bucket.amount.amount / total) * 100) : 0;

          return (
            <div key={bucket.key} className="flex-1 space-y-2">
              <p className="text-xs text-muted-foreground">{bucket.label}</p>
              <p className="font-medium tabular">{formatMoney(bucket.amount)}</p>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full ${bucket.key === 'current' ? 'bg-success' : 'bg-destructive'}`}
                  style={{ width: `${share}%` }}
                />
              </div>
              <p className="text-xs tabular text-muted-foreground">{share}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
