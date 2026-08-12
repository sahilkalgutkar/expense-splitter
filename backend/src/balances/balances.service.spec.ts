import { BalancesService } from './balances.service';

describe('BalancesService', () => {
  let prisma: any;
  let balancesService: BalancesService;

  beforeEach(() => {
    prisma = {
      expense: { findMany: jest.fn().mockResolvedValue([]) },
      expenseSplit: { findMany: jest.fn().mockResolvedValue([]) },
      settlement: { findMany: jest.fn().mockResolvedValue([]) },
      groupMember: { findMany: jest.fn().mockResolvedValue([]) },
    };
    balancesService = new BalancesService(prisma);
  });

  describe('computeNetBalances', () => {
    it('returns an empty map for a group with no activity', async () => {
      const result = await balancesService.computeNetBalances('group-1');
      expect(result.size).toBe(0);
    });

    it('credits the payer and debits participants for an expense', async () => {
      prisma.expense.findMany.mockResolvedValue([
        { id: 'exp-1', paidById: 'alice', amountCents: 1000 },
      ]);
      prisma.expenseSplit.findMany.mockResolvedValue([
        { userId: 'alice', shareCents: 500 },
        { userId: 'bob', shareCents: 500 },
      ]);

      const result = await balancesService.computeNetBalances('group-1');

      expect(result.get('alice')).toBe(500); // paid 1000, owes 500 -> net +500
      expect(result.get('bob')).toBe(-500); // owes 500, paid nothing -> net -500
    });

    it('applies settlements to reduce the payer debt and the receiver credit', async () => {
      prisma.expense.findMany.mockResolvedValue([
        { id: 'exp-1', paidById: 'alice', amountCents: 1000 },
      ]);
      prisma.expenseSplit.findMany.mockResolvedValue([
        { userId: 'alice', shareCents: 500 },
        { userId: 'bob', shareCents: 500 },
      ]);
      prisma.settlement.findMany.mockResolvedValue([
        { fromUserId: 'bob', toUserId: 'alice', amountCents: 500 },
      ]);

      const result = await balancesService.computeNetBalances('group-1');

      expect(result.get('alice')).toBe(0);
      expect(result.get('bob')).toBe(0);
    });

    it('conserves the total balance across all users (zero-sum)', async () => {
      prisma.expense.findMany.mockResolvedValue([
        { id: 'exp-1', paidById: 'alice', amountCents: 3000 },
        { id: 'exp-2', paidById: 'bob', amountCents: 900 },
      ]);
      prisma.expenseSplit.findMany.mockResolvedValue([
        { userId: 'alice', shareCents: 1300 },
        { userId: 'bob', shareCents: 1300 },
        { userId: 'carol', shareCents: 1300 },
      ]);
      prisma.settlement.findMany.mockResolvedValue([
        { fromUserId: 'carol', toUserId: 'bob', amountCents: 400 },
      ]);

      const result = await balancesService.computeNetBalances('group-1');
      const total = [...result.values()].reduce((sum, v) => sum + v, 0);

      expect(total).toBe(0);
    });
  });

  describe('getGroupBalances', () => {
    it('defaults members with no activity to a zero net balance', async () => {
      prisma.groupMember.findMany.mockResolvedValue([
        { user: { id: 'alice', name: 'Alice', email: 'alice@example.com' } },
      ]);

      const result = await balancesService.getGroupBalances('group-1');

      expect(result).toEqual([
        {
          userId: 'alice',
          name: 'Alice',
          email: 'alice@example.com',
          netCents: 0,
        },
      ]);
    });

    it('maps each member to their computed net balance', async () => {
      prisma.groupMember.findMany.mockResolvedValue([
        { user: { id: 'alice', name: 'Alice', email: 'alice@example.com' } },
        { user: { id: 'bob', name: 'Bob', email: 'bob@example.com' } },
      ]);
      prisma.expense.findMany.mockResolvedValue([
        { id: 'exp-1', paidById: 'alice', amountCents: 1000 },
      ]);
      prisma.expenseSplit.findMany.mockResolvedValue([
        { userId: 'alice', shareCents: 500 },
        { userId: 'bob', shareCents: 500 },
      ]);

      const result = await balancesService.getGroupBalances('group-1');

      expect(result).toEqual([
        {
          userId: 'alice',
          name: 'Alice',
          email: 'alice@example.com',
          netCents: 500,
        },
        {
          userId: 'bob',
          name: 'Bob',
          email: 'bob@example.com',
          netCents: -500,
        },
      ]);
    });
  });
});
