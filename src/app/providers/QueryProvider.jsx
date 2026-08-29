import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError } from '@/api/ApiError';

/**
 * Cliente de consultas.
 *
 * TanStack Query es **caché de datos del servidor**, no un almacén de estado. Nunca
 * se copia una respuesta a Zustand: hacerlo crea dos verdades y es la causa
 * habitual de datos obsoletos en pantalla (docs/01-arquitectura.md §4.1).
 *
 * @returns {QueryClient}
 */
function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 30 segundos: suficiente para que moverse entre pantallas no relance todo,
        // corto para que los datos operativos no se muestren rancios.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: (failureCount, error) => {
          // No se reintenta lo que no va a cambiar por insistir: credenciales,
          // permisos, recurso inexistente o entrada inválida.
          if (error instanceof ApiError) {
            if (error.status === 0 && error.code === 'REQUEST_CANCELLED') return false;
            if ([400, 401, 403, 404, 409, 422].includes(error.status)) return false;
          }
          return failureCount < 2;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
      mutations: {
        // Las mutaciones **nunca** se reintentan solas: repetir una venta o un abono
        // por decisión del cliente es exactamente lo que no debe pasar. Reintentar es
        // una decisión del usuario, y el servidor la protege con `Idempotency-Key`.
        retry: false,
      },
    },
  });
}

export function QueryProvider({ children }) {
  // El cliente se crea una sola vez por montaje; construirlo en el cuerpo del
  // componente lo recrearía en cada renderizado y vaciaría la caché.
  const [queryClient] = useState(createQueryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
