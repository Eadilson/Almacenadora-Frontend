import { Link } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <FileQuestion className="size-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Esta página no existe</h1>
        <p className="text-sm text-muted-foreground">
          Puede que el enlace esté mal escrito o que la sección aún no esté construida.
        </p>
      </div>
      <Button variant="outline" asChild>
        <Link to="/">Volver al panel</Link>
      </Button>
    </div>
  );
}
