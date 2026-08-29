import { useEffect, useMemo, useState } from 'react';
import { Banknote, CreditCard, Receipt, TriangleAlert } from 'lucide-react';
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
import { Select } from '@/components/ui/select.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { FormField } from '@/components/forms/FormField.jsx';
import { MoneyInput } from '@/components/forms/MoneyInput.jsx';
import { formatMoney, parseMoneyInput } from '@/lib/money';
import { formatDate } from '@/lib/format';
import { useDialogSubmit } from '@/hooks/useDialogSubmit';
import { useCreditMutations } from '../hooks/useCredit.js';

/** Formas en que entra el dinero. */
const METHODS = [
  { value: 'CASH', label: 'Efectivo', icon: Banknote },
  { value: 'CARD', label: 'Tarjeta', icon: CreditCard },
  { value: 'TRANSFER', label: 'Transferencia', icon: Receipt },
  { value: 'CHECK', label: 'Cheque', icon: Receipt },
];

/**
 * Registro de un abono.
 *
 * Dos decisiones que protegen el dinero:
 *
 * 1. La **clave de idempotencia se genera al abrir el diálogo**, no en cada envío.
 *    Si el cajero pulsa dos veces o la red repite la petición, el servidor
 *    reconoce el reintento y devuelve el mismo recibo en lugar de cobrar dos veces.
 * 2. El reparto se **previsualiza antes de enviar**, con los mismos números que
 *    aplicará el servidor. El cajero ve a qué facturas irá el dinero antes de
 *    confirmar, y no después de entregar el recibo.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {any} props.customer
 * @param {any} props.account
 * @param {any[]} props.openDocuments
 * @param {string|null} [props.branchId]
 */
export function PaymentDialog({
  open,
  onOpenChange,
  customer,
  account,
  openDocuments,
  branchId = null,
}) {
  const { registerPayment } = useCreditMutations();

  const currency = account?.balance?.currency ?? 'GTQ';

  const [amountInput, setAmountInput] = useState('');
  const [method, setMethod] = useState('CASH');
  const [reference, setReference] = useState('');
  const [strategy, setStrategy] = useState('FIFO');
  /** @type {[Record<string, string>, Function]} */
  const [manual, setManual] = useState({});
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [result, setResult] = useState(/** @type {any} */ (null));

  // Una clave nueva por cada apertura del cobro. Generarla en cada envío
  // convertiría cada reintento en un abono distinto, que es justo lo contrario de
  // lo que la idempotencia debe conseguir.
  useEffect(() => {
    if (!open) return;
    setIdempotencyKey(crypto.randomUUID());
    setAmountInput('');
    setReference('');
    setManual({});
    setStrategy('FIFO');
    setResult(null);
  }, [open]);

  const amount = useMemo(() => parseMoneyInput(amountInput, currency), [amountInput, currency]);

  /** Reparto que hará el servidor, calculado igual: lo más viejo primero. */
  const preview = useMemo(() => {
    if (!amount || amount.amount <= 0) return { rows: [], unapplied: 0 };

    if (strategy === 'MANUAL') {
      const rows = openDocuments
        .map((document) => {
          const parsed = parseMoneyInput(manual[document.id] ?? '', currency);
          return { document, applied: parsed?.amount ?? 0 };
        })
        .filter((row) => row.applied > 0);

      const total = rows.reduce((sum, row) => sum + row.applied, 0);
      return { rows, unapplied: amount.amount - total, over: total > amount.amount };
    }

    let remaining = amount.amount;
    const rows = [];

    for (const document of openDocuments) {
      if (remaining <= 0) break;
      const applied = Math.min(remaining, document.outstanding.amount);
      remaining -= applied;
      rows.push({ document, applied });
    }

    return { rows, unapplied: remaining };
  }, [amount, strategy, manual, openDocuments, currency]);

  const manualExceedsDocument = useMemo(
    () =>
      strategy === 'MANUAL' &&
      preview.rows.some((/** @type {any} */ row) => row.applied > row.document.outstanding.amount),
    [strategy, preview],
  );

  const { error: submitError, submitting, run } = useDialogSubmit();

  const canSubmit =
    Boolean(amount) &&
    amount.amount > 0 &&
    !preview.over &&
    !manualExceedsDocument &&
    (strategy !== 'MANUAL' || preview.rows.length > 0) &&
    !registerPayment.isPending &&
    !submitting;

  async function submit() {
    /** @type {Record<string, any>} */
    const payload = {
      customerId: customer.id,
      branchId,
      method,
      amount: { amount: amount.amount, currency },
      reference: reference.trim() || null,
      allocationStrategy: strategy,
      ...(strategy === 'MANUAL'
        ? {
            allocations: preview.rows.map((/** @type {any} */ row) => ({
              entryId: row.document.id,
              amount: { amount: row.applied, currency },
            })),
          }
        : {}),
    };

    await run(async () => {
      const response = await registerPayment.mutateAsync({ payload, idempotencyKey });
      setResult(response);
    });
  }

  // ── Recibo ────────────────────────────────────────────────────────────────
  if (result) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abono registrado</DialogTitle>
            <DialogDescription>
              Recibo <span className="font-mono">{result.payment.number}</span> a nombre de{' '}
              {customer.name}.
            </DialogDescription>
          </DialogHeader>

          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Recibido</dt>
              <dd className="tabular font-medium">{formatMoney(result.payment.amount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Aplicado a deuda</dt>
              <dd className="tabular">{formatMoney(result.payment.appliedAmount)}</dd>
            </div>
            {result.payment.unappliedAmount.amount > 0 && (
              <div className="flex justify-between text-warning">
                <dt>Queda a favor del cliente</dt>
                <dd className="tabular">{formatMoney(result.payment.unappliedAmount)}</dd>
              </div>
            )}
          </dl>

          <Separator />

          <ul className="divide-y text-sm">
            {result.allocations.map((/** @type {any} */ allocation) => (
              <li key={allocation.entryId} className="flex items-center justify-between py-2">
                <span className="font-mono text-xs">{allocation.docNumber}</span>
                <span className="flex items-center gap-2">
                  <span className="tabular">{formatMoney(allocation.appliedAmount)}</span>
                  <Badge variant={allocation.documentStatus === 'PAID' ? 'success' : 'warning'}>
                    {allocation.documentStatus === 'PAID' ? 'Saldada' : 'Abonada'}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>

          <Separator />

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Saldo del cliente</span>
            <span className="tabular font-semibold">
              {formatMoney(result.account.previousBalance)} → {formatMoney(result.account.balance)}
            </span>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => window.print()}>
              Imprimir recibo
            </Button>
            <Button onClick={() => onOpenChange(false)}>Listo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Cobro ─────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar abono</DialogTitle>
          <DialogDescription>
            {customer.name} debe {formatMoney(account?.balance ?? { amount: 0, currency })}.
          </DialogDescription>
        </DialogHeader>

        {account?.overdueAmount?.amount > 0 && (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden="true" />
            <AlertDescription>
              Tiene {formatMoney(account.overdueAmount)} en mora
              {account.oldestDueDate && ` desde el ${formatDate(account.oldestDueDate)}`}.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField name="amount" label="Importe recibido" required>
            {({ id }) => (
              <MoneyInput
                id={id}
                currency={currency}
                value={amountInput}
                onChange={(event) => setAmountInput(event.target.value)}
                autoFocus
              />
            )}
          </FormField>

          <FormField name="method" label="Forma de pago" required>
            {({ id }) => (
              <Select id={id} value={method} onChange={(event) => setMethod(event.target.value)}>
                {METHODS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        </div>

        {method !== 'CASH' && (
          <FormField name="reference" label="Referencia" hint="Número de cheque, voucher o transferencia.">
            {({ id }) => (
              <Input
                id={id}
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="TRF-99881"
              />
            )}
          </FormField>
        )}

        <FormField
          name="strategy"
          label="Cómo se aplica"
          hint="Por antigüedad paga primero lo más viejo. Manual permite elegir la factura."
        >
          {({ id }) => (
            <Select id={id} value={strategy} onChange={(event) => setStrategy(event.target.value)}>
              <option value="FIFO">Por antigüedad</option>
              <option value="MANUAL">Elegir facturas</option>
            </Select>
          )}
        </FormField>

        <Separator />

        {openDocuments.length === 0 ? (
          <Alert>
            <AlertDescription>
              Este cliente no tiene facturas pendientes. El abono quedará entero como saldo a su
              favor.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {strategy === 'MANUAL' ? 'Indique cuánto va a cada factura' : 'Se aplicará así'}
            </p>

            <ul className="divide-y rounded-md border">
              {openDocuments.map((document) => {
                const row = preview.rows.find(
                  (/** @type {any} */ candidate) => candidate.document.id === document.id,
                );
                const applied = row?.applied ?? 0;
                const excess = applied > document.outstanding.amount;

                return (
                  <li key={document.id} className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs">{document.docNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        debe {formatMoney(document.outstanding)}
                        {document.isOverdue && (
                          <span className="ml-1 text-destructive">
                            · {document.daysOverdue} días de atraso
                          </span>
                        )}
                      </p>
                    </div>

                    {strategy === 'MANUAL' ? (
                      <div className="w-32 shrink-0">
                        <MoneyInput
                          currency={currency}
                          value={manual[document.id] ?? ''}
                          onChange={(/** @type {any} */ event) =>
                            setManual((/** @type {any} */ previous) => ({
                              ...previous,
                              [document.id]: event.target.value,
                            }))
                          }
                          invalid={excess}
                          aria-label={`Importe para ${document.docNumber}`}
                        />
                      </div>
                    ) : (
                      <span
                        className={`tabular text-sm ${applied > 0 ? 'font-medium' : 'text-muted-foreground'}`}
                      >
                        {applied > 0 ? formatMoney({ amount: applied, currency }) : '—'}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {manualExceedsDocument && (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden="true" />
            <AlertDescription>
              Está aplicando a una factura más de lo que debe. Ajuste el importe.
            </AlertDescription>
          </Alert>
        )}

        {preview.over && (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden="true" />
            <AlertDescription>
              El reparto suma más que el importe recibido.
            </AlertDescription>
          </Alert>
        )}

        {!preview.over && preview.unapplied > 0 && amount?.amount > 0 && (
          <Alert variant="warning">
            <AlertDescription>
              Sobran {formatMoney({ amount: preview.unapplied, currency })}: quedarán como saldo a
              favor del cliente y se aplicarán a su próxima compra al crédito.
            </AlertDescription>
          </Alert>
        )}

        {submitError && (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden="true" />
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!canSubmit} onClick={() => void submit()}>
            {registerPayment.isPending || submitting ? 'Registrando…' : 'Registrar abono'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
