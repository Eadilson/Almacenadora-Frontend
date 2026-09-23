import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, CreditCard, HandCoins, Printer, ShieldCheck, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { StatCard } from '@/components/ui/stat-card.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { ErrorState, PageLoader } from '@/components/feedback/states.jsx';
import { usePermission } from '@/hooks/usePermission';
import { useSession } from '@/hooks/useSession';
import { formatMoney } from '@/lib/money';
import { formatDate, formatDateTime } from '@/lib/format';
import { PaymentDialog } from '../components/PaymentDialog.jsx';
import { CreditPolicyDialog } from '../components/CreditPolicyDialog.jsx';
import { useCustomerAccount, useStatement } from '../hooks/useCredit.js';

const STATUS_VARIANTS = {
  CURRENT: 'success',
  OVERDUE: 'destructive',
  BLOCKED: 'warning',
  SETTLED: 'secondary',
};

/**
 * Estado de cuenta de un cliente.
 *
 * Responde tres preguntas en este orden: cuánto debe, qué facturas componen esa
 * deuda, y cómo llegó a ese saldo. El historial va al final porque es lo que se
 * consulta cuando hay una discusión, no en el día a día.
 */
export function CustomerAccountPage() {
  const { customerId } = useParams();
  const { can } = usePermission();
  const { activeBranchId, user } = useSession();

  const [charging, setCharging] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(false);

  const { data, isPending, isError, error, refetch } = useCustomerAccount(customerId ?? null);
  const { data: statement } = useStatement(customerId ?? null, { limit: 50 });

  if (isPending) return <PageLoader label="Cargando cuenta…" />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const { customer, account, openDocuments } = data;
  const branchId = activeBranchId ?? user?.branches?.[0]?.id ?? null;

  const hasDebt = Boolean(account) && account.balance.amount > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3 no-print">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="-ml-3" asChild>
            <Link to="/creditos">
              <ArrowLeft aria-hidden="true" />
              Cartera
            </Link>
          </Button>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
            {account && (
              <Badge variant={STATUS_VARIANTS[account.status] ?? 'secondary'}>
                {account.statusLabel}
              </Badge>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{customer.code}</span>
            {customer.taxId && <> · {customer.taxId}</>}
            {customer.phone && <> · {customer.phone}</>}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer aria-hidden="true" />
            Imprimir
          </Button>

          {can('credit:limit:manage') && (
            <Button variant="outline" onClick={() => setEditingPolicy(true)}>
              <ShieldCheck aria-hidden="true" />
              Crédito
            </Button>
          )}

          {can('payments:create') && (
            <Button disabled={!account} onClick={() => setCharging(true)}>
              <HandCoins aria-hidden="true" />
              Registrar abono
            </Button>
          )}
        </div>
      </header>

      {!account && (
        <Alert>
          <AlertDescription>
            Este cliente no tiene cuenta corriente todavía: solo ha comprado de contado. Se abrirá
            sola en cuanto se le venda al crédito.
          </AlertDescription>
        </Alert>
      )}

      {account && (
        <>
          {account.status === 'BLOCKED' && (
            <Alert variant="warning">
              <Ban aria-hidden="true" />
              <AlertDescription>
                La cuenta está bloqueada para nuevas ventas al crédito. Sí puede recibir abonos.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Debe" value={formatMoney(account.balance)} icon={Wallet} featured delay={0} />
            <StatCard
              label="En mora"
              value={formatMoney(account.overdueAmount)}
              icon={Ban}
              tone={account.overdueAmount.amount > 0 ? 'destructive' : 'default'}
              delay={40}
            />
            <StatCard
              label="Puede llevarse"
              value={formatMoney(account.availableCredit)}
              icon={CreditCard}
              delay={80}
            />
            <StatCard
              label="A su favor"
              value={formatMoney(account.unappliedCredit)}
              icon={HandCoins}
              delay={120}
            />
          </div>

          {account.unappliedCredit.amount > 0 && (
            <Alert>
              <AlertDescription>
                Tiene {formatMoney(account.unappliedCredit)} a favor de un abono anterior. Se
                aplicará solo a su próxima compra al crédito.
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Facturas pendientes</CardTitle>
              <CardDescription>
                {openDocuments.length === 0
                  ? 'No queda nada por cobrar.'
                  : `${openDocuments.length} documento(s) con saldo, de la más antigua a la más reciente.`}
              </CardDescription>
            </CardHeader>

            {openDocuments.length > 0 && (
              <CardContent>
                <div className="scroll-x">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="pb-2 font-medium">Documento</th>
                        <th className="pb-2 font-medium">Emitida</th>
                        <th className="pb-2 font-medium">Vence</th>
                        <th className="pb-2 text-right font-medium">Importe</th>
                        <th className="pb-2 text-right font-medium">Debe</th>
                        <th className="pb-2 font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {openDocuments.map((/** @type {any} */ document) => (
                        <tr key={document.id}>
                          <td className="py-2 pr-3 font-mono text-xs">{document.docNumber}</td>
                          <td className="py-2 pr-3">{formatDate(document.entryDate)}</td>
                          <td className="py-2 pr-3">
                            {document.dueDate ? formatDate(document.dueDate) : '—'}
                            {document.isOverdue && (
                              <span className="ml-2 text-xs text-destructive">
                                {document.daysOverdue} d
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-right tabular text-muted-foreground">
                            {formatMoney(document.amount)}
                          </td>
                          <td className="py-2 pr-3 text-right tabular font-medium">
                            {formatMoney(document.outstanding)}
                          </td>
                          <td className="py-2">
                            <Badge variant={document.isOverdue ? 'destructive' : 'secondary'}>
                              {document.statusLabel}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Antigüedad</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-5">
                {account.aging.map((/** @type {any} */ bucket) => (
                  <div key={bucket.key} className="space-y-1">
                    <dt className="text-xs text-muted-foreground">{bucket.label}</dt>
                    <dd
                      className={`tabular font-medium ${
                        bucket.key !== 'current' && bucket.amount.amount > 0
                          ? 'text-destructive'
                          : ''
                      }`}
                    >
                      {formatMoney(bucket.amount)}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </>
      )}

      {statement?.entries?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historial de movimientos</CardTitle>
            <CardDescription>
              Cada línea explica cómo cambió el saldo. Nada se borra: las anulaciones aparecen como
              movimientos propios.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="scroll-x">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Fecha</th>
                    <th className="pb-2 font-medium">Concepto</th>
                    <th className="pb-2 font-medium">Documento</th>
                    <th className="pb-2 text-right font-medium">Movimiento</th>
                    <th className="pb-2 text-right font-medium">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {statement.entries.map((/** @type {any} */ entry) => (
                    <tr key={entry.id}>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {formatDateTime(entry.entryDate)}
                      </td>
                      <td className="py-2 pr-3">
                        {entry.conceptLabel}
                        {entry.status === 'VOIDED' && (
                          <Badge variant="destructive" className="ml-2">
                            Anulado
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">
                        {entry.reference?.docNumber ?? '—'}
                      </td>
                      <td
                        className={`py-2 pr-3 text-right tabular ${
                          entry.type === 'DEBIT' ? 'text-destructive' : 'text-success'
                        }`}
                      >
                        {entry.type === 'DEBIT' ? '+' : '−'}
                        {formatMoney(entry.amount)}
                      </td>
                      <td className="py-2 text-right tabular font-medium">
                        {formatMoney(entry.balanceAfter)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {account?.lastPaymentAt && (
              <>
                <Separator className="my-4" />
                <p className="text-xs text-muted-foreground">
                  Último abono recibido el {formatDateTime(account.lastPaymentAt)}.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {account && (
        <PaymentDialog
          open={charging}
          onOpenChange={setCharging}
          customer={customer}
          account={account}
          openDocuments={openDocuments}
          branchId={branchId}
        />
      )}

      <CreditPolicyDialog
        open={editingPolicy}
        onOpenChange={setEditingPolicy}
        customer={customer}
        account={account}
        hasDebt={hasDebt}
      />
    </div>
  );
}
