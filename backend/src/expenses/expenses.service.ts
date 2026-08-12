import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GroupsService } from '../groups/groups.service';
import { GroupRole, SplitType } from '../generated/prisma/client';
import { PUBLIC_USER_SELECT } from '../users/public-user.select';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { equalSplit, exactSplit, percentageSplit, ShareResult } from './split-calculator';

const EXPENSE_INCLUDE = {
  paidBy: { select: PUBLIC_USER_SELECT },
  createdBy: { select: PUBLIC_USER_SELECT },
  splits: { include: { user: { select: PUBLIC_USER_SELECT } } },
} as const;

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groupsService: GroupsService,
  ) {}

  private async computeShares(groupId: string, dto: CreateExpenseDto): Promise<ShareResult[]> {
    const memberIds = new Set(
      (await this.prisma.groupMember.findMany({ where: { groupId }, select: { userId: true } })).map(
        (m) => m.userId,
      ),
    );

    const assertAllMembers = (userIds: string[]) => {
      for (const userId of userIds) {
        if (!memberIds.has(userId)) {
          throw new BadRequestException(`User ${userId} is not a member of this group`);
        }
      }
    };

    if (!memberIds.has(dto.paidById)) {
      throw new BadRequestException('paidById must be a member of this group');
    }

    switch (dto.splitType) {
      case SplitType.EQUAL: {
        const participantIds = dto.participantUserIds ?? [];
        assertAllMembers(participantIds);
        return equalSplit(dto.amountCents, participantIds);
      }
      case SplitType.EXACT: {
        const splits = dto.splits ?? [];
        assertAllMembers(splits.map((s) => s.userId));
        return exactSplit(dto.amountCents, splits);
      }
      case SplitType.PERCENTAGE: {
        const splits = dto.splits ?? [];
        assertAllMembers(splits.map((s) => s.userId));
        return percentageSplit(dto.amountCents, splits);
      }
      default:
        throw new BadRequestException('Unsupported split type');
    }
  }

  async createExpense(requesterId: string, groupId: string, dto: CreateExpenseDto) {
    await this.groupsService.assertMember(groupId, requesterId);
    const shares = await this.computeShares(groupId, dto);

    return this.prisma.expense.create({
      data: {
        groupId,
        paidById: dto.paidById,
        description: dto.description,
        amountCents: dto.amountCents,
        currency: dto.currency ?? 'USD',
        category: dto.category,
        date: dto.date ? new Date(dto.date) : undefined,
        createdById: requesterId,
        splits: { create: shares },
      },
      include: EXPENSE_INCLUDE,
    });
  }

  async listGroupExpenses(requesterId: string, groupId: string) {
    await this.groupsService.assertMember(groupId, requesterId);
    return this.prisma.expense.findMany({
      where: { groupId },
      include: EXPENSE_INCLUDE,
      orderBy: { date: 'desc' },
    });
  }

  private async getOwnedExpense(requesterId: string, expenseId: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id: expenseId } });
    if (!expense) throw new NotFoundException('Expense not found');

    const membership = await this.groupsService.assertMember(expense.groupId, requesterId);
    if (expense.createdById !== requesterId && membership.role !== GroupRole.OWNER) {
      throw new ForbiddenException('Only the expense creator or the group owner can modify this expense');
    }
    return expense;
  }

  async updateExpense(requesterId: string, expenseId: string, dto: CreateExpenseDto) {
    const expense = await this.getOwnedExpense(requesterId, expenseId);
    const shares = await this.computeShares(expense.groupId, dto);

    return this.prisma.$transaction(async (tx) => {
      await tx.expenseSplit.deleteMany({ where: { expenseId } });
      return tx.expense.update({
        where: { id: expenseId },
        data: {
          paidById: dto.paidById,
          description: dto.description,
          amountCents: dto.amountCents,
          currency: dto.currency ?? 'USD',
          category: dto.category,
          date: dto.date ? new Date(dto.date) : undefined,
          splits: { create: shares },
        },
        include: EXPENSE_INCLUDE,
      });
    });
  }

  async deleteExpense(requesterId: string, expenseId: string) {
    await this.getOwnedExpense(requesterId, expenseId);
    await this.prisma.expense.delete({ where: { id: expenseId } });
    return { success: true };
  }
}
