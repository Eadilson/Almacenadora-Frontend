import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { loginSchema } from '../schemas.js';
import { useSession } from '@/hooks/useSession';
import { ApiError } from '@/api/ApiError';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';

/**
 * Mensajes por código de error.
 *
 * Se traduce el `code`, que es el contrato estable, y no el texto del servidor: así
 * la interfaz puede dar un mensaje más útil y accionable según el caso, y el
 * servidor puede cambiar su redacción sin romper nada
 * (docs/06-api-rest.md §9).
 */
const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Correo o contraseña incorrectos. Verifique e intente de nuevo.',
  ACCOUNT_LOCKED: null, // el servidor indica cuántos segundos faltan: se usa su mensaje
  ACCOUNT_INACTIVE: null,
  RATE_LIMIT_EXCEEDED:
    'Demasiados intentos seguidos. Espere unos minutos antes de volver a intentarlo.',
  NETWORK_ERROR: 'No se pudo conectar con el servidor. Revise su conexión e intente de nuevo.',
};

export function LoginPage() {
  const { login } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState(/** @type {ApiError|null} */ (null));

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: false },
  });

  /** @param {import('../schemas.js').LoginFormValues} values */
  const onSubmit = async (values) => {
    setFormError(null);

    try {
      await login(values);
      // Se vuelve a donde el usuario quería ir antes de que se le pidiera entrar.
      const target = location.state?.from ?? '/';
      navigate(target, { replace: true });
    } catch (error) {
      if (!(error instanceof ApiError)) {
        setFormError(
          new ApiError({ code: 'UNEXPECTED', message: 'Ocurrió un error inesperado.', status: 0 }),
        );
        return;
      }

      // Errores de validación del servidor: se marcan sobre el campo concreto.
      // Uno que no señale ningún campo real de este formulario (`body`/`(raíz)`)
      // no tiene dónde colocarse: cae al mensaje general en vez de perderse.
      if (error.isValidation) {
        const fieldErrors = error.toFormErrors();
        let placed = false;
        for (const [field, message] of Object.entries(fieldErrors)) {
          if (field === 'body' || field === '(raíz)') continue;
          setError(/** @type {any} */ (field), { type: 'server', message });
          placed = true;
        }
        if (placed) return;
      }

      setFormError(error);
    }
  };

  const errorMessage =
    formError &&
    (ERROR_MESSAGES[formError.code] !== undefined
      ? (ERROR_MESSAGES[formError.code] ?? formError.message)
      : formError.message);

  /**
   * La referencia solo acompaña a lo que no se esperaba.
   *
   * Un identificador de veinte caracteres junto a «contraseña incorrecta» no le
   * sirve a nadie: quien se equivocó al teclear no va a llamar a soporte, y el
   * dato sobra justo cuando la persona está apurada por entrar. En cambio, si el
   * servidor falló de verdad, ese código es lo único que permite encontrar la
   * petición en la bitácora.
   */
  const showReference =
    Boolean(formError?.requestId) &&
    (formError.status >= 500 || ERROR_MESSAGES[formError.code] === undefined);

  return (
    <div className="rounded-[2rem] border border-border bg-card p-6 shadow-[0_1px_2px_-1px_rgb(0_0_0/0.1),0_24px_60px_-46px_rgb(0_0_0/0.7)]">
      <div className="mb-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Acceso seguro
        </p>
        <h2 className="text-3xl font-semibold tracking-tight">Entrar al sistema</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Use las credenciales asignadas a su empresa.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {errorMessage && (
            <Alert variant="destructive">
              <AlertDescription>
                {errorMessage}
                {showReference && (
                  <span className="mt-2 block select-all font-mono text-[11px]">
                    Referencia: {formError.requestId}
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" required>
              Correo electrónico
            </Label>
            <Input
              id="email"
              type="email"
              // Ayudas del navegador: autocompletado correcto y sin correcciones
              // automáticas, que en un correo siempre estorban.
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              autoFocus
              placeholder="usuario@empresa.com"
              invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'email-error' : undefined}
              {...register('email')}
            />
            {errors.email && (
              <p id="email-error" className="text-sm text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" required>
              Contraseña
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className="pr-10"
                invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'password-error' : undefined}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>
            {errors.password && (
              <p id="password-error" className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 rounded border-input accent-primary"
              {...register('remember')}
            />
            <span className="text-muted-foreground">Mantener la sesión abierta</span>
          </label>

          <Button type="submit" className="w-full" loading={isSubmitting}>
            {!isSubmitting && <LogIn aria-hidden="true" />}
            {isSubmitting ? 'Verificando…' : 'Entrar'}
          </Button>
        </form>

      <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
        <span>Inventario</span>
        <span>Ventas</span>
        <span>Crédito</span>
      </div>
    </div>
  );
}
