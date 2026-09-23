import { Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import { Card } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { formatMoney } from '@/lib/money';

/**
 * Producto, en catálogo.
 *
 * La foto es real cuando existe (`product.images`, ya expuesto por la API —
 * no hay todavía dónde subirla, pero el día que la haya, esta tarjeta la usa
 * sin tocar nada): mientras tanto, un ícono discreto ocupa su lugar en vez de
 * fingir una fotografía que no existe.
 *
 * Es un enlace real, no un `div` con `onClick`: así el teclado y el clic
 * derecho «abrir en pestaña nueva» funcionan solos, sin reconstruirlos a mano.
 *
 * @param {object} props
 * @param {any} props.product
 * @param {string} [props.categoryName]
 * @param {boolean} [props.canSeeCost]
 */
export function ProductCard({ product, categoryName, canSeeCost = false }) {
  const image = product.images?.find((/** @type {any} */ img) => img.isPrimary) ?? product.images?.[0];

  return (
    <Card interactive className="overflow-hidden">
      <Link to={`/productos/${product.id}`} className="block focus-visible:outline-none">
        <div className="flex aspect-square items-center justify-center bg-muted">
          {image ? (
            <img src={image.url} alt="" className="size-full object-cover" />
          ) : (
            <Package className="size-9 text-muted-foreground/30" aria-hidden="true" />
          )}
        </div>

        <div className="space-y-1.5 p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 text-sm font-medium leading-snug">{product.name}</p>
            {product.isActive ? (
              <Badge variant="success" className="shrink-0">
                Activo
              </Badge>
            ) : (
              <Badge variant="secondary" className="shrink-0">
                Inactivo
              </Badge>
            )}
          </div>

          <p className="truncate font-mono text-xs text-muted-foreground">
            {product.sku}
            {categoryName && ` · ${categoryName}`}
          </p>

          <div className="flex items-baseline justify-between pt-1">
            <p className="font-semibold tabular-nums">{formatMoney(product.salePrice)}</p>
            {canSeeCost && product.marginBasisPoints != null && (
              <span
                className={`text-xs tabular-nums ${product.sellsBelowCost ? 'font-medium text-destructive' : 'text-muted-foreground'}`}
              >
                {(product.marginBasisPoints / 100).toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      </Link>
    </Card>
  );
}
