import { Input } from '@/components/ui/input.jsx';
import { Button } from '@/components/ui/button.jsx';
import { PRESETS, rangeFor } from '../lib/ranges.js';

/**
 * Selector de período.
 *
 * Va en una sola fila sobre los gráficos, no repartido por la pantalla: quien
 * cambia el período espera que **todo** lo de abajo cambie con él, y filtros
 * dispersos hacen dudar de qué afecta a qué.
 *
 * @param {object} props
 * @param {{ from: string, to: string }} props.value
 * @param {(value: any) => void} props.onChange
 * @param {boolean} [props.showDates] El inventario es una foto de ahora mismo, no
 *   algo que ocurrió en un período: mostrar fechas ahí sugeriría un filtro que en
 *   realidad no existe, y que se elija en silencio no avisa de nada —o peor,
 *   engaña—.
 * @param {React.ReactNode} [props.action]
 */
export function RangePicker({ value, onChange, showDates = true, action }) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border-[1.5px] border-black/12 bg-card p-4 dark:border-white/15">
      {showDates && (
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => {
            const presetRange = rangeFor(preset.key);
            // No hay un «período activo» guardado aparte: se sabe cuál es
            // comparando las fechas contra lo que cada atajo produciría hoy.
            // Si la persona edita a mano «Desde»/«Hasta», deja de coincidir con
            // cualquier atajo y ninguno se marca —que es lo correcto.
            const isActive = presetRange.from === value.from && presetRange.to === value.to;

            return (
              <Button
                key={preset.key}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                aria-pressed={isActive}
                onClick={() => onChange({ ...value, ...presetRange })}
              >
                {preset.label}
              </Button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        {showDates && (
          <>
            <label className="space-y-1 text-xs text-muted-foreground">
              <span className="block">Desde</span>
              <Input
                type="date"
                value={value.from}
                max={value.to}
                onChange={(event) => onChange({ ...value, from: event.target.value })}
                className="w-40"
              />
            </label>

            <label className="space-y-1 text-xs text-muted-foreground">
              <span className="block">Hasta</span>
              <Input
                type="date"
                value={value.to}
                min={value.from}
                onChange={(event) => onChange({ ...value, to: event.target.value })}
                className="w-40"
              />
            </label>
          </>
        )}
      </div>

      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}
