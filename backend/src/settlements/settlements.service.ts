import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GroupsService } from '../groups/groups.service';
import { BalancesService } from '../balances/balances.service';
import { PUBLIC_USER_SELECT } from '../users/public-user.select';
import { computeSettlement } from './settle-up.util';
import { CreateSettlementDto } from './dto/create-settlement.dto';

const SETTLEMENT_INCLUDE = {
  fromUser: { select: PUBLIC_USER_SELECT },
  toUser: { select: PUBLIC_USER_SELECT },
} as const;

@Injectable()
export class SettlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groupsService: GroupsService,
    private readonly balancesService: BalancesService,
  ) {}

  async getSettleUpSuggestions(requesterId: string, groupId: string) {
    await this.groupsService.assertMember(groupId, requesterId);

    const [balances, members] = await Promise.all([
      this.balancesService.computeNetBalances(groupId),
      this.prisma.groupMember.findMany({ where: { groupId }, select: { user: { select: PUBLIC_USER_SELECT } } }),
    ]);

    const usersById = new Map(members.map((m) => [m.user.id, m.user]));
    const suggestions = computeSettlement(balances);

    return suggestions.map((s) => ({
      ...s,
      fromUser: usersById.get(s.fromUserId),
      toUser: usersById.get(s.toUserId),
    }));
  }

  async listSettlements(requesterId: string, groupId: string) {
    await this.groupsService.assertMember(groupId, requesterId);
    return this.prisma.settlement.findMany({
      where: { groupId },
      include: SETTLEMENT_INCLUDE,
      orderBy: { settledAt: 'desc' },
    });
  }

  async recordSettlement(requesterId: string, groupId: string, dto: CreateSettlementDto) {
    await this.groupsService.assertMember(groupId, requesterId);

    if (dto.fromUserId === dto.toUserId) {
      throw new BadRequestException('fromUserId and toUserId must be different');
    }

    const members = await this.prisma.groupMember.findMany({
      where: { groupId, userId: { in: [dto.fromUserId, dto.toUserId] } },
    });
    if (members.length !== 2) {
      throw new BadRequestException('Both users must be members of this group');
    }

    return this.prisma.settlement.create({
      data: {
        groupId,
        fromUserId: dto.fromUserId,
        toUserId: dto.toUserId,
        amountCents: dto.amountCents,
        note: dto.note,
      },
      include: SETTLEMENT_INCLUDE,
    });
  }
}
