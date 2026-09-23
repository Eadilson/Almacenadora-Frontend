import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CreditCard, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { EmptyState, ErrorState, PageLoader } from '@/components/feedback/states.jsx';
import { usePermission } from '@/hooks/usePermission';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/format';
import { useCustomer, useSalesList } from '../hooks/useSales.js';
import { resolveCustomerCredit } from '../lib/customerCredit.js';
import { useCustomerAccount } from '@/features/credit/hooks/useCredit.js';
import { CustomerFormDialog } from '../components/CustomerFormDialog.jsx';

const STATUS_VARIANTS = {
  CONFIRMED: 'success',
  VOIDED: 'destructive',
  PARTIALLY_RETURNED: 'warning',
  RETURNED: 'secondary',
};

/**
 * Ficha del cliente.
 *
 * Un cliente no es una fila que se abre para cambiarle el teléfono: es una
 * relación comercial. Esta pantalla junta lo que antes vivía repartido —el
 * contacto en «Clientes», la deuda en «Créditos», las compras en «Ventas»—
 * en un solo lugar, con enlaces a la vista completa de cada uno en vez de
 * repetir su lógica aquí.
 *
 * Solo usa datos que ya existen: el listado de ventas ya acepta filtrar por
 * `customerId` (lo mismo que ya usa el filtro de la cartera), así que las
 * «compras recientes» no son una función nueva, son la misma consulta con
 * un filtro que ya existía y nadie mostraba en pantalla.
 */
export function CustomerDetailPage() {
  const { id } = useParams();
  const { can } = usePermission();
  const [editing, setEditing] = useState(false);

  const { data: customer, isPending, isError, error, refetch } = useCustomer(id ?? null);
  const { data: creditData } = useCustomerAccount(id ?? null);
  const { data: salesData, isPending: loadingSales } = useSalesList({
    customerId: id,
    limit: 6,
  });

  if (isPending) return <PageLoader label="Cargando cliente…" />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const sales = salesData?.items ?? [];
  const { account, creditLimit, hasCredit, overdueAmount } = resolveCustomerCredit(
    customer,
    creditData,
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="-ml-3" asChild>
            <Link to="/clientes">
              <ArrowLeft aria-hidden="true" />
              Clientes
            </Link>
          </Button>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
            {customer.status === 'ACTIVE' ? (
              <Badge variant="success">Activo</Badge>
            ) : (
              <Badge variant={customer.status === 'BLOCKED' ? 'destructive' : 'secondary'}>
                {customer.status === 'BLOCKED' ? 'Bloqueado' : 'Inactivo'}
              </Badge>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{customer.code}</span>
            {customer.taxId && <> · {customer.taxId}</>}
            {customer.phone && <> · {customer.phone}</>}
            {customer.email && <> · {customer.email}</>}
          </p>
        </div>

        {can('customers:create') && (
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil aria-hidden="true" />
            Editar
          </Button>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Compras recientes</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/ventas?clienteId=${id}`}>
                Ver todas
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loadingSales ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Cargando…</p>
            ) : sales.length === 0 ? (
              <EmptyState
                title="Sin compras todavía"
                description="Las ventas que se le hagan a este cliente aparecerán aquí."
                className="border-none p-6"
              />
            ) : (
              <ul className="divide-y">
                {sales.map((sale) => (
                  <li key={sale.id}>
                    <Link
                      to={`/ventas/${sale.id}`}
                      className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-accent"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-xs">{sale.number}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(sale.issuedAt)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="font-medium tabular-nums">{formatMoney(sale.total)}</span>
                        <Badge variant={STATUS_VARIANTS[sale.status] ?? 'secondary'}>
                          {sale.statusLabel}
                        </Badge>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Crédito</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {hasCredit ? (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground">Saldo pendiente</p>
                    <p
                      className={`text-2xl font-bold tabular-nums ${overdueAmount > 0 ? 'text-destructive' : ''}`}
                    >
                      {account ? formatMoney(account.balance) : '—'}
                    </p>
                    {overdueAmount > 0 && (
                      <p className="text-xs text-destructive">
                        {formatMoney(account.overdueAmount)} en mora
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Límite {formatMoney(creditLimit)} · {customer.credit?.termDays ?? 0} días
                    de plazo
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Cliente de contado: sin límite de crédito asignado.
                </p>
              )}

              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link to={`/creditos/${id}`}>
                  <CreditCard aria-hidden="true" />
                  Ver cuenta completa
                </Link>
              </Button>
            </CardContent>
          </Card>

          {customer.address && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Dirección</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-muted-foreground">
                {customer.address}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <CustomerFormDialog open={editing} onOpenChange={setEditing} customer={customer} />
    </div>
  );
}
