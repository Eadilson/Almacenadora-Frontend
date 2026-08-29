import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Search, Trash2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { FormField } from '@/components/forms/FormField.jsx';
import { MoneyInput } from '@/components/forms/MoneyInput.jsx';
import { EmptyState } from '@/components/feedback/states.jsx';
import { useSession } from '@/hooks/useSession';
import { useDebounced } from '@/hooks/useDebounced';
import { formatMoney, parseMoneyInput, toMajorString } from '@/lib/money';
import { useProducts } from '@/features/catalog/hooks/useCatalog.js';
import { useSuppliers, usePurchasingMutations } from '../hooks/usePurchasing.js';

/**
 * Alta de una orden de compra.
 *
 * Los totales se muestran calculados en vivo, pero el que vale es el que devuelve
 * el servidor: aquí solo se previsualiza. Enviar un total desde el navegador sería
 * confiar en el cliente para algo que decide cuánto se debe.
 */
export function PurchaseOrderFormPage() {
  const navigate = useNavigate();
  const { tenant, user, activeBranchId } = useSession();
  const { createOrder } = usePurchasingMutations();

  const currency = tenant?.currency ?? 'GTQ';
  const branches = user?.branches ?? [];

  const [supplierId, setSupplierId] = useState('');
  const [branchId, setBranchId] = useState(activeBranchId ?? branches[0]?.id ?? '');
  const [expectedAt, setExpectedAt] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState(/** @type {any[]} */ ([]));
  const [freight, setFreight] = useState('');
  const [distribution, setDistribution] = useState('BY_VALUE');
  const [productSearch, setProductSearch] = useState('');
  const [errors, setErrors] = useState(/** @type {Record<string, string>} */ ({}));

  const debouncedSearch = useDebounced(productSearch, 300);
  const { data: suppliersData } = useSuppliers({ isActive: 'true', limit: 100 });
  const { data: productsData } = useProducts({
    search: debouncedSearch || undefined,
    isActive: 'true',
    limit: 8,
  });

  const suppliers = suppliersData?.items ?? [];
  const searchResults = productsData?.items ?? [];

  /** @param {any} product */
  const addLine = (product) => {
    if (lines.some((line) => line.productId === product.id)) return;

    setLines((current) => [
      ...current,
      {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        quantity: '1',
        // Se propone el costo que ya tiene el producto: en la mayoría de las
        // compras se repite, y escribirlo cada vez es trabajo inútil.
        unitCost: product.cost ? toMajorString(product.cost) : '',
      },
    ]);
    setProductSearch('');
  };

  /** @param {number} index @param {string} field @param {string} value */
  const updateLine = (index, field, value) => {
    setLines((current) =>
      current.map((line, position) => (position === index ? { ...line, [field]: value } : line)),
    );
  };

  /** @param {number} index */
  const removeLine = (index) => {
    setLines((current) => current.filter((_, position) => position !== index));
  };

  // Previsualización de totales. Se calcula con números sencillos porque es solo
  // orientativa; el importe que se guarda lo calcula el servidor con aritmética
  // exacta de centavos.
  const preview = useMemo(() => {
    const subtotal = lines.reduce((sum, line) => {
      const quantity = Number(String(line.quantity).replace(',', '.')) || 0;
      const cost = Number(String(line.unitCost).replace(',', '.')) || 0;
      return sum + quantity * cost;
    }, 0);

    const extra = Number(String(freight).replace(',', '.')) || 0;
    return { subtotal, extra, total: subtotal + extra };
  }, [lines, freight]);

  const submit = async (confirm) => {
    /** @type {Record<string, string>} */
    const nextErrors = {};

    if (!supplierId) nextErrors.supplierId = 'Elija el proveedor.';
    if (!branchId) nextErrors.branchId = 'Elija la sucursal.';
    if (lines.length === 0) nextErrors.lines = 'Agregue al menos un producto.';

    const payloadLines = [];

    for (const [index, line] of lines.entries()) {
      const quantity = String(line.quantity).replace(',', '.');
      const cost = parseMoneyInput(line.unitCost, currency);

      if (!/^\d+(\.\d+)?$/.test(quantity) || Number(quantity) <= 0) {
        nextErrors[`line-${index}-quantity`] = 'Cantidad inválida.';
        continue;
      }
      if (!cost) {
        nextErrors[`line-${index}-cost`] = 'Costo inválido.';
        continue;
      }

      payloadLines.push({ productId: line.productId, quantity, unitCost: cost });
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const freightAmount = freight.trim() ? parseMoneyInput(freight, currency) : null;
    if (freight.trim() && !freightAmount) {
      setErrors({ freight: 'Importe inválido.' });
      return;
    }

    try {
      const order = await createOrder.mutateAsync({
        supplierId,
        branchId,
        lines: payloadLines,
        additionalCosts: freightAmount
          ? [{ concept: 'Flete', amount: freightAmount, distribution }]
          : [],
        expectedAt: expectedAt || null,
        notes: notes || null,
        confirm,
      });

      navigate(`/compras/${order.id}`);
    } catch (error) {
      const apiError = /** @type {any} */ (error);
      if (apiError?.isValidation) {
        setErrors(apiError.toFormErrors());
      }
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-1">
        <Button variant="ghost" size="sm" className="-ml-3" asChild>
          <Link to="/compras">
            <ArrowLeft aria-hidden="true" />
            Compras
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva orden de compra</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Proveedor y destino</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField name="supplierId" label="Proveedor" required error={errors.supplierId}>
            {({ id, invalid, describedBy }) => (
              <Select
                id={id}
                invalid={invalid}
                aria-describedby={describedBy}
                value={supplierId}
                onChange={(event) => setSupplierId(event.target.value)}
              >
                <option value="">Seleccione…</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                    {supplier.sellsOnCredit ? ` · ${supplier.paymentTermDays} días` : ' · contado'}
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          <FormField name="branchId" label="Sucursal de destino" required error={errors.branchId}>
            {({ id, invalid, describedBy }) => (
              <Select
                id={id}
                invalid={invalid}
                aria-describedby={describedBy}
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          <FormField name="expectedAt" label="Fecha esperada" error={errors.expectedAt}>
            {({ id, invalid, describedBy }) => (
              <Input
                id={id}
                type="date"
                invalid={invalid}
                aria-describedby={describedBy}
                value={expectedAt}
                onChange={(event) => setExpectedAt(event.target.value)}
              />
            )}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Productos</CardTitle>
          <CardDescription>Busque y agregue lo que va a comprar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
              placeholder="Buscar producto por nombre o código…"
              className="pl-9"
              aria-label="Buscar productos"
            />

            {productSearch && searchResults.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
                {searchResults.map((product) => {
                  const added = lines.some((line) => line.productId === product.id);

                  return (
                    <li key={product.id}>
                      <button
                        type="button"
                        disabled={added}
                        onClick={() => addLine(product)}
                        className="flex w-full items-center gap-3 rounded-md p-2 text-left text-sm transition-colors hover:bg-accent disabled:opacity-50"
                      >
                        <span className="font-mono text-xs text-muted-foreground">{product.sku}</span>
                        <span className="min-w-0 flex-1 truncate">{product.name}</span>
                        {added && <Badge variant="secondary">Agregado</Badge>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {errors.lines && <p className="text-xs text-destructive">{errors.lines}</p>}

          {lines.length === 0 ? (
            <EmptyState
              title="Sin productos"
              description="Busque arriba para agregar los que va a comprar."
            />
          ) : (
            <div className="scroll-x">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Producto</th>
                    <th className="pb-2 text-right font-medium">Cantidad</th>
                    <th className="pb-2 text-right font-medium">Costo unitario</th>
                    <th className="pb-2 text-right font-medium">Total</th>
                    <th className="w-px" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lines.map((line, index) => {
                    const quantity = Number(String(line.quantity).replace(',', '.')) || 0;
                    const cost = Number(String(line.unitCost).replace(',', '.')) || 0;

                    return (
                      <tr key={line.productId}>
                        <td className="py-2 pr-3">
                          <p className="font-medium">{line.name}</p>
                          <p className="font-mono text-xs text-muted-foreground">{line.sku}</p>
                        </td>
                        <td className="py-2 pr-3">
                          <Input
                            value={line.quantity}
                            onChange={(event) => updateLine(index, 'quantity', event.target.value)}
                            inputMode="decimal"
                            invalid={Boolean(errors[`line-${index}-quantity`])}
                            className="w-24 text-right tabular"
                            aria-label={`Cantidad de ${line.name}`}
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <MoneyInput
                            currency={currency}
                            value={line.unitCost}
                            onChange={(event) => updateLine(index, 'unitCost', event.target.value)}
                            invalid={Boolean(errors[`line-${index}-cost`])}
                            className="w-36"
                            aria-label={`Costo de ${line.name}`}
                          />
                        </td>
                        <td className="py-2 pr-3 text-right tabular">
                          {formatMoney({
                            amount: Math.round(quantity * cost * 100),
                            currency,
                          })}
                        </td>
                        <td className="py-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Quitar ${line.name}`}
                            onClick={() => removeLine(index)}
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Costos adicionales</CardTitle>
          <CardDescription>
            El flete forma parte de lo que costó tener el producto en la tienda. Se reparte entre las
            líneas y entra al inventario como parte del costo.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField name="freight" label="Flete y otros cargos" error={errors.freight}>
            {({ id, invalid, describedBy }) => (
              <MoneyInput
                id={id}
                currency={currency}
                invalid={invalid}
                aria-describedby={describedBy}
                value={freight}
                onChange={(event) => setFreight(event.target.value)}
              />
            )}
          </FormField>

          <FormField
            name="distribution"
            label="Cómo repartirlo"
            hint={
              distribution === 'BY_VALUE'
                ? 'Los productos más caros cargan más.'
                : 'Se reparte por unidades, como un flete por bulto.'
            }
          >
            {({ id }) => (
              <Select
                id={id}
                value={distribution}
                onChange={(event) => setDistribution(event.target.value)}
                disabled={!freight.trim()}
              >
                <option value="BY_VALUE">Por valor</option>
                <option value="BY_QUANTITY">Por cantidad</option>
              </Select>
            )}
          </FormField>

          <FormField name="notes" label="Notas" className="sm:col-span-2">
            {({ id }) => (
              <Textarea
                id={id}
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Condiciones acordadas, número de cotización…"
              />
            )}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 pt-6 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular">
              {formatMoney({ amount: Math.round(preview.subtotal * 100), currency })}
            </span>
          </div>
          {preview.extra > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Costos adicionales</span>
              <span className="tabular">
                {formatMoney({ amount: Math.round(preview.extra * 100), currency })}
              </span>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <span>Total</span>
            <span className="tabular">
              {formatMoney({ amount: Math.round(preview.total * 100), currency })}
            </span>
          </div>
        </CardContent>
      </Card>

      <Alert variant="info">
        <TriangleAlert aria-hidden="true" />
        <AlertDescription>
          Crear la orden no mueve el inventario. Las existencias cambian cuando registre la
          recepción de la mercancía.
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="outline" onClick={() => navigate('/compras')}>
          Cancelar
        </Button>
        <Button variant="outline" disabled={createOrder.isPending} onClick={() => submit(false)}>
          Guardar borrador
        </Button>
        <Button disabled={createOrder.isPending} onClick={() => submit(true)}>
          <Plus aria-hidden="true" />
          {createOrder.isPending ? 'Creando…' : 'Crear y confirmar'}
        </Button>
      </div>
    </div>
  );
}
