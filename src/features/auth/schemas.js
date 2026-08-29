import { z } from 'zod';

/**
 * Validación del formulario de inicio de sesión.
 *
 * Duplica intencionadamente la del servidor, pero con otro propósito: aquí da
 * respuesta inmediata al usuario, allí es la que protege el sistema. **La del
 * cliente nunca es seguridad**: se puede desactivar desde el navegador
 * (docs/04-multitenant-seguridad-auditoria.md §5).
 */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Escriba su correo electrónico.')
    .email('El correo no tiene un formato válido.'),
  password: z.string().min(1, 'Escriba su contraseña.'),
  remember: z.boolean().default(false),
});

/** @typedef {z.infer<typeof loginSchema>} LoginFormValues */
