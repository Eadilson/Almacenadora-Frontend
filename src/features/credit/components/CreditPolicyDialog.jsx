import { useEffect, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { FormField } from '@/components/forms/FormField.jsx';
import { MoneyInput } from '@/components/forms/MoneyInput.jsx';
import { formatMoney, parseMoneyInput, toMajorString } from '@/lib/money';
import { useDialogSubmit } from '@/hooks/useDialogSubmit';
import { useCreditMutations } from '../hooks/useCredit.js';

/**
 * Política de crédito de un cliente: límite, plazo y bloqueo.
 *
 * No hay un interruptor de «tiene crédito o no» aparte del límite: dejarlo en
 * cero es, por sí mismo, un cliente de contado. Un interruptor aparte solo
 * añadiría un estado que puede desincronizarse del límite sin resolver nada que
 * el límite no resuelva ya. Pausar el crédito sin perder el límite configurado
 * es lo que hace «Bloquear la cuenta», que sí es un estado distinto.
 *
 * Bajar el límite por debajo de lo que ya debe es una decisión legítima —deja de
 * poder llevar más, pero lo que ya llevó sigue vigente—, así que se avisa en lugar
 * de impedirlo.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {any} props.customer
 * @param {any} props.account
 * @param {boolean} [props.hasDebt]
 */
export function CreditPolicyDialog({ open, onOpenChange, customer, account, hasDebt = false }) {
  const { updatePolicy } = useCreditMutations();

  const currency = account?.balance?.currency ?? customer?.credit?.limit?.currency ?? 'GTQ';

  const [limit, setLimit] = useState('');
  const [termDays, setTermDays] = useState('30');
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLimit(customer?.credit?.limit ? toMajorString(customer.credit.limit) : '');
    setTermDays(String(customer?.credit?.termDays ?? 30));
    setBlocked(account?.status === 'BLOCKED');
  }, [open, customer, account]);

  // Vacío es cero, no «sin definir»: si no fuera así, borrar el límite para
  // quitarle el crédito a alguien no tendría forma de mandarse.
  const parsedLimit = parseMoneyInput(limit || '0', currency);
  const lowersBelowDebt =
    Boolean(parsedLimit) && Boolean(account) && parsedLimit.amount < account.balance.amount;

  const { error: submitError, submitting, run } = useDialogSubmit();

  const canSubmit = Boolean(parsedLimit) && !updatePolicy.isPending && !submitting;

  async function submit() {
    const ok = await run(async () => {
      await updatePolicy.mutateAsync({
        customerId: customer.id,
        changes: {
          limit: { amount: /** @type {any} */ (parsedLimit).amount, currency },
          termDays: Number(termDays) || 0,
          blocked,
        },
      });
    });

    if (!ok) return;
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crédito de {customer?.name}</DialogTitle>
          <DialogDescription>
            Cuánto se le puede fiar y en cuántos días debe pagarlo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            name="limit"
            label="Límite de crédito"
            required
            hint="Cero es un cliente de contado."
          >
            {({ id }) => (
              <MoneyInput
                id={id}
                currency={currency}
                value={limit}
                onChange={(event) => setLimit(event.target.value)}
                placeholder="0.00"
              />
            )}
          </FormField>

          <FormField name="termDays" label="Plazo (días)" required>
            {({ id }) => (
              <Input
                id={id}
                type="number"
                min={0}
                max={365}
                value={termDays}
                onChange={(event) => setTermDays(event.target.value)}
              />
            )}
          </FormField>
        </div>

        {lowersBelowDebt && (
          <Alert variant="warning">
            <TriangleAlert aria-hidden="true" />
            <AlertDescription>
              El nuevo límite es menor que los {formatMoney(account.balance)} que ya debe. La deuda
              actual sigue vigente; simplemente no podrá llevar nada más hasta que abone.
            </AlertDescription>
          </Alert>
        )}

        <label className="flex items-start gap-3 rounded-md border p-3">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={blocked}
            onChange={(event) => setBlocked(event.target.checked)}
          />
          <span className="space-y-0.5 text-sm">
            <span className="block font-medium">Bloquear la cuenta</span>
            <span className="block text-xs text-muted-foreground">
              Impide nuevas ventas al crédito. Los abonos se siguen aceptando: un cliente bloqueado
              debe poder ponerse al día.
            </span>
          </span>
        </label>

        {hasDebt && blocked && (
          <p className="text-xs text-muted-foreground">
            Queda pendiente {formatMoney(account.balance)} que sigue siendo exigible.
          </p>
        )}

        {submitError && (
          <Alert variant="destructive">
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!canSubmit} onClick={() => void submit()}>
            {updatePolicy.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
