import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ArrowLeft, ClipboardPaste, Plus, Search, Trash2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { FormField } from '@/components/forms/FormField.jsx';
import { MoneyInput } from '@/components/forms/MoneyInput.jsx';
import { EmptyState } from '@/components/feedback/states.jsx';
import { useSession } from '@/hooks/useSession';
import { useDebounced } from '@/hooks/useDebounced';
import { formatMoney, parseMoneyInput, toMajorString } from '@/lib/money';
import { applyServerErrors } from '@/lib/applyServerErrors';
import { catalogApi } from '@/api/endpoints/catalog';
import { DynamicAttributeField } from '@/features/catalog/components/DynamicAttributeField.jsx';
import {
  buildAttributeDefaults,
  buildAttributesSchema,
  toAttributePayload,
} from '@/features/catalog/lib/dynamicSchema.js';
import {
  useCategories,
  useCategoryAttributes,
  useCatalogMutations,
  useProducts,
  useUnits,
} from '@/features/catalog/hooks/useCatalog.js';
import { useSuppliers, usePurchasingMutations } from '../hooks/usePurchasing.js';

/**
 * Campos fijos del alta rápida. Los propios del rubro —lo que de verdad falló
 * en silencio la primera vez— se agregan aparte, según la categoría elegida:
 * misma fuente y misma validación que el formulario completo de Productos.
 */
const newProductBaseSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(160),
  categoryId: z.string().min(1, 'Elija una categoría.'),
  unitId: z.string().min(1, 'Elija una unidad de medida.'),
  cost: z.string().trim().min(1, 'Indique el costo.'),
  salePrice: z.string().trim().min(1, 'Indique el precio de venta.'),
});

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
  const { createProduct } = useCatalogMutations();
  const { data: categories = [] } = useCategories();
  const { data: units = [] } = useUnits();

  const currency = tenant?.currency ?? 'GTQ';
  const branches = user?.branches ?? [];
  const activeBranch = branches.find((branch) => branch.id === activeBranchId) ?? branches[0];

  const [supplierId, setSupplierId] = useState('');
  const branchId = activeBranch?.id ?? '';
  const [expectedAt, setExpectedAt] = useState('');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState(/** @type {any[]} */ ([]));
  const [freight, setFreight] = useState('');
  const [distribution, setDistribution] = useState('BY_VALUE');
  const [productSearch, setProductSearch] = useState('');
  const [errors, setErrors] = useState(/** @type {Record<string, string>} */ ({}));
  // Un rechazo que no señala ninguna línea ni el flete concreto —una regla de
  // negocio, una caída de red, un error del servidor— no tiene dónde
  // colocarse entre los `errors` por campo: antes se perdía en silencio y el
  // botón simplemente dejaba de girar sin decir por qué.
  const [submitError, setSubmitError] = useState('');
  const [newProductSaveError, setNewProductSaveError] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkReport, setBulkReport] = useState(
    /** @type {{ added: number, notFound: string[] } | null} */ (null),
  );
  const [creatingProduct, setCreatingProduct] = useState(false);

  // El validador cambia con la categoría elegida, igual que en el formulario
  // completo de Productos: por eso el resolver es una referencia estable que
  // delega en el vigente, en vez de recrear el formulario a cada cambio.
  const newProductResolverRef = useRef(zodResolver(newProductBaseSchema.extend({ attributes: z.object({}) })));
  const newProductForm = useForm({
    resolver: (values, context, options) => newProductResolverRef.current(values, context, options),
    defaultValues: { name: '', categoryId: '', unitId: '', cost: '', salePrice: '', attributes: {} },
  });
  const newProductCategoryId = newProductForm.watch('categoryId');
  const { data: newProductAttributeSet } = useCategoryAttributes(newProductCategoryId || null);
  const newProductDefinitions = useMemo(
    () => newProductAttributeSet?.attributes ?? [],
    [newProductAttributeSet],
  );
  newProductResolverRef.current = useMemo(
    () => zodResolver(newProductBaseSchema.extend({ attributes: buildAttributesSchema(newProductDefinitions) })),
    [newProductDefinitions],
  );

  // Al cambiar de categoría, los atributos de la anterior dejan de existir: se
  // reinician con los valores por defecto del nuevo esquema.
  useEffect(() => {
    if (newProductDefinitions.length === 0 && !newProductCategoryId) return;
    const current = newProductForm.getValues('attributes') ?? {};
    newProductForm.setValue('attributes', buildAttributeDefaults(newProductDefinitions, current), {
      shouldValidate: false,
    });
  }, [newProductDefinitions, newProductCategoryId, newProductForm]);

  const debouncedSearch = useDebounced(productSearch, 300);
  // El servidor topa `limit` en 100 (es un listado paginado, no pensado para
  // volcarse entero); un <select> estático ya está mal encajado con eso desde
  // el diseño. Subir el número aquí no serviría —seguiría rechazado— y de
  // todas formas solo pospondría el mismo problema. Lo que corresponde es un
  // combobox con búsqueda, como el que ya tiene el buscador de productos de
  // esta misma pantalla; se deja pendiente como mejora, no como parte de esto.
  const { data: suppliersData } = useSuppliers({ isActive: 'true', limit: 100 });
  const { data: productsData, isFetching: searchingProducts } = useProducts({
    search: debouncedSearch || undefined,
    isActive: 'true',
    limit: 8,
  });

  const suppliers = suppliersData?.items ?? [];
  const searchResults = productsData?.items ?? [];

  /**
   * Agrega un producto a la orden. Si ya estaba en la lista, suma a lo que
   * había en lugar de ignorarlo: es lo que se espera al escanear dos veces el
   * mismo código, o al pegar una lista que repite un producto en dos líneas.
   *
   * @param {any} product
   * @param {number} [quantity]
   * @param {string} [unitCost] Costo mayor ya como texto ("25.50"); si no se
   *   indica, se propone el que ya tiene el producto.
   */
  const addLine = (product, quantity = 1, unitCost = undefined) => {
    setLines((current) => {
      const index = current.findIndex((line) => line.productId === product.id);
      if (index >= 0) {
        return current.map((line, position) =>
          position === index
            ? {
                ...line,
                quantity: String((Number(line.quantity) || 0) + quantity),
                ...(unitCost !== undefined ? { unitCost } : {}),
              }
            : line,
        );
      }

      return [
        ...current,
        {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          quantity: String(quantity),
          // Se propone el costo que ya tiene el producto: en la mayoría de las
          // compras se repite, y escribirlo cada vez es trabajo inútil.
          unitCost: unitCost !== undefined ? unitCost : product.cost ? toMajorString(product.cost) : '',
        },
      ];
    });
    setProductSearch('');
  };

  /**
   * Abre el alta rápida de producto, precargada con lo que se estaba
   * buscando. Antes había que salirse de la compra, ir a Productos, crearlo
   * ahí y volver a buscarlo: el producto nuevo casi siempre se conoce hasta
   * que llega la primera compra, no antes.
   */
  const openCreateProduct = () => {
    newProductForm.reset({
      name: productSearch.trim(),
      categoryId: categories.find((c) => c.name === 'General')?.id ?? categories[0]?.id ?? '',
      unitId: units.find((u) => u.code === 'UN')?.id ?? units[0]?.id ?? '',
      cost: '',
      salePrice: '',
      attributes: {},
    });
    setNewProductSaveError('');
    setCreatingProduct(true);
  };

  const submitNewProduct = newProductForm.handleSubmit(async (values) => {
    const cost = parseMoneyInput(values.cost, currency);
    const salePrice = parseMoneyInput(values.salePrice, currency);

    setNewProductSaveError('');

    if (!cost) {
      newProductForm.setError('cost', { message: 'Importe inválido para la moneda de la empresa.' });
      return;
    }
    if (!salePrice) {
      newProductForm.setError('salePrice', { message: 'Importe inválido para la moneda de la empresa.' });
      return;
    }

    try {
      const product = await createProduct.mutateAsync({
        name: values.name.trim(),
        categoryId: values.categoryId,
        unitId: values.unitId,
        cost,
        salePrice,
        attributes: toAttributePayload(newProductDefinitions, values.attributes),
      });
      // Va directo a la orden con el costo que se acaba de dar: es el mismo
      // que se está pagando en esta compra, no hay por qué volver a escribirlo.
      addLine(product, 1, values.cost);
      setCreatingProduct(false);
    } catch (error) {
      // Los errores por campo del servidor se colocan sobre cada control,
      // incluidos los de atributos del rubro (`attributes.material`); lo que
      // no señala ningún control real se muestra en `newProductSaveError`.
      applyServerErrors(newProductForm, /** @type {any} */ (error), setNewProductSaveError, {
        fallbackMessage: 'No se pudo crear el producto. Inténtelo de nuevo.',
      });
    }
  });

  /**
   * Alta de una compra entera de un solo golpe: se pega una lista —código,
   * cantidad y costo opcional, uno por línea— y se resuelve cada línea contra
   * el catálogo. Es la respuesta directa a tener que agregar producto por
   * producto cuando la compra ya viene armada en un papel o una hoja de cálculo.
   */
  const submitBulk = async () => {
    const rows = bulkText
      .split('\n')
      .map((row) => row.trim())
      .filter(Boolean);

    if (rows.length === 0) return;

    setBulkBusy(true);
    setBulkReport(null);

    // Las búsquedas de cada línea son independientes entre sí: se lanzan todas
    // a la vez en lugar de esperar una por una. `Promise.all` conserva el
    // orden de llegada aunque las respuestas no lleguen en ese orden, así que
    // el reporte final sigue respetando el orden de lo pegado sin pagar el
    // costo de una compra grande esperando una a una.
    const resolved = await Promise.all(
      rows.map(async (row) => {
        const [code, quantityToken, costToken] = row.split(/[\s,;\t]+/).filter(Boolean);
        if (!code) return null;

        const quantity =
          quantityToken && /^\d+(\.\d+)?$/.test(quantityToken) ? Number(quantityToken) : 1;
        const unitCost = costToken && /^\d+(\.\d+)?$/.test(costToken) ? costToken : undefined;

        try {
          const result = await catalogApi.searchProducts({ search: code, isActive: 'true', limit: 5 });
          const items = result.items ?? [];
          const exact = items.find(
            (item) =>
              item.sku?.toLowerCase() === code.toLowerCase() || item.barcodes?.includes(code),
          );
          // Un solo resultado sin coincidencia exacta también se acepta: es el
          // caso de pegar el nombre en vez del código.
          const match = exact ?? (items.length === 1 ? items[0] : null);

          return match ? { code, match, quantity, unitCost } : { code, match: null };
        } catch {
          return { code, match: null };
        }
      }),
    );

    /** @type {string[]} */
    const notFound = [];
    let added = 0;

    // Agregar las líneas sí se hace en orden, una por una: es lo que decide
    // en qué posición queda cada producto y si dos líneas del mismo producto
    // se suman entre sí.
    for (const entry of resolved) {
      if (!entry) continue;
      if (!entry.match) {
        notFound.push(entry.code);
        continue;
      }
      addLine(entry.match, entry.quantity, entry.unitCost);
      added += 1;
    }

    setBulkBusy(false);
    setBulkReport({ added, notFound });
    // El panel se queda abierto con el resultado a la vista: cerrarlo solo,
    // aunque todo se haya resuelto, no dejaría ver que de verdad se agregó.
    setBulkText('');
  };

  /**
   * Alta rápida: buscar, Enter, buscar el siguiente. Sin esto, cada producto
   * de una compra grande exigía soltar el teclado y hacer clic en la lista,
   * uno por uno. Con el foco en el buscador, escanear un código de barras y
   * pulsar Enter agrega la línea sin tocar el mouse.
   *
   * No se apoya en `searchResults`: esos vienen de una búsqueda con 300 ms de
   * espera, y un lector de código de barras escribe y manda Enter mucho más
   * rápido que eso. Usar la lista ya cargada dejaría caer el escaneo en
   * silencio, o peor, agregaría el resultado de la búsqueda anterior. Por eso
   * el Enter dispara su propia consulta inmediata con lo que hay en ese
   * instante en el campo.
   *
   * @param {React.KeyboardEvent<HTMLInputElement>} event
   */
  const handleSearchKeyDown = async (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();

    const term = productSearch.trim();
    if (!term) return;

    const result = await catalogApi.searchProducts({ search: term, isActive: 'true', limit: 5 });
    const items = result.items ?? [];
    if (items.length === 0) return;

    // Un código exacto —de barras o SKU— manda sobre el primer resultado de
    // una búsqueda de texto libre: es lo que trae un lector de códigos.
    const exact = items.find(
      (product) =>
        product.sku?.toLowerCase() === term.toLowerCase() || product.barcodes?.includes(term),
    );
    addLine(exact ?? items[0]);
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
    setSubmitError('');
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
        supplierInvoiceNumber: supplierInvoiceNumber.trim() || null,
        notes: notes || null,
        confirm,
      });

      navigate(`/compras/${order.id}`);
    } catch (error) {
      // Este formulario no usa React Hook Form: se adapta `setErrors` (un
      // objeto plano por campo) a la misma forma que espera el helper
      // compartido. Lo que no señala ningún campo real —una regla de
      // negocio, una caída de red— se muestra en `submitError` en vez de
      // perderse; antes de esto, un error no-validación no mostraba nada.
      const formAdapter = {
        setError: (/** @type {string} */ field, /** @type {{message: string}} */ { message }) =>
          setErrors((prev) => ({ ...prev, [field]: message })),
      };
      applyServerErrors(/** @type {any} */ (formAdapter), /** @type {any} */ (error), setSubmitError, {
        fallbackMessage: 'No se pudo guardar la orden de compra. Inténtelo de nuevo.',
      });
    }
  };

  const newProductFormErrors = newProductForm.formState.errors;

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
              <div
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                className="flex min-h-10 items-center rounded-xl border border-input bg-muted/45 px-3 text-sm font-medium"
              >
                {activeBranch?.name ?? 'Sin punto de venta asignado'}
              </div>
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

          <FormField
            name="supplierInvoiceNumber"
            label="Número de factura del proveedor"
            error={errors.supplierInvoiceNumber}
            hint="El que trae el papel que entrega el proveedor, para conciliar."
          >
            {({ id, invalid, describedBy }) => (
              <Input
                id={id}
                invalid={invalid}
                aria-describedby={describedBy}
                value={supplierInvoiceNumber}
                onChange={(event) => setSupplierInvoiceNumber(event.target.value)}
                className="font-mono"
              />
            )}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Productos</CardTitle>
            <CardDescription>Busque y agregue lo que va a comprar.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={openCreateProduct}>
              <Plus aria-hidden="true" />
              Nuevo producto
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setBulkOpen((open) => !open);
                setBulkReport(null);
              }}
            >
              <ClipboardPaste aria-hidden="true" />
              Pegar lista
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {bulkOpen && (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <FormField
                name="bulkText"
                label="Una línea por producto"
                hint="Código y cantidad, separados por espacio o tabulador. El costo es opcional: código cantidad [costo]."
              >
                {({ id }) => (
                  <Textarea
                    id={id}
                    rows={5}
                    value={bulkText}
                    onChange={(event) => setBulkText(event.target.value)}
                    placeholder={'PROD-000012\t10\t25.50\nPROD-000034\t5\n7501234567890\t3'}
                    className="font-mono text-xs"
                  />
                )}
              </FormField>

              {bulkReport && (
                <div className="space-y-1 text-xs">
                  {bulkReport.added > 0 && (
                    <p className="text-success">
                      {bulkReport.added}{' '}
                      {bulkReport.added === 1 ? 'producto agregado' : 'productos agregados'}.
                    </p>
                  )}
                  {bulkReport.notFound.length > 0 && (
                    <p className="text-destructive">
                      No se encontró: {bulkReport.notFound.join(', ')}. Revise el código y agréguelo
                      abajo a mano.
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setBulkOpen(false);
                    setBulkText('');
                    setBulkReport(null);
                  }}
                >
                  Cerrar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={bulkBusy || !bulkText.trim()}
                  onClick={submitBulk}
                >
                  {bulkBusy ? 'Agregando…' : 'Agregar todo'}
                </Button>
              </div>
            </div>
          )}

          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Buscar o escanear código de barras… Enter agrega"
              className="pl-9"
              aria-label="Buscar productos"
            />

            {productSearch && searchResults.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
                {searchResults.map((product) => {
                  const existing = lines.find((line) => line.productId === product.id);

                  return (
                    <li key={product.id}>
                      <button
                        type="button"
                        onClick={() => addLine(product)}
                        className="flex w-full items-center gap-3 rounded-md p-2 text-left text-sm transition-colors hover:bg-accent"
                      >
                        <span className="font-mono text-xs text-muted-foreground">{product.sku}</span>
                        <span className="min-w-0 flex-1 truncate">{product.name}</span>
                        {/* Un clic más suma otra unidad, no se bloquea: es lo que
                            se espera al escanear el mismo código varias veces. */}
                        {existing && <Badge variant="secondary">×{existing.quantity}</Badge>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* No existe todavía: se da de alta aquí mismo, con lo que ya se
                escribió como nombre, en vez de perder la compra a medio armar
                para ir a crearlo en Productos y volver a buscarlo. */}
            {productSearch && !searchingProducts && searchResults.length === 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                No hay ningún producto que coincida.{' '}
                <button
                  type="button"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                  onClick={openCreateProduct}
                >
                  Crear «{productSearch}» como producto nuevo
                </button>
              </p>
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

      {submitError && (
        <Alert variant="destructive">
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

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

      <Dialog open={creatingProduct} onOpenChange={setCreatingProduct}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo producto</DialogTitle>
            <DialogDescription>
              Se agrega al catálogo y a esta compra en el mismo paso. El código se asigna solo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <FormField name="newProductName" label="Nombre" required error={newProductFormErrors.name?.message}>
              {({ id, invalid, describedBy }) => (
                <Input
                  id={id}
                  invalid={invalid}
                  aria-describedby={describedBy}
                  autoFocus
                  {...newProductForm.register('name')}
                />
              )}
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                name="newProductCategory"
                label="Categoría"
                required
                error={newProductFormErrors.categoryId?.message}
              >
                {({ id, invalid, describedBy }) => (
                  <Select
                    id={id}
                    invalid={invalid}
                    aria-describedby={describedBy}
                    {...newProductForm.register('categoryId')}
                  >
                    <option value="">Seleccione…</option>
                    {categories
                      .filter((category) => category.isActive)
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                  </Select>
                )}
              </FormField>

              <FormField
                name="newProductUnit"
                label="Unidad de medida"
                required
                error={newProductFormErrors.unitId?.message}
              >
                {({ id, invalid, describedBy }) => (
                  <Select
                    id={id}
                    invalid={invalid}
                    aria-describedby={describedBy}
                    {...newProductForm.register('unitId')}
                  >
                    <option value="">Seleccione…</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name} ({unit.code})
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>

              <FormField
                name="newProductCost"
                label="Costo"
                required
                error={newProductFormErrors.cost?.message}
                hint="El de esta compra: se propone igual en la línea."
              >
                {({ id, invalid, describedBy }) => (
                  <MoneyInput
                    id={id}
                    currency={currency}
                    invalid={invalid}
                    aria-describedby={describedBy}
                    {...newProductForm.register('cost')}
                  />
                )}
              </FormField>

              <FormField
                name="newProductSalePrice"
                label="Precio de venta"
                required
                error={newProductFormErrors.salePrice?.message}
              >
                {({ id, invalid, describedBy }) => (
                  <MoneyInput
                    id={id}
                    currency={currency}
                    invalid={invalid}
                    aria-describedby={describedBy}
                    {...newProductForm.register('salePrice')}
                  />
                )}
              </FormField>
            </div>

            {/* Campos propios del rubro, según la categoría elegida arriba: la
                misma fuente y la misma validación que el formulario completo de
                Productos. Antes de esto, un error aquí no tenía dónde mostrarse
                y «Crear y agregar» parecía no hacer nada. */}
            {newProductDefinitions.length > 0 && (
              <div className="space-y-1 border-t pt-4">
                <p className="text-sm font-medium">Datos propios de la categoría</p>
                <div className="grid gap-4 pt-2 sm:grid-cols-2">
                  {newProductDefinitions.map((definition) => (
                    <DynamicAttributeField
                      key={definition.key}
                      definition={definition}
                      register={newProductForm.register}
                      control={newProductForm.control}
                      error={
                        /** @type {any} */ (newProductFormErrors.attributes)?.[definition.key]?.message
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {newProductSaveError && (
              <Alert variant="destructive">
                <AlertDescription>{newProductSaveError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreatingProduct(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={createProduct.isPending} onClick={submitNewProduct}>
              {createProduct.isPending ? 'Creando…' : 'Crear y agregar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
