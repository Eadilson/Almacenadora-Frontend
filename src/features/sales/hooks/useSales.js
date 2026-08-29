import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { salesApi } from '@/api/endpoints/sales';
import { queryKeys } from '@/api/queryKeys';
import { useToast } from '@/hooks/useToast';

/**
 * Datos de ventas.
 *
 * Confirmar una venta cambia inventario, kardex y ventas a la vez, así que la
 * mutación invalida los tres. Refrescar solo la lista de ventas dejaría la pantalla
 * de existencias mostrando cantidades que ya no son ciertas.
 */

/**
 * @param {Record<string, unknown>} filters
 */
export function useCustomers(filters = {}) {
  return useQuery({
    queryKey: queryKeys.customers.list(filters),
    queryFn: () => salesApi.listCustomers(filters),
    placeholderData: (previous) => previous,
  });
}

/**
 * @param {Record<string, unknown>} filters
 */
export function useSalesList(filters = {}) {
  return useQuery({
    queryKey: queryKeys.sales.list(filters),
    queryFn: () => salesApi.listSales(filters),
    placeholderData: (previous) => previous,
  });
}

/**
 * @param {string|null} id
 */
export function useSale(id) {
  return useQuery({
    queryKey: queryKeys.sales.detail(id ?? 'none'),
    queryFn: () => salesApi.getSale(/** @type {string} */ (id)),
    enabled: Boolean(id),
  });
}

/**
 * @param {Record<string, unknown>} filters
 */
export function useSalesSummary(filters = {}) {
  return useQuery({
    queryKey: [...queryKeys.sales.all, 'summary', filters],
    queryFn: () => salesApi.summary(filters),
  });
}

/**
 * @returns {Record<string, any>}
 */
export function useSalesMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidateEverything = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.sales.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    // Una devolución puede bajar la deuda de la cuenta del cliente.
    void queryClient.invalidateQueries({ queryKey: queryKeys.credit.all });
  };

  /** @param {any} error */
  const onFail = (error) => {
    if (error.isValidation) return;
    toast({ variant: 'destructive', title: error.message });
  };

  return {
    createSale: useMutation({
      mutationFn: salesApi.createSale,
      onSuccess: (result) => {
        invalidateEverything();
        toast({
          variant: 'success',
          title: `Venta ${result.sale.number} confirmada`,
          description: result.invoice
            ? `Factura ${result.invoice.number} · ${result.sale.total.formatted}`
            : result.sale.total.formatted,
        });
      },
      onError: onFail,
    }),

    voidSale: useMutation({
      mutationFn: salesApi.voidSale,
      onSuccess: (result) => {
        invalidateEverything();
        toast({
          variant: 'success',
          title: `Venta ${result.sale.number} anulada`,
          description: 'La mercancía volvió al inventario.',
        });
      },
      onError: onFail,
    }),

    returnSale: useMutation({
      mutationFn: salesApi.returnSale,
      onSuccess: (result) => {
        invalidateEverything();
        toast({
          variant: 'success',
          title: `Nota de crédito ${result.creditNote.number} emitida`,
          description: `Reembolso de ${result.refundTotal.formatted}.`,
        });
      },
      onError: onFail,
    }),

    createCustomer: useMutation({
      mutationFn: salesApi.createCustomer,
      onSuccess: (customer) => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
        toast({ variant: 'success', title: `Cliente ${customer.code} creado` });
      },
      onError: onFail,
    }),

    updateCustomer: useMutation({
      mutationFn: salesApi.updateCustomer,
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
        toast({ variant: 'success', title: 'Cliente actualizado' });
      },
      onError: onFail,
    }),
  };
}
