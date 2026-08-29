import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { FormField } from '@/components/forms/FormField.jsx';

/** Tipos ofrecidos, con un nombre que signifique algo para quien configura. */
const TYPES = [
  { value: 'STRING', label: 'Texto', hint: 'Cualquier texto corto.' },
  { value: 'ENUM', label: 'Lista de opciones', hint: 'El usuario elige una opción.' },
  { value: 'MULTI_ENUM', label: 'Lista múltiple', hint: 'Se pueden elegir varias.' },
  { value: 'DECIMAL', label: 'Número con decimales', hint: 'Peso, longitud, volumen.' },
  { value: 'NUMBER', label: 'Número entero', hint: 'Cantidades sin fracción.' },
  { value: 'BOOLEAN', label: 'Sí / No', hint: 'Una casilla.' },
  { value: 'DATE', label: 'Fecha', hint: 'Vencimiento, fabricación.' },
];

const schema = z
  .object({
    label: z.string().trim().min(1, 'Escriba el nombre del campo.').max(60),
    key: z
      .string()
      .trim()
      .regex(
        /^[a-z][a-zA-Z0-9]{0,39}$/,
        'Debe empezar en minúscula y llevar solo letras y números (ej.: pesoGr).',
      ),
    type: z.enum(['STRING', 'NUMBER', 'DECIMAL', 'BOOLEAN', 'DATE', 'ENUM', 'MULTI_ENUM']),
    options: z.string().optional().default(''),
    scale: z.string().optional().default('2'),
    unit: z.string().trim().max(8).optional().default(''),
    required: z.boolean().default(false),
    filterable: z.boolean().default(false),
    showInList: z.boolean().default(false),
    helpText: z.string().trim().max(200).optional().default(''),
  })
  .refine(
    (values) =>
      !['ENUM', 'MULTI_ENUM'].includes(values.type) ||
      values.options.split('\n').filter((option) => option.trim()).length > 0,
    { path: ['options'], message: 'Escriba al menos una opción.' },
  );

/**
 * Alta de un atributo de categoría.
 *
 * Esta pantalla es la que hace el producto vendible a cualquier rubro: el cliente
 * agrega aquí los campos que su negocio necesita y aparecen de inmediato en la
 * ficha de producto, sin desplegar código.
 *
 * @param {object} props
 * @param {(definition: Record<string, unknown>) => Promise<void>} props.onSubmit
 * @param {() => void} props.onCancel
 * @param {boolean} [props.saving]
 */
export function AttributeForm({ onSubmit, onCancel, saving = false }) {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      label: '',
      key: '',
      type: 'STRING',
      options: '',
      scale: '2',
      unit: '',
      required: false,
      filterable: false,
      showInList: false,
      helpText: '',
    },
  });

  const type = form.watch('type');
  const isEnumerated = type === 'ENUM' || type === 'MULTI_ENUM';
  const isDecimal = type === 'DECIMAL';
  const isNumeric = isDecimal || type === 'NUMBER';
  const errors = form.formState.errors;

  /**
   * Sugiere la clave a partir del nombre visible.
   *
   * La clave es inmutable una vez creada —los productos guardados la referencian—,
   * así que conviene que salga bien a la primera y sin que el usuario tenga que
   * entender qué es un identificador.
   *
   * @param {string} label
   */
  const suggestKey = (label) => {
    if (form.formState.dirtyFields.key) return;

    const key = label
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .trim()
      .split(/\s+/)
      .map((word, index) =>
        index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
      )
      .join('')
      .slice(0, 40);

    form.setValue('key', /^[a-z]/.test(key) ? key : `campo${key}`);
  };

  const submit = form.handleSubmit(async (values) => {
    await onSubmit({
      key: values.key,
      label: values.label,
      type: values.type,
      required: values.required,
      filterable: values.filterable,
      showInList: values.showInList,
      helpText: values.helpText || null,
      ...(isEnumerated
        ? { options: values.options.split('\n').map((option) => option.trim()).filter(Boolean) }
        : {}),
      ...(isDecimal ? { scale: Number(values.scale) } : {}),
      ...(isNumeric && values.unit ? { unit: values.unit.toUpperCase() } : {}),
    });
    form.reset();
  });

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border bg-muted/30 p-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="label" label="Nombre del campo" required error={errors.label?.message}>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              invalid={invalid}
              aria-describedby={describedBy}
              placeholder="Material"
              {...form.register('label', {
                onChange: (event) => suggestKey(event.target.value),
              })}
            />
          )}
        </FormField>

        <FormField
          name="key"
          label="Identificador"
          required
          error={errors.key?.message}
          hint="No se podrá cambiar después."
        >
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              invalid={invalid}
              aria-describedby={describedBy}
              className="font-mono text-xs"
              {...form.register('key')}
            />
          )}
        </FormField>

        <FormField
          name="type"
          label="Tipo de dato"
          required
          error={errors.type?.message}
          hint={TYPES.find((option) => option.value === type)?.hint}
        >
          {({ id, invalid, describedBy }) => (
            <Select id={id} invalid={invalid} aria-describedby={describedBy} {...form.register('type')}>
              {TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        {isDecimal && (
          <FormField name="scale" label="Decimales" error={errors.scale?.message}>
            {({ id, invalid, describedBy }) => (
              <Select id={id} invalid={invalid} aria-describedby={describedBy} {...form.register('scale')}>
                {[0, 1, 2, 3, 4, 5, 6].map((value) => (
                  <option key={value} value={String(value)}>
                    {value}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        )}

        {isNumeric && (
          <FormField
            name="unit"
            label="Unidad"
            error={errors.unit?.message}
            hint="Se muestra junto al valor: GR, CM, ML…"
          >
            {({ id, invalid, describedBy }) => (
              <Input
                id={id}
                invalid={invalid}
                aria-describedby={describedBy}
                placeholder="GR"
                className="uppercase"
                {...form.register('unit')}
              />
            )}
          </FormField>
        )}

        {isEnumerated && (
          <FormField
            name="options"
            label="Opciones"
            required
            error={errors.options?.message}
            hint="Una por línea."
            className="sm:col-span-2"
          >
            {({ id, invalid, describedBy }) => (
              <Textarea
                id={id}
                invalid={invalid}
                aria-describedby={describedBy}
                rows={4}
                placeholder={'Oro 18k\nOro 14k\nPlata 925'}
                {...form.register('options')}
              />
            )}
          </FormField>
        )}

        <FormField
          name="helpText"
          label="Texto de ayuda"
          error={errors.helpText?.message}
          className="sm:col-span-2"
        >
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              invalid={invalid}
              aria-describedby={describedBy}
              placeholder="Aparece bajo el campo al registrar el producto."
              {...form.register('helpText')}
            />
          )}
        </FormField>
      </div>

      <fieldset className="flex flex-wrap gap-x-6 gap-y-2">
        <legend className="sr-only">Comportamiento del campo</legend>

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 rounded border-input" {...form.register('required')} />
          Obligatorio
        </label>

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 rounded border-input" {...form.register('filterable')} />
          Se puede filtrar
        </label>

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 rounded border-input" {...form.register('showInList')} />
          Mostrar como columna
        </label>
      </fieldset>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <X aria-hidden="true" />
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={saving}>
          <Plus aria-hidden="true" />
          {saving ? 'Agregando…' : 'Agregar campo'}
        </Button>
      </div>
    </form>
  );
}
