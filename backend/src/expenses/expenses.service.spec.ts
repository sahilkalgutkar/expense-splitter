import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { GroupRole, SplitType } from '../generated/prisma/client';

describe('ExpensesService', () => {
  let prisma: any;
  let groupsService: any;
  let expensesService: ExpensesService;

  const groupId = 'group-1';
  const members = ['alice', 'bob', 'carol'];

  beforeEach(() => {
    prisma = {
      groupMember: {
        findMany: jest
          .fn()
          .mockResolvedValue(members.map((userId) => ({ userId }))),
      },
      expense: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      expenseSplit: { deleteMany: jest.fn() },
      $transaction: jest.fn(),
    };
    groupsService = {
      assertMember: jest.fn().mockResolvedValue({ role: GroupRole.MEMBER }),
    };
    expensesService = new ExpensesService(prisma, groupsService);
  });

  describe('createExpense', () => {
    it('requires the requester to be a group member', async () => {
      groupsService.assertMember.mockRejectedValue(new ForbiddenException());

      await expect(
        expensesService.createExpense('outsider', groupId, {
          description: 'Dinner',
          amountCents: 900,
          paidById: 'alice',
          splitType: SplitType.EQUAL,
          participantUserIds: ['alice', 'bob'],
        } as any),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.expense.create).not.toHaveBeenCalled();
    });

    it('rejects a payer who is not a group member', async () => {
      await expect(
        expensesService.createExpense('alice', groupId, {
          description: 'Dinner',
          amountCents: 900,
          paidById: 'dave',
          splitType: SplitType.EQUAL,
          participantUserIds: ['alice', 'bob'],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an EQUAL split participant who is not a group member', async () => {
      await expect(
        expensesService.createExpense('alice', groupId, {
          description: 'Dinner',
          amountCents: 900,
          paidById: 'alice',
          splitType: SplitType.EQUAL,
          participantUserIds: ['alice', 'dave'],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates an equal split expense with shares summing to the total', async () => {
      prisma.expense.create.mockResolvedValue({ id: 'exp-1' });

      await expensesService.createExpense('alice', groupId, {
        description: 'Dinner',
        amountCents: 1000,
        paidById: 'alice',
        splitType: SplitType.EQUAL,
        participantUserIds: ['alice', 'bob', 'carol'],
      });

      const createArgs = prisma.expense.create.mock.calls[0][0];
      const shares = createArgs.data.splits.create;
      expect(
        shares.reduce((sum: number, s: any) => sum + s.shareCents, 0),
      ).toBe(1000);
      expect(createArgs.data.paidById).toBe('alice');
      expect(createArgs.data.createdById).toBe('alice');
    });

    it('creates an exact split expense using the given shares', async () => {
      prisma.expense.create.mockResolvedValue({ id: 'exp-2' });

      await expensesService.createExpense('alice', groupId, {
        description: 'Groceries',
        amountCents: 1000,
        paidById: 'bob',
        splitType: SplitType.EXACT,
        splits: [
          { userId: 'alice', value: 600 },
          { userId: 'bob', value: 400 },
        ],
      });

      const createArgs = prisma.expense.create.mock.calls[0][0];
      expect(createArgs.data.splits.create).toEqual([
        { userId: 'alice', shareCents: 600 },
        { userId: 'bob', shareCents: 400 },
      ]);
    });

    it('rejects an exact split that does not sum to the expense total', async () => {
      await expect(
        expensesService.createExpense('alice', groupId, {
          description: 'Groceries',
          amountCents: 1000,
          paidById: 'bob',
          splitType: SplitType.EXACT,
          splits: [
            { userId: 'alice', value: 600 },
            { userId: 'bob', value: 300 },
          ],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a percentage split expense converting percentages to cents', async () => {
      prisma.expense.create.mockResolvedValue({ id: 'exp-3' });

      await expensesService.createExpense('alice', groupId, {
        description: 'Rent',
        amountCents: 1001,
        paidById: 'alice',
        splitType: SplitType.PERCENTAGE,
        splits: [
          { userId: 'alice', value: 50 },
          { userId: 'bob', value: 50 },
        ],
      });

      const createArgs = prisma.expense.create.mock.calls[0][0];
      const shares = createArgs.data.splits.create;
      expect(
        shares.reduce((sum: number, s: any) => sum + s.shareCents, 0),
      ).toBe(1001);
    });
  });

  describe('listGroupExpenses', () => {
    it('requires membership and lists expenses newest first', async () => {
      prisma.expense.findMany.mockResolvedValue([{ id: 'exp-1' }]);

      const result = await expensesService.listGroupExpenses('alice', groupId);

      expect(groupsService.assertMember).toHaveBeenCalledWith(groupId, 'alice');
      expect(prisma.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { groupId },
          orderBy: { date: 'desc' },
        }),
      );
      expect(result).toEqual([{ id: 'exp-1' }]);
    });
  });

  const existingExpense = { id: 'exp-1', groupId, createdById: 'alice' };

  describe('updateExpense', () => {
    it('throws NotFoundException when the expense does not exist', async () => {
      prisma.expense.findUnique.mockResolvedValue(null);

      await expect(
        expensesService.updateExpense('alice', 'missing', {
          description: 'x',
          amountCents: 100,
          paidById: 'alice',
          splitType: SplitType.EQUAL,
          participantUserIds: ['alice'],
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('allows the expense creator to update it', async () => {
      prisma.expense.findUnique.mockResolvedValue(existingExpense);
      groupsService.assertMember.mockResolvedValue({ role: GroupRole.MEMBER });
      const tx = {
        expenseSplit: { deleteMany: jest.fn() },
        expense: { update: jest.fn().mockResolvedValue({ id: 'exp-1' }) },
      };
      prisma.$transaction.mockImplementation((cb: any) => cb(tx));

      const result = await expensesService.updateExpense('alice', 'exp-1', {
        description: 'Updated',
        amountCents: 500,
        paidById: 'alice',
        splitType: SplitType.EQUAL,
        participantUserIds: ['alice', 'bob'],
      });

      expect(tx.expenseSplit.deleteMany).toHaveBeenCalledWith({
        where: { expenseId: 'exp-1' },
      });
      expect(tx.expense.update).toHaveBeenCalled();
      expect(result).toEqual({ id: 'exp-1' });
    });

    it('allows the group owner (non-creator) to update it', async () => {
      prisma.expense.findUnique.mockResolvedValue(existingExpense);
      groupsService.assertMember.mockResolvedValue({ role: GroupRole.OWNER });
      const tx = {
        expenseSplit: { deleteMany: jest.fn() },
        expense: { update: jest.fn().mockResolvedValue({}) },
      };
      prisma.$transaction.mockImplementation((cb: any) => cb(tx));

      await expect(
        expensesService.updateExpense('owner-user', 'exp-1', {
          description: 'Updated',
          amountCents: 500,
          paidById: 'alice',
          splitType: SplitType.EQUAL,
          participantUserIds: ['alice', 'bob'],
        } as any),
      ).resolves.toBeDefined();
    });

    it('forbids a non-creator, non-owner member from updating it', async () => {
      prisma.expense.findUnique.mockResolvedValue(existingExpense);
      groupsService.assertMember.mockResolvedValue({ role: GroupRole.MEMBER });

      await expect(
        expensesService.updateExpense('bob', 'exp-1', {
          description: 'Updated',
          amountCents: 500,
          paidById: 'alice',
          splitType: SplitType.EQUAL,
          participantUserIds: ['alice', 'bob'],
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteExpense', () => {
    it('deletes the expense once ownership is verified', async () => {
      prisma.expense.findUnique.mockResolvedValue(existingExpense);
      groupsService.assertMember.mockResolvedValue({ role: GroupRole.MEMBER });

      const result = await expensesService.deleteExpense('alice', 'exp-1');

      expect(prisma.expense.delete).toHaveBeenCalledWith({
        where: { id: 'exp-1' },
      });
      expect(result).toEqual({ success: true });
    });

    it('forbids deletion by a non-creator, non-owner member', async () => {
      prisma.expense.findUnique.mockResolvedValue(existingExpense);
      groupsService.assertMember.mockResolvedValue({ role: GroupRole.MEMBER });

      await expect(
        expensesService.deleteExpense('bob', 'exp-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.expense.delete).not.toHaveBeenCalled();
    });
  });
});
