/**
 * Colores de serie para los gráficos, en orden fijo.
 *
 * El índice manda: la serie 1 es siempre azul, la 2 siempre naranja. Nunca se
 * rotan según cuántas series haya —eso repintaría los supervivientes al aplicar
 * un filtro, y quien mira el gráfico creería que cambió el dato—. Con más de
 * cuatro series, lo correcto es agrupar el resto en «Otros», no inventar un
 * quinto color.
 *
 * Los valores viven en `styles/index.css` como tokens, uno por tema. Ahí está
 * anotada la validación de daltonismo y contraste que respalda este orden.
 *
 * Vive en su propio módulo para que los archivos de componente exporten solo
 * componentes: mezclar constantes rompe la recarga en caliente de Vite.
 */
export const SERIES_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
];
