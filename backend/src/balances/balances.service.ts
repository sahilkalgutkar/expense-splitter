import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PUBLIC_USER_SELECT } from '../users/public-user.select';

export interface MemberBalance {
  userId: string;
  name: string;
  email: string;
  netCents: number;
}

@Injectable()
export class BalancesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Positive netCents = the group owes this user money. Negative = this user owes the group money. */
  async computeNetBalances(groupId: string): Promise<Map<string, number>> {
    const [expenses, splits, settlements] = await Promise.all([
      this.prisma.expense.findMany({ where: { groupId }, select: { id: true, paidById: true, amountCents: true } }),
      this.prisma.expenseSplit.findMany({
        where: { expense: { groupId } },
        select: { userId: true, shareCents: true },
      }),
      this.prisma.settlement.findMany({
        where: { groupId },
        select: { fromUserId: true, toUserId: true, amountCents: true },
      }),
    ]);

    const net = new Map<string, number>();
    const add = (userId: string, deltaCents: number) => net.set(userId, (net.get(userId) ?? 0) + deltaCents);

    for (const expense of expenses) add(expense.paidById, expense.amountCents);
    for (const split of splits) add(split.userId, -split.shareCents);
    for (const settlement of settlements) {
      add(settlement.fromUserId, settlement.amountCents);
      add(settlement.toUserId, -settlement.amountCents);
    }

    return net;
  }

  async getGroupBalances(groupId: string): Promise<MemberBalance[]> {
    const [members, net] = await Promise.all([
      this.prisma.groupMember.findMany({
        where: { groupId },
        select: { user: { select: PUBLIC_USER_SELECT } },
      }),
      this.computeNetBalances(groupId),
    ]);

    return members.map(({ user }) => ({
      userId: user.id,
      name: user.name,
      email: user.email,
      netCents: net.get(user.id) ?? 0,
    }));
  }
}
