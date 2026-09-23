import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Boxes, ChevronRight, Info, Plus, Tag, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { PageHeader } from '@/components/ui/page-header.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { FormField } from '@/components/forms/FormField.jsx';
import { EmptyState, ErrorState, PageLoader } from '@/components/feedback/states.jsx';
import { usePermission } from '@/hooks/usePermission';
import { useSession } from '@/hooks/useSession';
import { AttributeForm } from '../components/AttributeForm.jsx';
import { useCatalogMutations, useCategories } from '../hooks/useCatalog.js';
import { applyServerErrors } from '@/lib/applyServerErrors';

const TRACKING_LABELS = {
  NONE: { label: 'Por cantidad', hint: 'Solo se cuentan unidades.' },
  LOT: { label: 'Por lote', hint: 'Con vencimiento por lote.' },
  SERIAL: { label: 'Por serie', hint: 'Cada unidad es única.' },
};

const TYPE_LABELS = {
  STRING: 'Texto',
  NUMBER: 'Entero',
  DECIMAL: 'Decimal',
  BOOLEAN: 'Sí/No',
  DATE: 'Fecha',
  ENUM: 'Lista',
  MULTI_ENUM: 'Lista múltiple',
};

const categorySchema = z.object({
  name: z.string().trim().min(1, 'Escriba el nombre.').max(80),
  trackingMode: z.enum(['NONE', 'LOT', 'SERIAL']),
});

/**
 * Categorías y su esquema de atributos.
 *
 * Es la pantalla donde cada empresa configura **qué datos guarda de sus productos**.
 * Una joyería define material y peso; una ferretería, calibre y color. El programa
 * es el mismo: lo que cambia son estos datos.
 */
export function CategoriesPage() {
  const { can } = usePermission();
  const { tenant } = useSession();
  const { data: categories = [], isPending, isError, error, refetch } = useCategories();
  const { createCategory, addAttribute, removeAttribute, deactivateCategory } = useCatalogMutations();

  const [selectedId, setSelectedId] = useState(/** @type {string|null} */ (null));
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [addingAttribute, setAddingAttribute] = useState(false);
  const [saveError, setSaveError] = useState('');

  const selected = categories.find((category) => category.id === selectedId) ?? categories[0] ?? null;
  const canManage = can('products:update');

  const form = useForm({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', trackingMode: 'NONE' },
  });

  const submitCategory = form.handleSubmit(async (values) => {
    try {
      const created = await createCategory.mutateAsync(values);
      setSelectedId(created.id);
      setCreatingCategory(false);
      form.reset();
    } catch (mutationError) {
      applyServerErrors(form, /** @type {any} */ (mutationError), setSaveError, {
        fallbackMessage: 'No se pudo crear la categoría. Inténtelo de nuevo.',
      });
    }
  });

  if (isPending) return <PageLoader label="Cargando categorías…" />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categorías"
        icon={Tag}
        description={
          <>
            Cada categoría define qué datos se piden al registrar un producto. Así el sistema se
            adapta a {tenant?.tradeName ?? 'su negocio'} sin necesidad de programar nada.
          </>
        }
      >
        {can('products:create') && !creatingCategory && (
          <Button
            onClick={() => {
              setSaveError('');
              setCreatingCategory(true);
            }}
          >
            <Plus aria-hidden="true" />
            Nueva categoría
          </Button>
        )}
      </PageHeader>

      {creatingCategory && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nueva categoría</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitCategory} className="flex flex-wrap items-end gap-3" noValidate>
              <FormField
                name="name"
                label="Nombre"
                required
                error={form.formState.errors.name?.message}
                className="min-w-56 flex-1"
              >
                {({ id, invalid, describedBy }) => (
                  <Input
                    id={id}
                    invalid={invalid}
                    aria-describedby={describedBy}
                    placeholder="Anillos"
                    autoFocus
                    {...form.register('name')}
                  />
                )}
              </FormField>

              <FormField
                name="trackingMode"
                label="Control de existencias"
                error={form.formState.errors.trackingMode?.message}
                hint={TRACKING_LABELS[form.watch('trackingMode')]?.hint}
                className="min-w-48"
              >
                {({ id, invalid, describedBy }) => (
                  <Select
                    id={id}
                    invalid={invalid}
                    aria-describedby={describedBy}
                    {...form.register('trackingMode')}
                  >
                    {Object.entries(TRACKING_LABELS).map(([value, option]) => (
                      <option key={value} value={value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>

              <div className="flex gap-2 pb-1">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setCreatingCategory(false);
                    form.reset();
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createCategory.isPending}>
                  {createCategory.isPending ? 'Creando…' : 'Crear'}
                </Button>
              </div>
            </form>

            {saveError && (
              <Alert variant="destructive" className="mt-3">
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {categories.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="Sin categorías"
          description="Cree la primera para empezar a definir los datos de sus productos."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_1fr]">
          {/* Lista */}
          <nav aria-label="Categorías" className="space-y-1.5">
            {categories.map((category) => {
              const isSelected = selected?.id === category.id;

              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedId(category.id)}
                  aria-current={isSelected ? 'true' : undefined}
                  className={[
                    'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                    isSelected ? 'border-primary bg-accent' : 'hover:bg-accent/60',
                    category.isActive ? '' : 'opacity-60',
                  ].join(' ')}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{category.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {category.attributes.length}{' '}
                      {category.attributes.length === 1 ? 'campo' : 'campos'}
                      {category.productCount !== null && (
                        <> · {category.productCount} productos</>
                      )}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              );
            })}
          </nav>

          {/* Detalle */}
          {selected && (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle>{selected.name}</CardTitle>
                    <CardDescription className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {TRACKING_LABELS[selected.trackingMode]?.label}
                      </Badge>
                      {!selected.isActive && <Badge variant="outline">Inactiva</Badge>}
                      <span>{TRACKING_LABELS[selected.trackingMode]?.hint}</span>
                    </CardDescription>
                  </div>

                  {canManage && !addingAttribute && (
                    <Button size="sm" onClick={() => setAddingAttribute(true)}>
                      <Plus aria-hidden="true" />
                      Agregar campo
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {addingAttribute && (
                  <AttributeForm
                    saving={addAttribute.isPending}
                    onCancel={() => setAddingAttribute(false)}
                    onSubmit={async (definition) => {
                      try {
                        await addAttribute.mutateAsync({ categoryId: selected.id, definition });
                        setAddingAttribute(false);
                      } catch {
                        // El aviso ya lo puso el toast de la mutación (clave repetida,
                        // categoría con productos que exigirían un valor por defecto…);
                        // aquí solo se evita que el rechazo quede sin capturar y el
                        // formulario se cierre como si hubiera guardado.
                      }
                    }}
                  />
                )}

                {selected.attributes.length === 0 ? (
                  <Alert variant="info">
                    <Info aria-hidden="true" />
                    <AlertDescription>
                      Esta categoría todavía no pide ningún dato propio. Agregue los campos que su
                      negocio necesita —material, calibre, talla— y aparecerán al instante en la
                      ficha de producto.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {selected.attributes.map((attribute) => (
                      <li key={attribute.key} className="flex items-start gap-3 p-3">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{attribute.label}</span>
                            {attribute.required && (
                              <Badge variant="warning" className="text-[10px]">
                                Obligatorio
                              </Badge>
                            )}
                            {attribute.filterable && (
                              <Badge variant="outline" className="text-[10px]">
                                Filtrable
                              </Badge>
                            )}
                            {attribute.showInList && (
                              <Badge variant="outline" className="text-[10px]">
                                En lista
                              </Badge>
                            )}
                          </div>

                          <p className="text-xs text-muted-foreground">
                            <span className="font-mono">{attribute.key}</span> ·{' '}
                            {TYPE_LABELS[attribute.type] ?? attribute.type}
                            {attribute.scale !== null && attribute.type === 'DECIMAL' && (
                              <> · {attribute.scale} decimales</>
                            )}
                            {attribute.unit && <> · {attribute.unit}</>}
                          </p>

                          {attribute.options.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {attribute.options.map((option) => (
                                <Badge key={option} variant="secondary" className="text-[10px]">
                                  {option}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Eliminar ${attribute.label}`}
                            disabled={removeAttribute.isPending}
                            onClick={() =>
                              removeAttribute.mutate({
                                categoryId: selected.id,
                                key: attribute.key,
                              })
                            }
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {can('products:delete') && selected.isActive && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">
                        Solo puede desactivarse si no tiene productos activos.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={deactivateCategory.isPending}
                        onClick={() => deactivateCategory.mutate(selected.id)}
                      >
                        <X aria-hidden="true" />
                        Desactivar categoría
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Alert variant="info">
        <Boxes aria-hidden="true" />
        <AlertDescription>
          Los campos que defina aquí se validan también en el servidor, con estas mismas reglas. Un
          campo obligatorio no se puede saltar desde el navegador.
        </AlertDescription>
      </Alert>
    </div>
  );
}
