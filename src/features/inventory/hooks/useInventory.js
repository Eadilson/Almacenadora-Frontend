import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '@/api/endpoints/inventory';
import { queryKeys } from '@/api/queryKeys';
import { useToast } from '@/hooks/useToast';

/**
 * Datos de inventario.
 *
 * Toda mutación invalida existencias **y** movimientos: un ajuste cambia el saldo y
 * añade un asiento al kardex, así que dejar una de las dos vistas sin refrescar
 * mostraría información contradictoria en la misma pantalla.
 */

/**
 * @param {Record<string, unknown>} filters
 */
export function useStock(filters) {
  return useQuery({
    queryKey: [...queryKeys.stock.all, 'list', filters],
    queryFn: () => inventoryApi.listStock(filters),
    placeholderData: (previous) => previous,
  });
}

/**
 * @param {string|undefined} branchId
 */
export function useStockSummary(branchId) {
  return useQuery({
    queryKey: [...queryKeys.stock.all, 'summary', branchId ?? 'all'],
    queryFn: () => inventoryApi.summary(branchId),
  });
}

/**
 * @param {string|null} productId
 * @param {Record<string, unknown>} filters
 */
export function useKardex(productId, filters = {}) {
  return useQuery({
    queryKey: [...queryKeys.stock.byProduct(productId ?? 'none'), filters],
    queryFn: () => inventoryApi.kardex(/** @type {string} */ (productId), filters),
    enabled: Boolean(productId),
  });
}

/**
 * @param {Record<string, unknown>} filters
 */
export function useMovements(filters) {
  return useQuery({
    queryKey: queryKeys.stock.movements(filters),
    queryFn: () => inventoryApi.listMovements(filters),
    placeholderData: (previous) => previous,
  });
}

/**
 * Movimientos manuales.
 *
 * @returns {Record<string, any>}
 */
export function useInventoryMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.stock.all });

  /**
   * @param {string} title
   * @returns {(result: any) => void}
   */
  const onDone = (title) => (result) => {
    void invalidate();
    toast({
      variant: 'success',
      title,
      // Se dice en cuánto quedó: es el dato que el usuario quiere confirmar de
      // inmediato tras mover existencias.
      description: `Existencia actual: ${result.stock.onHand}`,
    });
  };

  /** @param {any} error */
  const onFail = (error) => {
    if (error.isValidation) return;
    toast({ variant: 'destructive', title: error.message });
  };

  return {
    openingBalance: useMutation({
      mutationFn: inventoryApi.openingBalance,
      onSuccess: onDone('Saldo inicial registrado'),
      onError: onFail,
    }),
    adjust: useMutation({
      mutationFn: inventoryApi.adjust,
      onSuccess: onDone('Ajuste registrado'),
      onError: onFail,
    }),
    registerLoss: useMutation({
      mutationFn: inventoryApi.registerLoss,
      onSuccess: onDone('Pérdida registrada'),
      onError: onFail,
    }),
    correct: useMutation({
      mutationFn: inventoryApi.correct,
      onSuccess: () => {
        void invalidate();
        toast({
          variant: 'success',
          title: 'Corrección registrada',
          description: 'El movimiento original se conserva en el historial.',
        });
      },
      onError: onFail,
    }),
  };
}
