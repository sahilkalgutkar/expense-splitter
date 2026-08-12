import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { GroupsService } from '../groups/groups.service';
import { Cadence, GroupRole, SplitType } from '../generated/prisma/client';
import {
  equalSplit,
  exactSplit,
  percentageSplit,
  ShareResult,
  SplitInput,
} from '../expenses/split-calculator';
import { CreateRecurringExpenseDto } from './dto/create-recurring-expense.dto';

const MAX_CATCH_UP_RUNS = 24;

interface SplitConfig {
  participantUserIds?: string[];
  splits?: SplitInput[];
}

function advance(date: Date, cadence: Cadence): Date {
  const next = new Date(date);
  if (cadence === Cadence.WEEKLY) {
    next.setUTCDate(next.getUTCDate() + 7);
  } else {
    next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next;
}

@Injectable()
export class RecurringService {
  private readonly logger = new Logger(RecurringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly groupsService: GroupsService,
  ) {}

  private async validateAndBuildSplitConfig(
    groupId: string,
    dto: Pick<
      CreateRecurringExpenseDto,
      'paidById' | 'splitType' | 'participantUserIds' | 'splits'
    >,
  ): Promise<SplitConfig> {
    const memberIds = new Set(
      (
        await this.prisma.groupMember.findMany({
          where: { groupId },
          select: { userId: true },
        })
      ).map((m) => m.userId),
    );
    if (!memberIds.has(dto.paidById))
      throw new BadRequestException('paidById must be a member of this group');

    if (dto.splitType === SplitType.EQUAL) {
      const participantUserIds = dto.participantUserIds ?? [];
      for (const id of participantUserIds) {
        if (!memberIds.has(id))
          throw new BadRequestException(
            `User ${id} is not a member of this group`,
          );
      }
      if (participantUserIds.length === 0)
        throw new BadRequestException('At least one participant is required');
      return { participantUserIds };
    }

    const splits = dto.splits ?? [];
    for (const s of splits) {
      if (!memberIds.has(s.userId))
        throw new BadRequestException(
          `User ${s.userId} is not a member of this group`,
        );
    }
    if (splits.length === 0)
      throw new BadRequestException('At least one split is required');
    return { splits };
  }

  private computeShares(
    amountCents: number,
    splitType: SplitType,
    config: SplitConfig,
  ): ShareResult[] {
    if (splitType === SplitType.EQUAL)
      return equalSplit(amountCents, config.participantUserIds ?? []);
    if (splitType === SplitType.EXACT)
      return exactSplit(amountCents, config.splits ?? []);
    return percentageSplit(amountCents, config.splits ?? []);
  }

  async create(
    requesterId: string,
    groupId: string,
    dto: CreateRecurringExpenseDto,
  ) {
    await this.groupsService.assertMember(groupId, requesterId);
    const splitConfig = await this.validateAndBuildSplitConfig(groupId, dto);
    // Validate the split math up front so bad input fails at creation time, not silently at cron time.
    this.computeShares(dto.amountCents, dto.splitType, splitConfig);

    return this.prisma.recurringExpense.create({
      data: {
        groupId,
        description: dto.description,
        amountCents: dto.amountCents,
        paidById: dto.paidById,
        splitType: dto.splitType,
        // no-unnecessary-type-assertion misjudges this as removable (a known false positive against
        // Prisma's recursive InputJsonValue union), then eslint --fix silently strips it and breaks
        // `nest build`. Disabling the rule for this line only is more durable than a cast it'll strip.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        splitConfig: splitConfig as object,
        cadence: dto.cadence,
        nextRunAt: dto.startDate ? new Date(dto.startDate) : new Date(),
        createdById: requesterId,
      },
    });
  }

  async listForGroup(requesterId: string, groupId: string) {
    await this.groupsService.assertMember(groupId, requesterId);
    return this.prisma.recurringExpense.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setActive(requesterId: string, id: string, active: boolean) {
    const recurring = await this.prisma.recurringExpense.findUnique({
      where: { id },
    });
    if (!recurring) throw new NotFoundException('Recurring expense not found');

    const membership = await this.groupsService.assertMember(
      recurring.groupId,
      requesterId,
    );
    if (
      recurring.createdById !== requesterId &&
      membership.role !== GroupRole.OWNER
    ) {
      throw new ForbiddenException(
        'Only the creator or the group owner can modify this recurring expense',
      );
    }

    return this.prisma.recurringExpense.update({
      where: { id },
      data: { active },
    });
  }

  /** Materializes a single due recurring expense into a real Expense + splits, and advances nextRunAt. */
  private async runOnce(recurring: {
    id: string;
    groupId: string;
    description: string;
    amountCents: number;
    paidById: string;
    splitType: SplitType;
    splitConfig: unknown;
    cadence: Cadence;
    nextRunAt: Date;
    createdById: string;
  }) {
    const config = recurring.splitConfig as SplitConfig;
    const shares = this.computeShares(
      recurring.amountCents,
      recurring.splitType,
      config,
    );

    await this.prisma.$transaction([
      this.prisma.expense.create({
        data: {
          groupId: recurring.groupId,
          paidById: recurring.paidById,
          description: recurring.description,
          amountCents: recurring.amountCents,
          createdById: recurring.createdById,
          recurringExpenseId: recurring.id,
          date: recurring.nextRunAt,
          splits: { create: shares },
        },
      }),
      this.prisma.recurringExpense.update({
        where: { id: recurring.id },
        data: { nextRunAt: advance(recurring.nextRunAt, recurring.cadence) },
      }),
    ]);
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async processDueRecurringExpenses(): Promise<void> {
    const due = await this.prisma.recurringExpense.findMany({
      where: { active: true, nextRunAt: { lte: new Date() } },
    });

    for (const recurring of due) {
      let current = recurring;
      for (
        let i = 0;
        i < MAX_CATCH_UP_RUNS && current.nextRunAt <= new Date();
        i++
      ) {
        await this.runOnce(current);
        const refreshed = await this.prisma.recurringExpense.findUnique({
          where: { id: current.id },
        });
        if (!refreshed || !refreshed.active) break;
        current = refreshed;
      }
    }

    if (due.length > 0) {
      this.logger.log(`Processed ${due.length} due recurring expense(s)`);
    }
  }
}
