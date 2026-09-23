import { Card, CardContent, CardHeader } from './card.jsx';
import { Sparkline } from '../charts/Sparkline.jsx';
import { TONE_TEXT } from './tone.js';

/**
 * Tarjeta de indicador: una cifra, su etiqueta, nada más encima — salvo la
 * protagonista de cada pantalla (`featured`), que sí lleva peso sin depender de
 * un relleno de color: borde más firme, cifra dominante y una línea superior
 * mínima. Las apps de trabajo envejecen mejor cuando el dato manda sobre el
 * adorno.
 *
 * La primera versión de esto llevaba una insignia circular de color y una
 * franja de degradado en cada tarjeta por igual; se leía como cualquier
 * panel armado con un kit de componentes. Aquí el color es una decisión, no
 * un patrón que se repite sin pensar: una tarjeta por fila destaca —la que
 * de verdad responde la pregunta que trae a esta pantalla—, el resto queda
 * en tinta neutra y solo se colorea si la cifra misma lo amerita
 * (`tone="warning"` o `"destructive"`).
 *
 * @param {object} props
 * @param {string} props.label
 * @param {string} props.value
 * @param {string} [props.hint]
 * @param {React.ComponentType<{ className?: string }>} [props.icon] Se dibuja pequeño y monocromo junto a la etiqueta, nunca en una insignia de color.
 * @param {'default'|'primary'|'success'|'warning'|'destructive'} [props.tone] Solo `warning`/`destructive` cambian algo visible; el resto es neutro a propósito. Se ignora si `featured`.
 * @param {boolean} [props.featured] La cifra protagonista de la fila.
 * @param {Array<Record<string, number>>} [props.series] Serie temporal para la mini gráfica — el mismo dato que ya se pidió para el gráfico grande de la pantalla, si existe.
 * @param {string} [props.seriesKey] Campo de `series` a graficar.
 * @param {{ value: number, label?: string }} [props.trend] Positivo o negativo; el signo decide el color.
 * @param {number} [props.delay] Milisegundos de retraso en la entrada, para escalonar varias tarjetas juntas.
 * @param {string} [props.className]
 * @param {React.ReactNode} [props.children] Contenido extra debajo de la cifra — un botón de acción, por ejemplo.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
  featured = false,
  series,
  seriesKey,
  trend,
  delay = 0,
  className = '',
  children,
}) {
  const emphasis = !featured && (tone === 'warning' || tone === 'destructive') ? tone : 'default';

  return (
    <Card
      className={`relative overflow-hidden ${featured ? 'border-foreground/20 shadow-[0_1px_2px_-1px_rgb(0_0_0/0.1),0_18px_42px_-34px_rgb(0_0_0/0.7)]' : ''} ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {featured && <div className="absolute inset-x-0 top-0 h-1 bg-foreground" aria-hidden="true" />}
      <CardHeader className="space-y-3 p-5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {Icon && <Icon className="size-3.5" aria-hidden="true" />}
          {label}
        </div>
        <p
          className={`text-3xl font-semibold leading-none tracking-tight tabular-nums ${featured ? 'text-foreground' : TONE_TEXT[emphasis]}`}
        >
          {value}
        </p>
        {trend !== undefined && trend !== null && (
          <p
            className={`text-xs ${
              trend.value >= 0
                  ? 'text-success'
                  : 'text-destructive'
            }`}
          >
            {trend.value >= 0 ? '+' : ''}
            {(trend.value / 100).toFixed(1)}%{' '}
            <span className="text-muted-foreground">{trend.label ?? 'vs. anterior'}</span>
          </p>
        )}
        {hint && !trend && (
          <p className="text-xs text-muted-foreground">{hint}</p>
        )}
      </CardHeader>

      {featured && series && seriesKey && (
        <div className="px-5 pb-5 text-muted-foreground">
          <Sparkline data={series} dataKey={seriesKey} color="hsl(var(--foreground))" />
        </div>
      )}

      {children && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}
