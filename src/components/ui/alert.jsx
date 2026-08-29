import { forwardRef } from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { alertVariants } from './variants.js';
import { cn } from '@/lib/utils';

const ICONS = {
  default: Info,
  info: Info,
  destructive: AlertCircle,
  success: CheckCircle2,
  warning: TriangleAlert,
};

const ICON_COLORS = {
  default: 'text-muted-foreground',
  info: 'text-primary',
  destructive: 'text-destructive',
  success: 'text-success',
  warning: 'text-warning',
};

/**
 * Aviso en línea.
 *
 * Los errores llevan `role="alert"` para que un lector de pantalla los anuncie de
 * inmediato; el resto no interrumpe la lectura. El icono acompaña al color, de
 * modo que el significado no dependa de distinguir tonos.
 */
export const Alert = forwardRef(({ className, variant = 'default', children, ...props }, ref) => {
  const Icon = ICONS[variant] ?? Info;

  return (
    <div
      ref={ref}
      role={variant === 'destructive' ? 'alert' : 'status'}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <Icon className={ICON_COLORS[variant]} aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">{children}</div>
    </div>
  );
});
Alert.displayName = 'Alert';

export const AlertTitle = forwardRef(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('font-medium leading-none', className)} {...props} />
));
AlertTitle.displayName = 'AlertTitle';

export const AlertDescription = forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
));
AlertDescription.displayName = 'AlertDescription';
