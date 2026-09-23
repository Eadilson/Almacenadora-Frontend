import { describe, expect, it } from 'vitest';
import { resolveCustomerCredit } from '../lib/customerCredit.js';

describe('resolveCustomerCredit', () => {
  it('extrae la cuenta desde la respuesta compuesta del endpoint', () => {
    const creditLimit = { amount: 500_000, currency: 'GTQ' };
    const account = {
      balance: { amount: 125_000, currency: 'GTQ' },
      overdueAmount: { amount: 25_000, currency: 'GTQ' },
    };

    expect(
      resolveCustomerCredit(
        { credit: { limit: creditLimit, termDays: 30 } },
        { customer: {}, account, openDocuments: [] },
      ),
    ).toEqual({ account, creditLimit, hasCredit: true, overdueAmount: 25_000 });
  });

  it('tolera clientes de contado sin cuenta ni estructura de crédito', () => {
    expect(resolveCustomerCredit({}, { account: null, openDocuments: [] })).toEqual({
      account: null,
      creditLimit: null,
      hasCredit: false,
      overdueAmount: 0,
    });
  });
});
