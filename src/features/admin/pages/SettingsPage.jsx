import { useEffect, useState } from 'react';
import { Building2, Info, Plus, Settings, Star } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { PageHeader } from '@/components/ui/page-header.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { FormField } from '@/components/forms/FormField.jsx';
import { ErrorState, PageLoader } from '@/components/feedback/states.jsx';
import { BranchDialog } from '../components/BranchDialog.jsx';
import { useAdminMutations, useBranches, useCompany } from '../hooks/useAdmin.js';

/** Zonas horarias de Centroamérica y las que suele necesitar un comercio de la región. */
const TIMEZONES = [
  'America/Guatemala',
  'America/El_Salvador',
  'America/Tegucigalpa',
  'America/Managua',
  'America/Costa_Rica',
  'America/Panama',
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
];

/**
 * Configuración de la empresa.
 *
 * Reúne lo que antes había que cambiar tocando la base de datos. Las decisiones
 * que ya no se pueden deshacer —la moneda, el plan— se muestran pero no se editan,
 * y se explica por qué en lugar de dejar un campo gris sin motivo aparente.
 */
export function SettingsPage() {
  const { updateCompany } = useAdminMutations();

  const { data: company, isPending, isError, error, refetch } = useCompany();
  const { data: branches } = useBranches();

  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [timezone, setTimezone] = useState('');
  const [settings, setSettings] = useState(/** @type {Record<string, any>} */ ({}));
  const [saveError, setSaveError] = useState('');

  const [editingBranch, setEditingBranch] = useState(/** @type {any} */ (null));
  const [creatingBranch, setCreatingBranch] = useState(false);

  useEffect(() => {
    if (!company) return;
    setLegalName(company.legalName ?? '');
    setTradeName(company.tradeName ?? '');
    setTimezone(company.timezone ?? '');
    setSettings(company.settings ?? {});
  }, [company]);

  if (isPending) return <PageLoader label="Cargando configuración…" />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  /**
   * @param {string} key
   * @param {any} value
   */
  const setSetting = (key, value) => setSettings((current) => ({ ...current, [key]: value }));

  /**
   * Guarda solo lo que esta pantalla edita.
   *
   * Antes se reenviaba el objeto `settings` entero tal como venía del servidor.
   * Eso ataba la pantalla al catálogo completo de ajustes: bastaba que la
   * plantilla del rubro trajera una clave que el validador no conociera —fue el
   * caso de `agingBuckets`— para que **cualquier** cambio muriera con un 422 de
   * clave desconocida. Y como el servidor fusiona lo que recibe en lugar de
   * reemplazarlo, mandar el resto no aportaba nada.
   *
   * Enviando únicamente los campos con control propio, un ajuste nuevo en las
   * plantillas ya no puede romper el guardado.
   *
   * @returns {Promise<void>}
   */
  async function save() {
    setSaveError('');

    try {
      await updateCompany.mutateAsync({
        legalName: legalName.trim(),
        tradeName: tradeName.trim(),
        timezone,
        settings: {
          priceIncludesTax: Boolean(settings.priceIncludesTax),
          blockSalesOnOverdue: Boolean(settings.blockSalesOnOverdue),
          allowNegativeStock: Boolean(settings.allowNegativeStock),
          lowStockAlerts: Boolean(settings.lowStockAlerts),
          defaultCreditTermDays: Number(settings.defaultCreditTermDays ?? 30),
          paymentAllocationStrategy: settings.paymentAllocationStrategy ?? 'FIFO',
        },
      });
    } catch (mutationError) {
      // Un fallo aquí no puede quedarse callado: sin aviso, la persona pulsa
      // «Guardar», no ve nada y cree que quedó guardado.
      const apiError = /** @type {any} */ (mutationError);
      setSaveError(
        apiError?.fieldErrors?.[0]?.message ??
          apiError?.message ??
          'No se pudo guardar la configuración.',
      );
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Configuración"
        icon={Settings}
        description="Datos de la empresa, sucursales y cómo se comporta el sistema al vender."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Empresa</CardTitle>
          <CardDescription>
            La razón social aparece en las facturas; el nombre comercial, en la interfaz.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <FormField name="legalName" label="Razón social" required>
            {({ id }) => (
              <Input
                id={id}
                value={legalName}
                onChange={(event) => setLegalName(event.target.value)}
              />
            )}
          </FormField>

          <FormField name="tradeName" label="Nombre comercial">
            {({ id }) => (
              <Input
                id={id}
                value={tradeName}
                onChange={(event) => setTradeName(event.target.value)}
                placeholder="La Bodega"
              />
            )}
          </FormField>

          <FormField name="timezone" label="Zona horaria">
            {({ id }) => (
              <Select id={id} value={timezone} onChange={(event) => setTimezone(event.target.value)}>
                {TIMEZONES.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone.split('/')[1].replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          <Separator />

          <dl className="grid gap-3 sm:grid-cols-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Moneda</dt>
              <dd className="font-medium">{company.currency}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Plan</dt>
              <dd className="font-medium">{company.plan.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Rubro</dt>
              <dd className="font-medium">{company.industryTemplate?.key ?? '—'}</dd>
            </div>
          </dl>

          <Alert>
            <Info aria-hidden="true" />
            <AlertDescription>
              La moneda no se cambia desde aquí: está grabada en cada precio, factura y saldo ya
              registrado, y cambiarla dejaría los documentos viejos diciendo una cosa y significando
              otra. Si se eligió mal, corregirla es una migración de datos.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cómo se vende</CardTitle>
          <CardDescription>
            Estas opciones cambian el comportamiento del punto de venta y de la cartera.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          <label className="flex items-start gap-3 rounded-md border p-3">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={Boolean(settings.priceIncludesTax)}
              onChange={(event) => setSetting('priceIncludesTax', event.target.checked)}
            />
            <span className="space-y-0.5 text-sm">
              <span className="block font-medium">Los precios ya incluyen impuesto</span>
              <span className="block text-xs text-muted-foreground">
                Marcado, el precio de la etiqueta es lo que paga el cliente y el impuesto se extrae
                del total. Sin marcar, se suma al final.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-md border p-3">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={Boolean(settings.blockSalesOnOverdue)}
              onChange={(event) => setSetting('blockSalesOnOverdue', event.target.checked)}
            />
            <span className="space-y-0.5 text-sm">
              <span className="block font-medium">Bloquear crédito a clientes en mora</span>
              <span className="block text-xs text-muted-foreground">
                Impide fiarle a quien tiene facturas vencidas. Siempre podrá comprar de contado.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-md border p-3">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={Boolean(settings.allowNegativeStock)}
              onChange={(event) => setSetting('allowNegativeStock', event.target.checked)}
            />
            <span className="space-y-0.5 text-sm">
              <span className="block font-medium">Permitir vender sin existencias</span>
              <span className="block text-xs text-muted-foreground">
                Deja el inventario en negativo. Útil si registra las compras con retraso; peligroso
                si confía en el inventario para reponer.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-md border p-3">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={Boolean(settings.lowStockAlerts)}
              onChange={(event) => setSetting('lowStockAlerts', event.target.checked)}
            />
            <span className="space-y-0.5 text-sm">
              <span className="block font-medium">Avisar cuando algo baje del mínimo</span>
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              name="defaultCreditTermDays"
              label="Plazo de crédito por defecto (días)"
            >
              {({ id }) => (
                <Input
                  id={id}
                  type="number"
                  min={0}
                  max={365}
                  value={settings.defaultCreditTermDays ?? 30}
                  onChange={(event) =>
                    setSetting('defaultCreditTermDays', Number(event.target.value))
                  }
                />
              )}
            </FormField>

            <FormField
              name="paymentAllocationStrategy"
              label="Aplicación de abonos"
              hint="Por antigüedad paga primero lo más viejo."
            >
              {({ id }) => (
                <Select
                  id={id}
                  value={settings.paymentAllocationStrategy ?? 'FIFO'}
                  onChange={(event) => setSetting('paymentAllocationStrategy', event.target.value)}
                >
                  <option value="FIFO">Por antigüedad</option>
                  <option value="MANUAL">Elegir factura</option>
                </Select>
              )}
            </FormField>
          </div>
        </CardContent>
      </Card>

      {saveError && (
        <Alert variant="destructive">
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end">
        <Button disabled={updateCompany.isPending || !legalName.trim()} onClick={() => void save()}>
          {updateCompany.isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base">Sucursales</CardTitle>
              <CardDescription>
                Cada venta y cada existencia pertenecen a una sucursal.
              </CardDescription>
            </div>

            <Button variant="outline" size="sm" onClick={() => setCreatingBranch(true)}>
              <Plus aria-hidden="true" />
              Agregar
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <ul className="divide-y">
            {(branches ?? []).map((/** @type {any} */ branch) => (
              <li key={branch.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium">
                      {branch.name}
                      {branch.isDefault && (
                        <Badge variant="secondary">
                          <Star aria-hidden="true" />
                          Predeterminada
                        </Badge>
                      )}
                      {!branch.isActive && <Badge variant="outline">Inactiva</Badge>}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {branch.code}
                      {branch.phone && ` · ${branch.phone}`}
                    </p>
                  </div>
                </div>

                <Button variant="ghost" size="sm" onClick={() => setEditingBranch(branch)}>
                  Editar
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <BranchDialog
        open={creatingBranch || Boolean(editingBranch)}
        onOpenChange={(/** @type {boolean} */ open) => {
          if (!open) {
            setCreatingBranch(false);
            setEditingBranch(null);
          }
        }}
        branch={editingBranch}
      />
    </div>
  );
}
