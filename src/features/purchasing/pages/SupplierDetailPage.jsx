import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Mail, PackageCheck, Pencil, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { StatCard } from '@/components/ui/stat-card.jsx';
import { EmptyState, ErrorState, PageLoader } from '@/components/feedback/states.jsx';
import { usePermission } from '@/hooks/usePermission';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/format';
import { useSupplier, usePurchaseOrders } from '../hooks/usePurchasing.js';
import { SupplierFormDialog } from '../components/SupplierFormDialog.jsx';

const STATUS_VARIANTS = {
  DRAFT: 'outline',
  CONFIRMED: 'default',
  PARTIALLY_RECEIVED: 'warning',
  RECEIVED: 'success',
  CANCELLED: 'secondary',
  CLOSED: 'secondary',
};

/**
 * Ficha del proveedor.
 *
 * Un proveedor no es un contacto que se abre para cambiarle el teléfono: es una
 * relación de abastecimiento. Junta lo que antes vivía repartido —el contacto en
 * «Proveedores», las órdenes en «Compras»— usando datos que el servidor ya
 * calculaba (`stats` de `GET /suppliers/:id`) sin que ninguna pantalla los
 * mostrara.
 */
export function SupplierDetailPage() {
  const { id } = useParams();
  const { can } = usePermission();
  const [editing, setEditing] = useState(false);

  const { data, isPending, isError, error, refetch } = useSupplier(id ?? null);
  const { data: ordersData, isPending: loadingOrders } = usePurchaseOrders({
    supplierId: id,
    limit: 6,
  });

  if (isPending) return <PageLoader label="Cargando proveedor…" />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const supplier = data;
  const orders = ordersData?.items ?? [];
  const stats = supplier.stats ?? { orders: 0, total: null, lastPurchaseAt: null };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="-ml-3" asChild>
            <Link to="/proveedores">
              <ArrowLeft aria-hidden="true" />
              Proveedores
            </Link>
          </Button>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{supplier.name}</h1>
            {supplier.isActive ? (
              <Badge variant="success">Activo</Badge>
            ) : (
              <Badge variant="secondary">Inactivo</Badge>
            )}
          </div>

          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="font-mono">{supplier.code}</span>
            {supplier.taxId && <span>{supplier.taxId}</span>}
            {supplier.email && (
              <span className="flex items-center gap-1.5">
                <Mail className="size-3.5" aria-hidden="true" />
                {supplier.email}
              </span>
            )}
            {supplier.phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="size-3.5" aria-hidden="true" />
                {supplier.phone}
              </span>
            )}
          </p>
        </div>

        {can('purchases:create') && (
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil aria-hidden="true" />
            Editar
          </Button>
        )}
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Comprado en total"
          value={stats.total ? formatMoney(stats.total) : '—'}
          icon={PackageCheck}
          featured
          delay={0}
        />
        <StatCard label="Órdenes registradas" value={String(stats.orders)} delay={40} />
        <StatCard
          label="Última compra"
          value={stats.lastPurchaseAt ? formatDate(stats.lastPurchaseAt) : 'Sin compras aún'}
          delay={80}
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Órdenes recientes</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/compras?proveedorId=${id}`}>
              Ver todas
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {loadingOrders ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : orders.length === 0 ? (
            <EmptyState
              title="Sin órdenes todavía"
              description="Las órdenes de compra que le haga a este proveedor aparecerán aquí."
              className="border-none p-6"
            />
          ) : (
            <ul className="divide-y">
              {orders.map((order) => (
                <li key={order.id}>
                  <Link
                    to={`/compras/${order.id}`}
                    className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-accent"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-xs">{order.number}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(order.issuedAt)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-medium tabular-nums">{formatMoney(order.total)}</span>
                      <Badge variant={STATUS_VARIANTS[order.status] ?? 'secondary'}>
                        {order.statusLabel}
                      </Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {(supplier.address || supplier.contactName || supplier.paymentTermDays > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Condiciones y contacto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0 text-sm text-muted-foreground">
            {supplier.contactName && <p>Contacto: {supplier.contactName}</p>}
            <p>
              {supplier.sellsOnCredit
                ? `Vende a crédito, ${supplier.paymentTermDays} días de plazo.`
                : 'Vende de contado.'}
            </p>
            {supplier.address && <p>{supplier.address}</p>}
          </CardContent>
        </Card>
      )}

      <SupplierFormDialog open={editing} onOpenChange={setEditing} supplier={supplier} />
    </div>
  );
}
