import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { purchasingApi } from '@/api/endpoints/purchasing';
import { queryKeys } from '@/api/queryKeys';
import { useToast } from '@/hooks/useToast';

/**
 * Datos de compras.
 *
 * Recibir mercancía toca tres cosas a la vez —la orden, las existencias y el
 * kardex—, así que esa mutación invalida las tres. Refrescar solo la orden dejaría
 * la pantalla de inventario mostrando existencias que ya cambiaron.
 */

/**
 * @param {Record<string, unknown>} filters
 */
export function useSuppliers(filters = {}) {
  return useQuery({
    queryKey: [...queryKeys.suppliers.all, filters],
    queryFn: () => purchasingApi.listSuppliers(filters),
    placeholderData: (previous) => previous,
  });
}

/**
 * @param {string|null} id
 */
export function useSupplier(id) {
  return useQuery({
    queryKey: queryKeys.suppliers.detail(id ?? 'none'),
    queryFn: () => purchasingApi.getSupplier(/** @type {string} */ (id)),
    enabled: Boolean(id),
  });
}

/**
 * @param {Record<string, unknown>} filters
 */
export function usePurchaseOrders(filters = {}) {
  return useQuery({
    queryKey: queryKeys.purchaseOrders.list(filters),
    queryFn: () => purchasingApi.listOrders(filters),
    placeholderData: (previous) => previous,
  });
}

/**
 * @param {string|null} id
 */
export function usePurchaseOrder(id) {
  return useQuery({
    queryKey: queryKeys.purchaseOrders.detail(id ?? 'none'),
    queryFn: () => purchasingApi.getOrder(/** @type {string} */ (id)),
    enabled: Boolean(id),
  });
}

/**
 * @returns {Record<string, any>}
 */
export function usePurchasingMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidateSuppliers = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all });

  const invalidateOrders = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all });

  /** @param {any} error */
  const onFail = (error) => {
    if (error.isValidation) return;
    toast({ variant: 'destructive', title: error.message });
  };

  return {
    createSupplier: useMutation({
      mutationFn: purchasingApi.createSupplier,
      onSuccess: (supplier) => {
        void invalidateSuppliers();
        toast({ variant: 'success', title: `Proveedor ${supplier.code} creado` });
      },
      onError: onFail,
    }),

    updateSupplier: useMutation({
      mutationFn: purchasingApi.updateSupplier,
      onSuccess: () => {
        void invalidateSuppliers();
        toast({ variant: 'success', title: 'Proveedor actualizado' });
      },
      onError: onFail,
    }),

    deactivateSupplier: useMutation({
      mutationFn: purchasingApi.deactivateSupplier,
      onSuccess: () => {
        void invalidateSuppliers();
        toast({ variant: 'success', title: 'Proveedor desactivado' });
      },
      onError: onFail,
    }),

    createOrder: useMutation({
      mutationFn: purchasingApi.createOrder,
      onSuccess: (order) => {
        void invalidateOrders();
        toast({ variant: 'success', title: `Orden ${order.number} creada` });
      },
      onError: onFail,
    }),

    confirmOrder: useMutation({
      mutationFn: purchasingApi.confirmOrder,
      onSuccess: (order) => {
        void invalidateOrders();
        toast({
          variant: 'success',
          title: `Orden ${order.number} confirmada`,
          description: 'Ya se puede registrar la recepción de la mercancía.',
        });
      },
      onError: onFail,
    }),

    cancelOrder: useMutation({
      mutationFn: purchasingApi.cancelOrder,
      onSuccess: () => {
        void invalidateOrders();
        toast({ variant: 'success', title: 'Orden cancelada' });
      },
      onError: onFail,
    }),

    receive: useMutation({
      mutationFn: purchasingApi.receive,
      onSuccess: (result) => {
        void invalidateOrders();
        // La recepción mueve existencias: sin invalidar inventario, la pantalla de
        // stock seguiría mostrando las cantidades anteriores.
        void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all });
        void queryClient.invalidateQueries({ queryKey: queryKeys.products.all });

        toast({
          variant: 'success',
          title: `Recepción ${result.receipt.number} registrada`,
          description: `${result.movements.length} ${result.movements.length === 1 ? 'producto entró' : 'productos entraron'} al inventario.`,
        });
      },
      onError: onFail,
    }),
  };
}
