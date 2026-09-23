import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { ArrowLeft, Info, Package, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { FormField } from '@/components/forms/FormField.jsx';
import { MoneyInput } from '@/components/forms/MoneyInput.jsx';
import { ErrorState, PageLoader } from '@/components/feedback/states.jsx';
import { useSession } from '@/hooks/useSession';
import { usePermission } from '@/hooks/usePermission';
import { formatMoney, parseMoneyInput, toMajorString } from '@/lib/money';
import { applyServerErrors } from '@/lib/applyServerErrors';
import { DynamicAttributeField } from '../components/DynamicAttributeField.jsx';
import {
  buildAttributeDefaults,
  buildAttributesSchema,
  toAttributePayload,
} from '../lib/dynamicSchema.js';
import {
  useCatalogMutations,
  useCategories,
  useCategoryAttributes,
  useProduct,
  useUnits,
} from '../hooks/useCatalog.js';

/** Campos comunes a cualquier rubro. */
const baseSchema = z.object({
  // Vacío es válido al crear: el servidor sugiere un código correlativo cuando
  // no se indica uno propio. Al editar siempre trae valor, porque viene
  // precargado del producto y el campo está deshabilitado.
  sku: z
    .string()
    .trim()
    .max(40, 'El código admite hasta 40 caracteres.')
    .optional()
    .refine((value) => !value || /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value), {
      message: 'Use letras, números, punto, guion o guion bajo (por ejemplo: PROD-000042).',
    }),
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(160),
  description: z.string().trim().max(2000).optional().default(''),
  brand: z.string().trim().max(60).optional().default(''),
  categoryId: z.string().min(1, 'Elija una categoría.'),
  unitId: z.string().min(1, 'Elija una unidad de medida.'),
  barcode: z.string().trim().max(64).optional().default(''),
  cost: z.string().trim().min(1, 'Indique el costo.'),
  salePrice: z.string().trim().min(1, 'Indique el precio de venta.'),
  minStock: z.string().trim().optional().default('0'),
});

/**
 * Alta y edición de producto.
 *
 * La mitad de este formulario **no está escrita aquí**: los campos propios del
 * rubro se generan a partir de las definiciones de la categoría elegida, y su
 * validación se construye de esa misma fuente. Al cambiar de categoría cambian los
 * campos, sus reglas y sus opciones, sin que este archivo sepa de joyería ni de
 * ferretería.
 */
export function ProductFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tenant } = useSession();
  const { can } = usePermission();

  const isEditing = Boolean(id);
  const currency = tenant?.currency ?? 'GTQ';

  const { data: categories = [], isPending: loadingCategories } = useCategories();
  const { data: units = [], isPending: loadingUnits } = useUnits();
  const { data: product, isPending: loadingProduct, isError, error } = useProduct(id ?? null);
  const { createProduct, updateProduct, deactivateProduct } = useCatalogMutations();

  // Un rechazo que no es de ningún campo concreto —un permiso, un conflicto,
  // lo que sea— no tiene dónde colocarse sobre el formulario. Antes se ponía
  // sobre el código, pero ese campo está bloqueado al editar: el aviso quedaba
  // en un control que nadie mira, y guardar parecía no hacer nada.
  const [saveError, setSaveError] = useState('');

  // El validador cambia con la categoría, pero `useForm` se declara antes de saber
  // cuál está elegida. Se le pasa un resolver estable que delega en el vigente:
  // así el formulario siempre valida con el esquema de la categoría actual sin
  // recrear el formulario —lo que perdería lo que el usuario lleva escrito—.
  const resolverRef = useRef(zodResolver(baseSchema.extend({ attributes: z.object({}) })));

  const form = useForm({
    resolver: (values, context, options) => resolverRef.current(values, context, options),
    defaultValues: {
      sku: '',
      name: '',
      description: '',
      brand: '',
      categoryId: '',
      unitId: '',
      barcode: '',
      cost: '',
      salePrice: '',
      minStock: '0',
      attributes: {},
    },
  });

  const categoryId = form.watch('categoryId');
  const { data: attributeSet, isFetching: loadingAttributes } = useCategoryAttributes(
    categoryId || null,
  );
  const definitions = useMemo(() => attributeSet?.attributes ?? [], [attributeSet]);

  resolverRef.current = useMemo(
    () => zodResolver(baseSchema.extend({ attributes: buildAttributesSchema(definitions) })),
    [definitions],
  );

  // Carga del producto que se edita.
  useEffect(() => {
    if (!product) return;

    form.reset({
      sku: product.sku,
      name: product.name,
      description: product.description ?? '',
      brand: product.brand ?? '',
      categoryId: product.categoryId,
      unitId: product.unitId,
      barcode: product.barcodes?.[0] ?? '',
      cost: product.cost ? toMajorString(product.cost) : '',
      salePrice: toMajorString(product.salePrice),
      minStock: product.minStock ?? '0',
      attributes: product.attributes ?? {},
    });
  }, [product, form]);

  // Al cambiar de categoría, los atributos anteriores dejan de existir: se reinician
  // con los valores por defecto del nuevo esquema, conservando los que coincidan.
  useEffect(() => {
    if (definitions.length === 0 && !categoryId) return;

    const current = form.getValues('attributes') ?? {};
    form.setValue('attributes', buildAttributeDefaults(definitions, current), {
      shouldValidate: false,
    });
  }, [definitions, categoryId, form]);

  const selectedUnit = units.find((unit) => unit.id === form.watch('unitId'));

  // Vista previa en vivo: los mismos campos que ya se escriben, leídos para
  // mostrar cómo se va a ver el producto en el catálogo — no otra fuente de
  // datos, ni otro cálculo de margen que el que ya hace el servidor.
  const previewName = form.watch('name');
  const previewSku = form.watch('sku');
  const previewCategoryName = categories.find((category) => category.id === categoryId)?.name;
  const previewCost = parseMoneyInput(form.watch('cost'), currency);
  const previewPrice = parseMoneyInput(form.watch('salePrice'), currency);
  const previewMarginBasisPoints =
    previewCost && previewPrice && previewPrice.amount > 0
      ? Math.round(((previewPrice.amount - previewCost.amount) / previewPrice.amount) * 10_000)
      : null;

  /** @param {Record<string, any>} values */
  const onSubmit = async (values) => {
    setSaveError('');
    const cost = parseMoneyInput(values.cost, currency);
    const salePrice = parseMoneyInput(values.salePrice, currency);

    if (!cost) {
      form.setError('cost', { message: 'Importe inválido para la moneda de la empresa.' });
      return;
    }
    if (!salePrice) {
      form.setError('salePrice', { message: 'Importe inválido para la moneda de la empresa.' });
      return;
    }

    const payload = {
      // Vacío se omite del todo, no se manda como cadena vacía: es lo que le dice
      // al servidor que sugiera el siguiente código correlativo.
      ...(values.sku?.trim() ? { sku: values.sku.trim().toUpperCase() } : {}),
      name: values.name.trim(),
      description: values.description?.trim() || '',
      brand: values.brand?.trim() || null,
      categoryId: values.categoryId,
      unitId: values.unitId,
      barcodes: values.barcode?.trim() ? [values.barcode.trim()] : [],
      attributes: toAttributePayload(definitions, values.attributes),
      cost,
      salePrice,
      minStock: values.minStock?.trim() || '0',
    };

    try {
      if (isEditing) {
        // El código y la unidad no se envían al editar: cambiar cualquiera de
        // los dos dejaría sin sentido las cantidades que el historial de
        // ventas y el kardex ya registraron con la unidad original. El
        // servidor los rechaza si llegan — antes llegaban igual, y como el
        // rechazo no señalaba un campo real, guardar parecía no hacer nada.
        const { sku: _sku, unitId: _unitId, ...changes } = payload;
        await updateProduct.mutateAsync({ id: /** @type {string} */ (id), changes });
      } else {
        const created = await createProduct.mutateAsync(payload);
        navigate(`/productos/${created.id}`, { replace: true });
        return;
      }
      navigate('/productos');
    } catch (mutationError) {
      // Los errores por campo del servidor se colocan sobre cada control, incluidos
      // los de atributos del rubro (`attributes.material`). Lo que no señala
      // ningún control real (una clave de cuerpo completo, o cualquier fallo
      // que no sea de validación) se muestra en `saveError` en su lugar.
      applyServerErrors(form, /** @type {any} */ (mutationError), setSaveError, {
        fallbackMessage: 'No se pudo guardar el producto. Inténtelo de nuevo.',
      });
    }
  };

  if (isEditing && loadingProduct) return <PageLoader label="Cargando producto…" />;
  if (isEditing && isError) return <ErrorState error={error} />;

  const saving = createProduct.isPending || updateProduct.isPending;
  const errors = form.formState.errors;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="-ml-3" asChild>
            <Link to="/productos">
              <ArrowLeft aria-hidden="true" />
              Productos
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isEditing ? product?.name : 'Nuevo producto'}
          </h1>
          {isEditing && (
            <p className="font-mono text-sm text-muted-foreground">{product?.sku}</p>
          )}
        </div>

        {isEditing && product?.isActive && can('products:delete') && (
          <Button
            variant="outline"
            onClick={async () => {
              await deactivateProduct.mutateAsync(/** @type {string} */ (id));
              navigate('/productos');
            }}
          >
            <Trash2 aria-hidden="true" />
            Desactivar
          </Button>
        )}
      </header>

      {isEditing && product && !product.isActive && (
        <Alert variant="warning">
          <Info aria-hidden="true" />
          <AlertDescription>
            Este producto está desactivado: no aparece al vender, pero se conserva porque el
            historial de ventas y el kardex lo referencian.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 lg:col-span-2" noValidate>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identificación</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              name="sku"
              label="Código (SKU)"
              error={errors.sku?.message}
              hint={
                isEditing
                  ? 'No se puede cambiar: el historial lo referencia.'
                  : 'Se asigna solo, correlativo, al guardar.'
              }
            >
              {({ id: fieldId, invalid, describedBy }) => (
                <Input
                  id={fieldId}
                  invalid={invalid}
                  aria-describedby={describedBy}
                  // Bloqueado siempre, no solo al editar: escribir uno a mano
                  // abriría la puerta a duplicados y a un formato inconsistente
                  // que después nadie corrige. El correlativo lo pone el servidor.
                  disabled
                  placeholder={isEditing ? undefined : 'Se genera al guardar'}
                  className="font-mono uppercase"
                  autoComplete="off"
                  {...form.register('sku')}
                />
              )}
            </FormField>

            <FormField
              name="barcode"
              label="Código de barras"
              error={errors.barcode?.message}
              hint={
                isEditing
                  ? undefined
                  : 'Si el producto no trae uno de fábrica, se sugiere uno al guardar.'
              }
            >
              {({ id: fieldId, invalid, describedBy }) => (
                <Input
                  id={fieldId}
                  invalid={invalid}
                  aria-describedby={describedBy}
                  placeholder={isEditing ? undefined : 'El de fábrica, o vacío para uno interno'}
                  className="font-mono"
                  autoComplete="off"
                  {...form.register('barcode')}
                />
              )}
            </FormField>

            <FormField
              name="name"
              label="Nombre"
              required
              error={errors.name?.message}
              className="sm:col-span-2"
            >
              {({ id: fieldId, invalid, describedBy }) => (
                <Input
                  id={fieldId}
                  invalid={invalid}
                  aria-describedby={describedBy}
                  placeholder="Anillo solitario oro 18k"
                  {...form.register('name')}
                />
              )}
            </FormField>

            <FormField name="brand" label="Marca" error={errors.brand?.message}>
              {({ id: fieldId, invalid, describedBy }) => (
                <Input
                  id={fieldId}
                  invalid={invalid}
                  aria-describedby={describedBy}
                  {...form.register('brand')}
                />
              )}
            </FormField>

            <FormField
              name="description"
              label="Descripción"
              error={errors.description?.message}
              className="sm:col-span-2"
            >
              {({ id: fieldId, invalid, describedBy }) => (
                <Textarea
                  id={fieldId}
                  invalid={invalid}
                  aria-describedby={describedBy}
                  rows={3}
                  {...form.register('description')}
                />
              )}
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clasificación</CardTitle>
            <CardDescription>
              La categoría determina qué datos propios de su negocio pide este formulario.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField name="categoryId" label="Categoría" required error={errors.categoryId?.message}>
              {({ id: fieldId, invalid, describedBy }) => (
                <Select
                  id={fieldId}
                  invalid={invalid}
                  aria-describedby={describedBy}
                  disabled={loadingCategories}
                  {...form.register('categoryId')}
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
              name="unitId"
              label="Unidad de medida"
              required
              error={errors.unitId?.message}
              hint={
                isEditing
                  ? 'No se puede cambiar: las cantidades ya registradas quedarían en otra unidad.'
                  : selectedUnit
                    ? selectedUnit.isDiscrete
                      ? 'Solo cantidades enteras.'
                      : `Admite ${selectedUnit.decimalPlaces} decimales.`
                    : undefined
              }
            >
              {({ id: fieldId, invalid, describedBy }) => (
                <Select
                  id={fieldId}
                  invalid={invalid}
                  aria-describedby={describedBy}
                  disabled={loadingUnits || isEditing}
                  {...form.register('unitId')}
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
          </CardContent>
        </Card>

        {/* Bloque generado desde la configuración de la empresa. */}
        {categoryId && (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                  <CardTitle className="text-base">
                    Datos de {attributeSet?.categoryName ?? 'la categoría'}
                  </CardTitle>
                  <CardDescription>
                    Campos definidos por su empresa para esta categoría.
                  </CardDescription>
                </div>
                {attributeSet?.trackingMode === 'SERIAL' && (
                  <Badge variant="secondary">Cada unidad se controla por serie</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loadingAttributes && definitions.length === 0 ? (
                <PageLoader label="Cargando campos…" className="min-h-24" />
              ) : definitions.length === 0 ? (
                <Alert variant="info">
                  <Info aria-hidden="true" />
                  <AlertDescription>
                    Esta categoría no tiene campos propios. Puede agregarlos desde{' '}
                    <Link to="/categorias" className="font-medium underline">
                      Categorías
                    </Link>{' '}
                    y aparecerán aquí de inmediato.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {definitions.map((definition) => (
                    <DynamicAttributeField
                      key={definition.key}
                      definition={definition}
                      register={form.register}
                      control={form.control}
                      error={
                        /** @type {any} */ (errors.attributes)?.[definition.key]?.message
                      }
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Precios y existencias</CardTitle>
            <CardDescription>
              Los importes se guardan en {currency} con exactitud de centavos.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <FormField name="cost" label="Costo" required error={errors.cost?.message}>
              {({ id: fieldId, invalid, describedBy }) => (
                <MoneyInput
                  id={fieldId}
                  currency={currency}
                  invalid={invalid}
                  aria-describedby={describedBy}
                  {...form.register('cost')}
                />
              )}
            </FormField>

            <FormField
              name="salePrice"
              label="Precio de venta"
              required
              error={errors.salePrice?.message}
            >
              {({ id: fieldId, invalid, describedBy }) => (
                <MoneyInput
                  id={fieldId}
                  currency={currency}
                  invalid={invalid}
                  aria-describedby={describedBy}
                  {...form.register('salePrice')}
                />
              )}
            </FormField>

            <FormField
              name="minStock"
              label="Stock mínimo"
              error={errors.minStock?.message}
              hint="Avisa cuando la existencia baje de aquí."
            >
              {({ id: fieldId, invalid, describedBy }) => (
                <Input
                  id={fieldId}
                  invalid={invalid}
                  aria-describedby={describedBy}
                  inputMode="decimal"
                  className="text-right tabular"
                  {...form.register('minStock')}
                />
              )}
            </FormField>
          </CardContent>
        </Card>

        {saveError && (
          <Alert variant="destructive">
            <AlertDescription>{saveError}</AlertDescription>
          </Alert>
        )}

        {/*
          Fija abajo, no al final de un formulario largo: nadie debería tener
          que bajar hasta el final para encontrar el botón que ya sabe que va
          a pulsar.
        */}
        <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-background/95 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <Button type="button" variant="outline" onClick={() => navigate('/productos')}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            <Save aria-hidden="true" />
            {saving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear producto'}
          </Button>
        </div>
      </form>

      {/*
        La misma tarjeta que ya se usa en la vista de catálogo, con los
        valores que se están escribiendo: así se ve el resultado antes de
        guardar, no después. Se oculta en pantallas angostas, donde el
        espacio vertical ya lo ocupa el formulario.
      */}
      <aside className="hidden lg:col-span-1 lg:block">
        <div className="sticky top-20 space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Así se ve en el catálogo
          </p>
          <Card className="overflow-hidden">
            <div className="flex aspect-square items-center justify-center bg-muted">
              <Package className="size-9 text-muted-foreground/30" aria-hidden="true" />
            </div>
            <div className="space-y-1.5 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="line-clamp-2 text-sm font-medium leading-snug">
                  {previewName || 'Nombre del producto'}
                </p>
                <Badge variant={isEditing && !product?.isActive ? 'secondary' : 'success'} className="shrink-0">
                  {isEditing && !product?.isActive ? 'Inactivo' : 'Activo'}
                </Badge>
              </div>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {previewSku || (isEditing ? '' : 'Código automático')}
                {previewCategoryName && ` · ${previewCategoryName}`}
              </p>
              <div className="flex items-baseline justify-between pt-1">
                <p className="font-semibold tabular-nums">
                  {previewPrice ? formatMoney(previewPrice) : '—'}
                </p>
                {previewMarginBasisPoints !== null && (
                  <span
                    className={`text-xs tabular-nums ${previewMarginBasisPoints < 0 ? 'font-medium text-destructive' : 'text-muted-foreground'}`}
                  >
                    {(previewMarginBasisPoints / 100).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          </Card>
        </div>
      </aside>
      </div>
    </div>
  );
}
