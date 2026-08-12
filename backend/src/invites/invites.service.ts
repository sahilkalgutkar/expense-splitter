import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { GroupsService } from '../groups/groups.service';
import { EmailService } from '../email/email.service';
import { InviteStatus } from '../generated/prisma/client';
import { PUBLIC_USER_SELECT } from '../users/public-user.select';
import { CreateInviteDto } from './dto/create-invite.dto';

const INVITE_TTL_DAYS = 7;

@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groupsService: GroupsService,
    private readonly emailService: EmailService,
  ) {}

  async createInvite(requesterId: string, groupId: string, dto: CreateInviteDto) {
    await this.groupsService.assertMember(groupId, requesterId);

    const group = await this.prisma.group.findUniqueOrThrow({ where: { id: groupId } });

    const existingMember = await this.prisma.groupMember.findFirst({
      where: { groupId, user: { email: dto.email } },
    });
    if (existingMember) throw new BadRequestException('This person is already a member of the group');

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

    const invite = await this.prisma.invite.create({
      data: {
        groupId,
        email: dto.email,
        token,
        invitedById: requesterId,
        expiresAt,
      },
    });

    const inviteLink = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/invite/${token}`;
    await this.emailService.sendInviteEmail(dto.email, group.name, inviteLink);

    return invite;
  }

  async listPendingForGroup(requesterId: string, groupId: string) {
    await this.groupsService.assertMember(groupId, requesterId);
    return this.prisma.invite.findMany({
      where: { groupId, status: InviteStatus.PENDING },
      orderBy: { createdAt: 'desc' },
    });
  }

  async acceptInvite(userEmail: string, userId: string, token: string) {
    const invite = await this.prisma.invite.findUnique({ where: { token } });
    if (!invite) throw new NotFoundException('Invite not found');

    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException('This invite has already been used');
    }
    if (invite.expiresAt < new Date()) {
      await this.prisma.invite.update({ where: { id: invite.id }, data: { status: InviteStatus.EXPIRED } });
      throw new BadRequestException('This invite has expired');
    }
    if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
      throw new ForbiddenException('This invite was sent to a different email address');
    }

    await this.prisma.$transaction([
      this.prisma.groupMember.upsert({
        where: { groupId_userId: { groupId: invite.groupId, userId } },
        create: { groupId: invite.groupId, userId },
        update: {},
      }),
      this.prisma.invite.update({ where: { id: invite.id }, data: { status: InviteStatus.ACCEPTED } }),
    ]);

    return this.prisma.group.findUnique({
      where: { id: invite.groupId },
      include: { members: { include: { user: { select: PUBLIC_USER_SELECT } } } },
    });
  }
}
