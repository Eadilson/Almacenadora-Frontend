import { Controller } from 'react-hook-form';
import { FormField } from '@/components/forms/FormField.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { cn } from '@/lib/utils';
import { EMPTY_OPTION } from '../lib/dynamicSchema.js';

/**
 * Campo de atributo, dibujado según su definición.
 *
 * Aquí no hay una sola línea que sepa de joyería ni de ferretería: el control, la
 * etiqueta, las opciones y la obligatoriedad salen de lo que la empresa configuró
 * en su categoría. Añadir un campo nuevo a un rubro no toca este archivo.
 *
 * @param {object} props
 * @param {import('@/api/endpoints/catalog').AttributeDefinition} props.definition
 * @param {import('react-hook-form').UseFormRegister<any>} props.register
 * @param {import('react-hook-form').Control<any>} props.control
 * @param {string|undefined} props.error
 */
export function DynamicAttributeField({ definition, register, control, error }) {
  const name = `attributes.${definition.key}`;
  const hint = definition.helpText ?? hintFor(definition);

  // Selección múltiple: se dibuja como grupo de casillas. Un `<select multiple>`
  // exige mantener pulsada una tecla para elegir varias opciones, algo que casi
  // nadie descubre por su cuenta.
  if (definition.type === 'MULTI_ENUM') {
    return (
      <FormField
        name={definition.key}
        label={definition.label}
        required={definition.required}
        hint={hint}
        error={error}
      >
        {({ describedBy }) => (
          <Controller
            control={control}
            name={name}
            render={({ field }) => {
              const selected = Array.isArray(field.value) ? field.value : [];

              return (
                <div className="flex flex-wrap gap-2 pt-1" aria-describedby={describedBy}>
                  {definition.options.map((option) => {
                    const checked = selected.includes(option);

                    return (
                      <label
                        key={option}
                        className={cn(
                          'cursor-pointer select-none rounded-full border px-3 py-1.5 text-sm transition-colors',
                          checked
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-input hover:bg-accent',
                        )}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={(event) =>
                            field.onChange(
                              event.target.checked
                                ? [...selected, option]
                                : selected.filter((item) => item !== option),
                            )
                          }
                        />
                        {option}
                      </label>
                    );
                  })}
                </div>
              );
            }}
          />
        )}
      </FormField>
    );
  }

  if (definition.type === 'BOOLEAN') {
    return (
      <FormField name={definition.key} label={definition.label} hint={hint} error={error}>
        {({ id, describedBy }) => (
          <label className="flex h-10 cursor-pointer items-center gap-2">
            <input
              id={id}
              type="checkbox"
              aria-describedby={describedBy}
              className="size-4 rounded border-input accent-[hsl(var(--primary))]"
              {...register(name)}
            />
            <span className="text-sm text-muted-foreground">Sí</span>
          </label>
        )}
      </FormField>
    );
  }

  if (definition.type === 'ENUM') {
    return (
      <FormField
        name={definition.key}
        label={definition.label}
        required={definition.required}
        hint={hint}
        error={error}
      >
        {({ id, invalid, describedBy }) => (
          <Select id={id} invalid={invalid} aria-describedby={describedBy} {...register(name)}>
            <option value={EMPTY_OPTION}>
              {definition.required ? 'Seleccione…' : 'Sin especificar'}
            </option>
            {definition.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        )}
      </FormField>
    );
  }

  const inputType = definition.type === 'DATE' ? 'date' : 'text';
  const numeric = definition.type === 'NUMBER' || definition.type === 'DECIMAL';

  return (
    <FormField
      name={definition.key}
      label={definition.label}
      required={definition.required}
      hint={hint}
      error={error}
    >
      {({ id, invalid, describedBy }) => (
        <div className="relative">
          <Input
            id={id}
            type={inputType}
            inputMode={numeric ? 'decimal' : undefined}
            invalid={invalid}
            aria-describedby={describedBy}
            autoComplete="off"
            className={cn(numeric && 'tabular', definition.unit && 'pr-14')}
            {...register(name)}
          />
          {definition.unit && (
            <Badge
              variant="secondary"
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
            >
              {definition.unit}
            </Badge>
          )}
        </div>
      )}
    </FormField>
  );
}

/**
 * Ayuda derivada de la propia definición, cuando la empresa no escribió una.
 *
 * @param {import('@/api/endpoints/catalog').AttributeDefinition} definition
 * @returns {string|undefined}
 */
function hintFor(definition) {
  if (definition.type === 'DECIMAL' && definition.scale) {
    return `Admite ${definition.scale} ${definition.scale === 1 ? 'decimal' : 'decimales'}.`;
  }
  return undefined;
}
