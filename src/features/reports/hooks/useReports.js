import { useMutation, useQuery } from '@tanstack/react-query';
import { reportsApi } from '@/api/endpoints/reports';
import { queryKeys } from '@/api/queryKeys';
import { useToast } from '@/hooks/useToast';

/**
 * Datos de reportes.
 *
 * Los reportes se consideran frescos durante un minuto: son agregaciones sobre
 * miles de documentos y volver a pedirlas al cambiar de pestaña cuesta más de lo
 * que aporta. Cualquier cosa que los mueva —una venta, un abono— ya invalida sus
 * claves desde el módulo correspondiente.
 */
const STALE = 60 * 1000;

/**
 * @param {Record<string, unknown>} filters
 */
export function useDashboardReport(filters = {}) {
  return useQuery({
    queryKey: queryKeys.reports.dashboard(filters),
    queryFn: () => reportsApi.dashboard(filters),
    staleTime: STALE,
    placeholderData: (previous) => previous,
  });
}

/**
 * @param {string} report
 * @param {Record<string, unknown>} filters
 * @param {{ enabled?: boolean }} [options]
 */
export function useReport(report, filters = {}, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.reports.detail(report, filters),
    queryFn: () => reportsApi[report](filters),
    staleTime: STALE,
    enabled,

    /**
     * Los datos anteriores se reutilizan **solo dentro del mismo reporte**.
     *
     * Cada reporte tiene una forma distinta: ventas trae `totals.total`, utilidad
     * trae `totals.revenue`. Un `placeholderData` que devolviera lo anterior sin
     * mirar de qué reporte venía hacía que, al cambiar de pestaña, se pintara
     * «Utilidad» con los datos de «Ventas»: el componente leía `totals.revenue`
     * —inexistente ahí— y tumbaba la pantalla entera contra el límite de error.
     *
     * Cambiando el rango de fechas sí interesa conservar lo anterior, que es lo
     * que evita el parpadeo. Por eso se compara el reporte de la consulta previa,
     * que es el segundo elemento de su clave.
     */
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey?.[1] === report ? previous : undefined,
  });
}

/**
 * @returns {Record<string, any>}
 */
export function useReportExport() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: reportsApi.download,
    onSuccess: () => {
      toast({ variant: 'success', title: 'Archivo descargado' });
    },
    onError: (/** @type {any} */ error) => {
      toast({
        variant: 'destructive',
        title: 'No se pudo exportar',
        description: error.message,
      });
    },
  });
}
