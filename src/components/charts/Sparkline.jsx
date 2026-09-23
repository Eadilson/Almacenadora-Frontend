import { useId } from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

/**
 * Mini gráfica de tendencia, sin ejes ni cuadrícula: solo la forma.
 *
 * Vive dentro de una tarjeta de indicador para que la cifra protagonista no
 * sea solo un número plano — es el mismo dato que ya se pidió para el
 * gráfico grande de la pantalla, reutilizado, no una decoración inventada.
 *
 * @param {object} props
 * @param {Array<Record<string, number>>} props.data
 * @param {string} props.dataKey
 * @param {string} [props.color] Color CSS válido — `currentColor` hereda del texto del contenedor.
 * @param {number} [props.height]
 */
export function Sparkline({ data, dataKey, color = 'currentColor', height = 40 }) {
  const gradientId = useId();

  if (!data || data.length < 2) return null;

  return (
    <div style={{ height }} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
