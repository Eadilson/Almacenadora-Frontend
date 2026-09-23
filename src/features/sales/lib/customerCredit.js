/**
 * Traduce la respuesta compuesta de crédito al modelo mínimo que usa la ficha.
 * El endpoint devuelve `{ customer, account, openDocuments }`; no una cuenta sola.
 *
 * @param {Record<string, any>|null|undefined} customer
 * @param {Record<string, any>|null|undefined} creditData
 */
export function resolveCustomerCredit(customer, creditData) {
  const creditLimit = customer?.credit?.limit ?? null;
  const account = creditData?.account ?? null;

  return {
    account,
    creditLimit,
    hasCredit: Number(creditLimit?.amount ?? 0) > 0,
    overdueAmount: Number(account?.overdueAmount?.amount ?? 0),
  };
}
