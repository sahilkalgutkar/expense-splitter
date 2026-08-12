import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RecurringService } from './recurring.service';
import { Cadence, GroupRole, SplitType } from '../generated/prisma/client';

describe('RecurringService', () => {
  let prisma: any;
  let groupsService: any;
  let recurringService: RecurringService;

  const groupId = 'group-1';
  const members = ['alice', 'bob', 'carol'];

  beforeEach(() => {
    prisma = {
      groupMember: {
        findMany: jest
          .fn()
          .mockResolvedValue(members.map((userId) => ({ userId }))),
      },
      recurringExpense: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      expense: { create: jest.fn() },
      $transaction: jest.fn().mockResolvedValue(undefined),
    };
    groupsService = {
      assertMember: jest.fn().mockResolvedValue({ role: GroupRole.MEMBER }),
    };
    recurringService = new RecurringService(prisma, groupsService);
  });

  describe('create', () => {
    const baseDto = {
      description: 'Rent',
      amountCents: 3000,
      paidById: 'alice',
      splitType: SplitType.EQUAL,
      participantUserIds: ['alice', 'bob', 'carol'],
      cadence: Cadence.MONTHLY,
    };

    it('requires the requester to be a group member', async () => {
      groupsService.assertMember.mockRejectedValue(new ForbiddenException());

      await expect(
        recurringService.create('outsider', groupId, baseDto as any),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.recurringExpense.create).not.toHaveBeenCalled();
    });

    it('rejects a payer who is not a group member', async () => {
      await expect(
        recurringService.create('alice', groupId, {
          ...baseDto,
          paidById: 'dave',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an EQUAL split participant who is not a group member', async () => {
      await expect(
        recurringService.create('alice', groupId, {
          ...baseDto,
          participantUserIds: ['alice', 'dave'],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an EQUAL split with zero participants', async () => {
      await expect(
        recurringService.create('alice', groupId, {
          ...baseDto,
          participantUserIds: [],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a non-EQUAL split whose userIds are not all group members', async () => {
      await expect(
        recurringService.create('alice', groupId, {
          ...baseDto,
          splitType: SplitType.EXACT,
          splits: [{ userId: 'dave', value: 3000 }],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a non-EQUAL split with zero entries', async () => {
      await expect(
        recurringService.create('alice', groupId, {
          ...baseDto,
          splitType: SplitType.EXACT,
          splits: [],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('validates split math up front, before ever creating the recurring expense', async () => {
      await expect(
        recurringService.create('alice', groupId, {
          ...baseDto,
          splitType: SplitType.EXACT,
          splits: [
            { userId: 'alice', value: 1000 },
            { userId: 'bob', value: 1000 },
          ], // sums to 2000, not amountCents (3000)
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.recurringExpense.create).not.toHaveBeenCalled();
    });

    it('creates the recurring expense with the given split config and cadence', async () => {
      prisma.recurringExpense.create.mockResolvedValue({ id: 'rec-1' });

      await recurringService.create('alice', groupId, baseDto);

      const createArgs = prisma.recurringExpense.create.mock.calls[0][0];
      expect(createArgs.data.groupId).toBe(groupId);
      expect(createArgs.data.cadence).toBe(Cadence.MONTHLY);
      expect(createArgs.data.splitConfig).toEqual({
        participantUserIds: ['alice', 'bob', 'carol'],
      });
      expect(createArgs.data.createdById).toBe('alice');
    });

    it('defaults nextRunAt to now when no startDate is given', async () => {
      prisma.recurringExpense.create.mockResolvedValue({ id: 'rec-1' });
      const before = Date.now();

      await recurringService.create('alice', groupId, baseDto);

      const createArgs = prisma.recurringExpense.create.mock.calls[0][0];
      expect(createArgs.data.nextRunAt.getTime()).toBeGreaterThanOrEqual(
        before,
      );
    });

    it('uses the given startDate for nextRunAt when provided', async () => {
      prisma.recurringExpense.create.mockResolvedValue({ id: 'rec-1' });
      const startDate = '2026-06-01T00:00:00.000Z';

      await recurringService.create('alice', groupId, {
        ...baseDto,
        startDate,
      });

      const createArgs = prisma.recurringExpense.create.mock.calls[0][0];
      expect(createArgs.data.nextRunAt).toEqual(new Date(startDate));
    });
  });

  describe('listForGroup', () => {
    it('requires membership and lists newest first', async () => {
      prisma.recurringExpense.findMany.mockResolvedValue([{ id: 'rec-1' }]);

      const result = await recurringService.listForGroup('alice', groupId);

      expect(groupsService.assertMember).toHaveBeenCalledWith(groupId, 'alice');
      expect(prisma.recurringExpense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { groupId },
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result).toEqual([{ id: 'rec-1' }]);
    });
  });

  describe('setActive', () => {
    const existing = { id: 'rec-1', groupId, createdById: 'alice' };

    it('throws NotFoundException when the recurring expense does not exist', async () => {
      prisma.recurringExpense.findUnique.mockResolvedValue(null);

      await expect(
        recurringService.setActive('alice', 'missing', false),
      ).rejects.toThrow(NotFoundException);
    });

    it('allows the creator to toggle it', async () => {
      prisma.recurringExpense.findUnique.mockResolvedValue(existing);
      groupsService.assertMember.mockResolvedValue({ role: GroupRole.MEMBER });
      prisma.recurringExpense.update.mockResolvedValue({
        ...existing,
        active: false,
      });

      const result = await recurringService.setActive('alice', 'rec-1', false);

      expect(prisma.recurringExpense.update).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
        data: { active: false },
      });
      expect(result.active).toBe(false);
    });

    it('allows the group owner (non-creator) to toggle it', async () => {
      prisma.recurringExpense.findUnique.mockResolvedValue(existing);
      groupsService.assertMember.mockResolvedValue({ role: GroupRole.OWNER });
      prisma.recurringExpense.update.mockResolvedValue({
        ...existing,
        active: true,
      });

      await expect(
        recurringService.setActive('owner-user', 'rec-1', true),
      ).resolves.toBeDefined();
    });

    it('forbids a non-creator, non-owner member from toggling it', async () => {
      prisma.recurringExpense.findUnique.mockResolvedValue(existing);
      groupsService.assertMember.mockResolvedValue({ role: GroupRole.MEMBER });

      await expect(
        recurringService.setActive('bob', 'rec-1', false),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.recurringExpense.update).not.toHaveBeenCalled();
    });
  });

  describe('processDueRecurringExpenses', () => {
    const dueRecurring = {
      id: 'rec-1',
      groupId,
      description: 'Rent',
      amountCents: 3000,
      paidById: 'alice',
      splitType: SplitType.EQUAL,
      splitConfig: { participantUserIds: ['alice', 'bob', 'carol'] },
      cadence: Cadence.MONTHLY,
      nextRunAt: new Date('2020-01-01T00:00:00Z'),
      createdById: 'alice',
      active: true,
    };

    it('does nothing when no recurring expenses are due', async () => {
      prisma.recurringExpense.findMany.mockResolvedValue([]);

      await recurringService.processDueRecurringExpenses();

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('materializes a single due run into an Expense with correctly-split shares, and advances nextRunAt by one month for MONTHLY', async () => {
      prisma.recurringExpense.findMany.mockResolvedValue([dueRecurring]);
      // After the first run, refreshed nextRunAt is in the future -> loop stops.
      prisma.recurringExpense.findUnique.mockResolvedValue({
        ...dueRecurring,
        nextRunAt: new Date('2099-01-01T00:00:00Z'),
      });

      await recurringService.processDueRecurringExpenses();

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);

      const expenseCreateArgs = prisma.expense.create.mock.calls[0][0];
      expect(expenseCreateArgs.data.recurringExpenseId).toBe('rec-1');
      expect(expenseCreateArgs.data.groupId).toBe(groupId);
      const shares = expenseCreateArgs.data.splits.create;
      expect(
        shares.reduce((sum: number, s: any) => sum + s.shareCents, 0),
      ).toBe(3000);

      expect(prisma.recurringExpense.update).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
        data: { nextRunAt: new Date('2020-02-01T00:00:00Z') },
      });
    });

    it('advances by exactly 7 days for a WEEKLY cadence', async () => {
      const weekly = {
        ...dueRecurring,
        cadence: Cadence.WEEKLY,
        nextRunAt: new Date('2020-01-01T00:00:00Z'),
      };
      prisma.recurringExpense.findMany.mockResolvedValue([weekly]);
      prisma.recurringExpense.findUnique.mockResolvedValue({
        ...weekly,
        active: false,
      });

      await recurringService.processDueRecurringExpenses();

      expect(prisma.recurringExpense.update).toHaveBeenCalledWith({
        where: { id: weekly.id },
        data: { nextRunAt: new Date('2020-01-08T00:00:00Z') },
      });
    });

    it('stops the catch-up loop once the refreshed row is inactive', async () => {
      prisma.recurringExpense.findMany.mockResolvedValue([dueRecurring]);
      prisma.recurringExpense.findUnique.mockResolvedValue({
        ...dueRecurring,
        active: false,
      });

      await recurringService.processDueRecurringExpenses();

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('stops the catch-up loop once the refreshed row is missing (deleted)', async () => {
      prisma.recurringExpense.findMany.mockResolvedValue([dueRecurring]);
      prisma.recurringExpense.findUnique.mockResolvedValue(null);

      await recurringService.processDueRecurringExpenses();

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('never runs more than MAX_CATCH_UP_RUNS (24) iterations for a single recurring expense', async () => {
      prisma.recurringExpense.findMany.mockResolvedValue([dueRecurring]);
      // Always refreshed as still-due and still-active -> would loop forever without the bound.
      prisma.recurringExpense.findUnique.mockResolvedValue(dueRecurring);

      await recurringService.processDueRecurringExpenses();

      expect(prisma.$transaction).toHaveBeenCalledTimes(24);
    });

    it('processes multiple due recurring expenses independently', async () => {
      const second = { ...dueRecurring, id: 'rec-2', groupId: 'group-2' };
      prisma.recurringExpense.findMany.mockResolvedValue([
        dueRecurring,
        second,
      ]);
      prisma.recurringExpense.findUnique.mockResolvedValue({
        ...dueRecurring,
        nextRunAt: new Date('2099-01-01T00:00:00Z'),
      });

      await recurringService.processDueRecurringExpenses();

      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });
  });
});
