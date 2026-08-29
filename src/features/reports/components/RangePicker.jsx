import { Input } from '@/components/ui/input.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Select } from '@/components/ui/select.jsx';
import { useSession } from '@/hooks/useSession';
import { PRESETS, rangeFor } from '../lib/ranges.js';

/**
 * Selector de período y sucursal.
 *
 * Va en una sola fila sobre los gráficos, no repartido por la pantalla: quien
 * cambia el período espera que **todo** lo de abajo cambie con él, y filtros
 * dispersos hacen dudar de qué afecta a qué.
 *
 * @param {object} props
 * @param {{ from: string, to: string, branchId: string }} props.value
 * @param {(value: any) => void} props.onChange
 * @param {boolean} [props.showDates] El inventario es una foto de ahora mismo, no
 *   algo que ocurrió en un período: mostrar fechas ahí sugeriría un filtro que en
 *   realidad no existe, y que se elija en silencio no avisa de nada —o peor,
 *   engaña—.
 * @param {React.ReactNode} [props.action]
 */
export function RangePicker({ value, onChange, showDates = true, action }) {
  const { user } = useSession();
  const branches = user?.branches ?? [];

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
      {showDates && (
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <Button
              key={preset.key}
              variant="outline"
              size="sm"
              onClick={() => onChange({ ...value, ...rangeFor(preset.key) })}
            >
              {preset.label}
            </Button>
          ))}
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

        {branches.length > 1 && (
          <label className="space-y-1 text-xs text-muted-foreground">
            <span className="block">Sucursal</span>
            <Select
              value={value.branchId}
              onChange={(event) => onChange({ ...value, branchId: event.target.value })}
              className="w-44"
            >
              <option value="">Todas</option>
              {branches.map((/** @type {any} */ branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </label>
        )}
      </div>

      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}
