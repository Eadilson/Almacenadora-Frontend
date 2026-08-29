import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { creditApi } from '@/api/endpoints/credit';
import { queryKeys } from '@/api/queryKeys';
import { useToast } from '@/hooks/useToast';

/**
 * Datos de crédito y cartera.
 *
 * Un abono cambia la cuenta del cliente, la cartera, la antigüedad de saldos y la
 * lista de abonos a la vez. Todas se invalidan juntas: refrescar solo la cuenta
 * dejaría el resumen de cartera mostrando una deuda que ya se cobró.
 */

/**
 * @param {Record<string, unknown>} filters
 */
export function usePortfolio(filters = {}) {
  return useQuery({
    queryKey: queryKeys.credit.portfolio(filters),
    queryFn: () => creditApi.listPortfolio(filters),
    placeholderData: (previous) => previous,
  });
}

export function useAging() {
  return useQuery({
    queryKey: queryKeys.credit.aging,
    queryFn: () => creditApi.aging(),
  });
}

/**
 * @param {string|null} customerId
 */
export function useCustomerAccount(customerId) {
  return useQuery({
    queryKey: queryKeys.credit.account(customerId ?? 'none'),
    queryFn: () => creditApi.account(/** @type {string} */ (customerId)),
    enabled: Boolean(customerId),
  });
}

/**
 * @param {string|null} customerId
 * @param {Record<string, unknown>} filters
 */
export function useStatement(customerId, filters = {}) {
  return useQuery({
    queryKey: queryKeys.credit.statement(customerId ?? 'none', filters),
    queryFn: () => creditApi.statement(/** @type {string} */ (customerId), filters),
    enabled: Boolean(customerId),
    placeholderData: (previous) => previous,
  });
}

/**
 * @param {Record<string, unknown>} filters
 */
export function usePayments(filters = {}) {
  return useQuery({
    queryKey: queryKeys.payments.list(filters),
    queryFn: () => creditApi.listPayments(filters),
    placeholderData: (previous) => previous,
  });
}

/**
 * @param {string|null} id
 */
export function usePayment(id) {
  return useQuery({
    queryKey: queryKeys.payments.detail(id ?? 'none'),
    queryFn: () => creditApi.payment(/** @type {string} */ (id)),
    enabled: Boolean(id),
  });
}

/**
 * @returns {Record<string, any>}
 */
export function useCreditMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidateEverything = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.credit.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
    // Una venta al crédito que se cobra cambia lo que el cliente puede volver a
    // llevarse, y eso lo consulta el punto de venta.
    void queryClient.invalidateQueries({ queryKey: queryKeys.sales.all });
  };

  /** @param {any} error */
  const onFail = (error) => {
    if (error.isValidation) return;
    toast({ variant: 'destructive', title: error.message });
  };

  return {
    registerPayment: useMutation({
      mutationFn: creditApi.registerPayment,
      onSuccess: (result) => {
        invalidateEverything();

        const unapplied = result.payment.unappliedAmount;
        toast({
          variant: 'success',
          title: `Abono ${result.payment.number} registrado`,
          description:
            unapplied.amount > 0
              ? `${result.payment.appliedAmount.formatted} aplicados · ${unapplied.formatted} a favor`
              : `${result.payment.amount.formatted} aplicados a ${result.allocations.length} documento(s)`,
        });
      },
      onError: onFail,
    }),

    voidPayment: useMutation({
      mutationFn: creditApi.voidPayment,
      onSuccess: (result) => {
        invalidateEverything();
        toast({
          variant: 'success',
          title: `Abono ${result.payment.number} anulado`,
          description: `El saldo del cliente vuelve a ${result.account.balance.formatted}.`,
        });
      },
      onError: onFail,
    }),

    updatePolicy: useMutation({
      mutationFn: creditApi.updatePolicy,
      onSuccess: () => {
        invalidateEverything();
        toast({ variant: 'success', title: 'Política de crédito actualizada' });
      },
      onError: onFail,
    }),
  };
}
