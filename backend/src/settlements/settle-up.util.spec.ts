import { computeSettlement } from './settle-up.util';

// For each user, net effect = amount received - amount sent. A correct settlement plan must make
// this equal the user's original balance (positive = was owed, negative = owed money).
function sumByUser(payments: { fromUserId: string; toUserId: string; amountCents: number }[]) {
  const net = new Map<string, number>();
  for (const p of payments) {
    net.set(p.fromUserId, (net.get(p.fromUserId) ?? 0) - p.amountCents);
    net.set(p.toUserId, (net.get(p.toUserId) ?? 0) + p.amountCents);
  }
  return net;
}

describe('computeSettlement', () => {
  it('settles a simple two-person exact zero-sum group', () => {
    const balances = new Map([
      ['alice', 2500],
      ['bob', -2500],
    ]);

    const result = computeSettlement(balances);

    expect(result).toEqual([{ fromUserId: 'bob', toUserId: 'alice', amountCents: 2500 }]);
  });

  it('returns no payments for an already-settled group', () => {
    const balances = new Map([
      ['alice', 0],
      ['bob', 0],
      ['carol', 0],
    ]);

    expect(computeSettlement(balances)).toEqual([]);
  });

  it('handles a single creditor with multiple debtors', () => {
    const balances = new Map([
      ['alice', 100],
      ['bob', -60],
      ['carol', -40],
    ]);

    const result = computeSettlement(balances);

    expect(result).toHaveLength(2);
    expect(result.every((p) => p.toUserId === 'alice')).toBe(true);
    expect(result.reduce((sum, p) => sum + p.amountCents, 0)).toBe(100);
  });

  it('handles rounding remainder cent edge cases', () => {
    const balances = new Map([
      ['alice', 1],
      ['bob', 1],
      ['carol', -2],
    ]);

    const result = computeSettlement(balances);

    expect(result.reduce((sum, p) => sum + p.amountCents, 0)).toBe(2);
    expect(result.every((p) => p.fromUserId === 'carol')).toBe(true);
  });

  it('produces a settlement plan whose net effect matches the original balances exactly', () => {
    const balances = new Map([
      ['a', 5000],
      ['b', -1200],
      ['c', -1800],
      ['d', 3000],
      ['e', -5000],
    ]);

    const result = computeSettlement(balances);
    const net = sumByUser(result);

    for (const [userId, originalBalance] of balances) {
      expect(net.get(userId) ?? 0).toBe(originalBalance);
    }
  });

  it('never produces a zero-amount payment', () => {
    const balances = new Map([
      ['alice', 100],
      ['bob', -100],
      ['carol', 0],
    ]);

    const result = computeSettlement(balances);
    expect(result.every((p) => p.amountCents > 0)).toBe(true);
  });
});
