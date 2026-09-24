import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cashApi } from '@/api/endpoints/cash';
import { queryKeys } from '@/api/queryKeys';
import { useToast } from '@/hooks/useToast';

export function useCurrentCash(branchId) {
  return useQuery({
    queryKey: queryKeys.cash.current(branchId ?? 'none'),
    queryFn: cashApi.current,
    enabled: Boolean(branchId),
  });
}

export function useCashSessions(filters) {
  return useQuery({
    queryKey: queryKeys.cash.list(filters),
    queryFn: () => cashApi.list(filters),
    placeholderData: (previous) => previous,
  });
}

export function useCashSession(id, filters) {
  return useQuery({
    queryKey: queryKeys.cash.detail(id ?? 'none', filters),
    queryFn: () => cashApi.detail(id, filters),
    enabled: Boolean(id),
    placeholderData: (previous) => previous,
  });
}

export function useCashMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.cash.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.reports.all });
  };
  const onError = (error) => {
    if (!error.isValidation) toast({ variant: 'destructive', title: error.message });
  };

  return {
    open: useMutation({
      mutationFn: cashApi.open,
      onSuccess: () => {
        refresh();
        toast({ variant: 'success', title: 'Caja abierta' });
      },
      onError,
    }),
    addMovement: useMutation({
      mutationFn: cashApi.addMovement,
      onSuccess: (movement) => {
        refresh();
        toast({ variant: 'success', title: movement.typeLabel });
      },
      onError,
    }),
    close: useMutation({
      mutationFn: cashApi.close,
      onSuccess: (session) => {
        refresh();
        toast({
          variant: session.difference?.amount === 0 ? 'success' : 'warning',
          title: 'Caja cerrada',
          description:
            session.difference?.amount === 0
              ? 'El efectivo contado coincide con el sistema.'
              : `Diferencia registrada: ${session.difference?.formatted}.`,
        });
      },
      onError,
    }),
  };
}
