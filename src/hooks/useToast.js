import { useContext, useMemo } from 'react';
import { ToastContext } from '@/app/contexts';

/**
 * Avisos temporales.
 *
 * El proveedor publica la función como `notify`, que describe lo que hace desde
 * su lado. Quien la usa la llama `toast(...)`, que es como aparece en todas las
 * pantallas. Este hook traduce entre ambos nombres: es justo para lo que sirve un
 * hook envoltorio, y evita tener que renombrar la implementación o los diez
 * sitios que la consumen.
 *
 * No es un detalle cosmético. Mientras `toast` llegó sin definir, cada `onSuccess`
 * de TanStack Query lanzaba «toast is not a function»: la mutación quedaba
 * rechazada **después** de que el servidor ya había guardado, y el formulario
 * —que captura el error para pintar los mensajes de campo— se lo tragaba. El
 * resultado visible era el peor posible: el registro se creaba, el diálogo no se
 * cerraba y no aparecía ningún aviso, así que la persona volvía a pulsar y creaba
 * un duplicado.
 *
 * @returns {{
 *   toast: import('@/app/contexts').ToastContextValue['notify'],
 *   toasts: import('@/app/contexts').ToastContextValue['toasts'],
 *   dismiss: import('@/app/contexts').ToastContextValue['dismiss'],
 * }}
 */
export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast debe usarse dentro de <ToastProvider>.');
  }

  return useMemo(
    () => ({ toast: context.notify, toasts: context.toasts, dismiss: context.dismiss }),
    [context],
  );
}
