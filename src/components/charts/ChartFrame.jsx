import { useId, useState } from 'react';
import { Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { SERIES_COLORS } from './palette.js';

/**
 * Marco común de un gráfico: título, leyenda y vista de tabla.
 *
 * La tabla no es un extra: es lo que hace que el gráfico sea legible para quien
 * usa lector de pantalla, para quien no distingue los colores, y para quien
 * necesita el número exacto en lugar de la altura de una barra. Se puede abrir
 * siempre, con un botón, y contiene los mismos datos.
 *
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {{ key: string, label: string }[]} [props.series] Para la leyenda.
 * @param {React.ReactNode} props.children El gráfico.
 * @param {{ columns: { key: string, label: string }[], rows: Record<string, any>[] }} [props.table]
 * @param {React.ReactNode} [props.action]
 */
export function ChartFrame({ title, description, series = [], children, table, action }) {
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-[0_12px_30px_-24px_rgb(15_23_42/0.45)]">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-card-foreground">{title}</h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>

        <div className="flex items-center gap-2">
          {action}
          {table && (
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={showTable}
              aria-controls={tableId}
              onClick={() => setShowTable((value) => !value)}
            >
              <Table2 aria-hidden="true" />
              {showTable ? 'Ver gráfico' : 'Ver datos'}
            </Button>
          )}
        </div>
      </header>

      {/*
        La leyenda aparece con dos o más series. Con una sola no hace falta: el
        título ya dice qué se está mirando, y una leyenda de un elemento es ruido.
      */}
      {series.length > 1 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
          {series.map((item, index) => (
            <li key={item.key} className="flex items-center gap-1.5 text-xs">
              <span
                className="size-2.5 shrink-0 rounded-sm"
                style={{ background: SERIES_COLORS[index % SERIES_COLORS.length] }}
                aria-hidden="true"
              />
              {/* El texto va en tinta normal: el color lo lleva la marca de al
                  lado, nunca la palabra. */}
              <span className="text-muted-foreground">{item.label}</span>
            </li>
          ))}
        </ul>
      )}

      {showTable && table ? (
        <div id={tableId} className="scroll-x">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                {table.columns.map((column, index) => (
                  <th
                    key={column.key}
                    className={`pb-2 font-medium ${index > 0 ? 'text-right' : ''}`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {table.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {table.columns.map((column, index) => (
                    <td
                      key={column.key}
                      className={`py-1.5 ${index > 0 ? 'text-right tabular' : ''}`}
                    >
                      {row[column.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

/**
 * Contenido de la ventana emergente al pasar el cursor.
 *
 * Recharts la pinta con estilos propios que ignoran el tema; esta versión usa los
 * tokens del sistema para que se lea igual en claro y en oscuro.
 *
 * @param {object} props
 * @param {boolean} [props.active]
 * @param {any[]} [props.payload]
 * @param {string} [props.label]
 * @param {(value: any, entry: any) => string} props.format
 */
export function ChartTooltip({ active, payload, label, format }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-md">
      {label && <p className="mb-1 font-medium">{label}</p>}
      <ul className="space-y-0.5">
        {payload.map((entry, index) => (
          <li key={index} className="flex items-center gap-2">
            <span
              className="size-2 shrink-0 rounded-sm"
              style={{ background: entry.color }}
              aria-hidden="true"
            />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="ml-auto tabular font-medium">{format(entry.value, entry)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Estado vacío de un gráfico.
 *
 * Un gráfico sin datos no debe dibujar ejes vacíos: parece que algo falló.
 *
 * @param {{ label?: string }} props
 */
export function ChartEmpty({ label = 'Sin datos en este período.' }) {
  return (
    <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}
