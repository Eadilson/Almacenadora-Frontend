import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Minus, Plus, Search, ShoppingCart, Trash2, TriangleAlert, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { EmptyState } from '@/components/feedback/states.jsx';
import { usePermission } from '@/hooks/usePermission';
import { useSession } from '@/hooks/useSession';
import { useDebounced } from '@/hooks/useDebounced';
import { formatMoney } from '@/lib/money';
import { formatQuantity } from '@/lib/format';
import { useStock } from '@/features/inventory/hooks/useInventory.js';
import { CheckoutDialog } from '../components/CheckoutDialog.jsx';
import { useCustomers } from '../hooks/useSales.js';

/**
 * Punto de venta.
 *
 * Es la pantalla que más se usa al día, así que está pensada para el teclado: se
 * busca, se pulsa Enter y el producto entra al carrito. Un cajero con cola no debe
 * tener que alcanzar el ratón para cada artículo.
 *
 * Se busca sobre existencias y no sobre el catálogo: lo que el cajero necesita
 * saber antes de vender es si hay, y cuánto.
 */
export function PosPage() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const { user, tenant, activeBranchId } = useSession();

  const branches = user?.branches ?? [];
  const [branchId, setBranchId] = useState(activeBranchId ?? branches[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState(/** @type {any[]} */ ([]));
  const [customerId, setCustomerId] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);

  const searchInput = useRef(/** @type {HTMLInputElement|null} */ (null));
  const debouncedSearch = useDebounced(search, 250);
  const currency = tenant?.currency ?? 'GTQ';

  const { data: stockData, isFetching } = useStock({
    branchId: branchId || undefined,
    search: debouncedSearch || undefined,
    page: 1,
    limit: 8,
  });

  const { data: customersData } = useCustomers({ status: 'ACTIVE', limit: 100 });

  const results = debouncedSearch ? (stockData?.items ?? []) : [];
  const customers = customersData?.items ?? [];
  const selectedCustomer = customers.find((customer) => customer.id === customerId) ?? null;

  // El foco vuelve a la búsqueda tras cada acción: es donde el cajero necesita
  // estar siempre.
  useEffect(() => {
    searchInput.current?.focus();
  }, [cart.length]);

  /** @param {any} row */
  const addToCart = (row) => {
    const available = Number(row.available);

    setCart((current) => {
      const existing = current.find((line) => line.productId === row.productId);

      if (existing) {
        // No se deja pasar del disponible: el servidor lo rechazaría igual, pero
        // avisar aquí evita que el cajero descubra el problema al cobrar, con el
        // cliente delante.
        if (existing.quantity + 1 > available) return current;
        return current.map((line) =>
          line.productId === row.productId ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }

      if (available < 1) return current;

      return [
        ...current,
        {
          productId: row.productId,
          sku: row.product.sku,
          name: row.product.name,
          unitPrice: row.product.salePrice,
          quantity: 1,
          available,
        },
      ];
    });

    setSearch('');
  };

  /** @param {string} productId @param {number} delta */
  const changeQuantity = (productId, delta) => {
    setCart((current) =>
      current
        .map((line) => {
          if (line.productId !== productId) return line;
          const next = line.quantity + delta;
          if (next > line.available) return line;
          return { ...line, quantity: next };
        })
        .filter((line) => line.quantity > 0),
    );
  };

  /** @param {string} productId */
  const removeLine = (productId) => {
    setCart((current) => current.filter((line) => line.productId !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setCustomerId('');
  };

  // Previsualización de totales. El importe que se cobra lo calcula el servidor con
  // aritmética exacta de centavos; esto solo orienta al cajero mientras arma la venta.
  const total = useMemo(
    () => cart.reduce((sum, line) => sum + line.unitPrice.amount * line.quantity, 0),
    [cart],
  );

  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
      {/* Búsqueda y resultados */}
      <div className="space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Punto de venta</h1>

          {branches.length > 1 && (
            <Select
              value={branchId}
              onChange={(event) => {
                setBranchId(event.target.value);
                clearCart();
              }}
              className="w-48"
              aria-label="Sucursal"
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          )}
        </header>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            ref={searchInput}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              // Enter añade el primer resultado: con lector de código de barras, el
              // producto entra al carrito sin tocar nada más.
              if (event.key === 'Enter' && results.length > 0) {
                event.preventDefault();
                addToCart(results[0]);
              }
              if (event.key === 'Escape') setSearch('');
            }}
            placeholder="Escanee o escriba nombre, código o código de barras…"
            className="h-14 pl-11 text-base"
            aria-label="Buscar productos para vender"
            autoFocus
          />
        </div>

        {search && results.length === 0 && !isFetching && (
          <EmptyState
            title="Sin coincidencias"
            description="No hay productos con existencia que coincidan con la búsqueda."
          />
        )}

        <ul className="grid gap-2 sm:grid-cols-2">
          {results.map((row) => {
            const available = Number(row.available);
            const inCart = cart.find((line) => line.productId === row.productId);
            const remaining = available - (inCart?.quantity ?? 0);

            return (
              <li key={row.id}>
                <button
                  type="button"
                  disabled={remaining < 1}
                  onClick={() => addToCart(row)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.product.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{row.product.sku}</p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="font-medium">{formatMoney(row.product.salePrice)}</p>
                    <Badge variant={remaining > 0 ? 'secondary' : 'destructive'} className="mt-0.5">
                      {remaining > 0 ? `${formatQuantity(String(remaining))} disp.` : 'Sin existencia'}
                    </Badge>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Carrito */}
      <aside className="lg:sticky lg:top-6 lg:h-fit">
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-medium">
                <ShoppingCart className="size-4" aria-hidden="true" />
                Venta
                {itemCount > 0 && <Badge variant="secondary">{itemCount}</Badge>}
              </h2>

              {cart.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearCart}>
                  <X aria-hidden="true" />
                  Vaciar
                </Button>
              )}
            </div>

            {cart.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Busque un producto para empezar.
              </p>
            ) : (
              <ul className="max-h-80 space-y-2 overflow-auto">
                {cart.map((line) => (
                  <li key={line.productId} className="space-y-1.5 rounded-md border p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{line.name}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{line.sku}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0"
                        aria-label={`Quitar ${line.name}`}
                        onClick={() => removeLine(line.productId)}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-7"
                          aria-label="Quitar una unidad"
                          onClick={() => changeQuantity(line.productId, -1)}
                        >
                          <Minus className="size-3.5" aria-hidden="true" />
                        </Button>
                        <span className="w-8 text-center text-sm tabular">{line.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-7"
                          disabled={line.quantity >= line.available}
                          aria-label="Agregar una unidad"
                          onClick={() => changeQuantity(line.productId, 1)}
                        >
                          <Plus className="size-3.5" aria-hidden="true" />
                        </Button>
                      </div>

                      <span className="text-sm font-medium tabular">
                        {formatMoney({ amount: line.unitPrice.amount * line.quantity, currency })}
                      </span>
                    </div>

                    {line.quantity >= line.available && (
                      <p className="text-[11px] text-warning">
                        Es todo lo que hay en existencia.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <Separator />

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="pos-cliente">
                Cliente
              </label>
              <div className="flex gap-2">
                <Select
                  id="pos-cliente"
                  value={customerId}
                  onChange={(event) => setCustomerId(event.target.value)}
                  className="flex-1"
                >
                  <option value="">Consumidor final</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                      {customer.credit.enabled ? ' · con crédito' : ''}
                    </option>
                  ))}
                </Select>

                {can('customers:create') && (
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Registrar cliente"
                    onClick={() => navigate('/clientes')}
                  >
                    <UserPlus aria-hidden="true" />
                  </Button>
                )}
              </div>

              {selectedCustomer && !selectedCustomer.credit.enabled && (
                <p className="text-[11px] text-muted-foreground">
                  Sin crédito habilitado: esta venta debe cobrarse de contado.
                </p>
              )}
            </div>

            <Separator />

            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-2xl font-semibold tabular">
                {formatMoney({ amount: total, currency })}
              </span>
            </div>

            {tenant?.settings?.priceIncludesTax === true && (
              <p className="text-[11px] text-muted-foreground">Impuesto incluido en el precio.</p>
            )}

            <Button
              size="pos"
              className="w-full"
              disabled={cart.length === 0}
              onClick={() => setCheckingOut(true)}
            >
              Cobrar
            </Button>
          </CardContent>
        </Card>

        {cart.length > 0 && (
          <Alert variant="info" className="mt-3">
            <TriangleAlert aria-hidden="true" />
            <AlertDescription className="text-xs">
              El inventario se descuenta al confirmar el cobro, no antes.
            </AlertDescription>
          </Alert>
        )}
      </aside>

      <CheckoutDialog
        open={checkingOut}
        onOpenChange={setCheckingOut}
        cart={cart}
        total={total}
        branchId={branchId}
        customer={selectedCustomer}
        onCompleted={() => {
          setCheckingOut(false);
          clearCart();
        }}
      />
    </div>
  );
}
