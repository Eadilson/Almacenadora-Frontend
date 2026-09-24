import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Button } from '@/components/ui/button.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { FormField } from '@/components/forms/FormField.jsx';
import { MoneyInput } from '@/components/forms/MoneyInput.jsx';
import { useDialogSubmit } from '@/hooks/useDialogSubmit';
import { formatMoney, parseMoneyInput } from '@/lib/money';

function DialogError({ error }) {
  if (!error) return null;
  return (
    <Alert variant="destructive">
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
}

export function OpenCashDialog({ open, onOpenChange, currency, mutation }) {
  const [amount, setAmount] = useState('0');
  const [notes, setNotes] = useState('');
  const { error, clearError, submitting, run } = useDialogSubmit();

  useEffect(() => {
    if (!open) return;
    setAmount('0');
    setNotes('');
    clearError();
  }, [clearError, open]);

  async function submit() {
    const openingFloat = parseMoneyInput(amount, currency);
    if (!openingFloat || openingFloat.amount < 0) return;
    const ok = await run(() => mutation.mutateAsync({ openingFloat, notes: notes || null }));
    if (ok) onOpenChange(false);
  }

  const valid = parseMoneyInput(amount, currency)?.amount >= 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abrir caja</DialogTitle>
          <DialogDescription>
            Cuente el efectivo con el que inicia. Desde aquí se sumarán las ventas y los abonos.
          </DialogDescription>
        </DialogHeader>
        <FormField name="openingFloat" label="Fondo inicial" required>
          {({ id }) => (
            <MoneyInput
              id={id}
              currency={currency}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          )}
        </FormField>
        <FormField name="openingNotes" label="Nota">
          {({ id }) => (
            <Textarea
              id={id}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Fondo entregado por administración"
            />
          )}
        </FormField>
        <DialogError error={error} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!valid}
            loading={mutation.isPending || submitting}
            onClick={() => void submit()}
          >
            Abrir caja
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CashMovementDialog({
  open,
  onOpenChange,
  sessionId,
  currency,
  initialType,
  mutation,
}) {
  const [type, setType] = useState(initialType);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const { error, clearError, submitting, run } = useDialogSubmit();

  useEffect(() => {
    if (!open) return;
    setType(initialType);
    setAmount('');
    setReason('');
    setReference('');
    clearError();
  }, [clearError, initialType, open]);

  async function submit() {
    const parsed = parseMoneyInput(amount, currency);
    if (!parsed || parsed.amount <= 0) return;
    const ok = await run(() =>
      mutation.mutateAsync({
        sessionId,
        payload: { type, amount: parsed, reason, reference: reference || null },
      }),
    );
    if (ok) onOpenChange(false);
  }

  const valid = (parseMoneyInput(amount, currency)?.amount ?? 0) > 0 && reason.trim().length >= 5;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Movimiento de caja</DialogTitle>
          <DialogDescription>
            Se añadirá al historial de esta jornada y no podrá editarse ni borrarse.
          </DialogDescription>
        </DialogHeader>
        <FormField name="movementType" label="Tipo" required>
          {({ id }) => (
            <Select id={id} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="CASH_IN">Ingreso de efectivo</option>
              <option value="EXPENSE">Gasto de caja</option>
              <option value="WITHDRAWAL">Retiro o depósito bancario</option>
              <option value="REFUND">Devolución en efectivo</option>
            </Select>
          )}
        </FormField>
        <FormField name="movementAmount" label="Importe" required>
          {({ id }) => (
            <MoneyInput
              id={id}
              currency={currency}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          )}
        </FormField>
        <FormField name="movementReason" label="Motivo" required>
          {({ id }) => (
            <Textarea
              id={id}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describa qué ocurrió y por qué."
            />
          )}
        </FormField>
        <FormField name="movementReference" label="Referencia">
          {({ id }) => (
            <Input
              id={id}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Boleta, recibo o documento"
            />
          )}
        </FormField>
        <DialogError error={error} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!valid}
            loading={mutation.isPending || submitting}
            onClick={() => void submit()}
          >
            Registrar movimiento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CloseCashDialog({ open, onOpenChange, session, currency, mutation }) {
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const { error, clearError, submitting, run } = useDialogSubmit();

  useEffect(() => {
    if (!open) return;
    setAmount('');
    setNotes('');
    clearError();
  }, [clearError, open]);

  async function submit() {
    const countedCash = parseMoneyInput(amount, currency);
    if (!countedCash || countedCash.amount < 0) return;
    const ok = await run(() =>
      mutation.mutateAsync({
        sessionId: session.id,
        payload: { countedCash, notes: notes || null },
      }),
    );
    if (ok) onOpenChange(false);
  }

  const valid = (parseMoneyInput(amount, currency)?.amount ?? -1) >= 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cerrar y arquear caja</DialogTitle>
          <DialogDescription>
            El sistema espera {formatMoney(session?.summary?.expectedCash)}. Escriba lo contado
            físicamente; la diferencia quedará registrada.
          </DialogDescription>
        </DialogHeader>
        <FormField name="countedCash" label="Efectivo contado" required>
          {({ id }) => (
            <MoneyInput
              id={id}
              currency={currency}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          )}
        </FormField>
        <FormField name="closingNotes" label="Observaciones">
          {({ id }) => (
            <Textarea
              id={id}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Explique cualquier diferencia conocida."
            />
          )}
        </FormField>
        <DialogError error={error} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Volver
          </Button>
          <Button
            disabled={!valid}
            loading={mutation.isPending || submitting}
            onClick={() => void submit()}
          >
            Cerrar caja
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
