import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GroupRole } from '../generated/prisma/client';
import { PUBLIC_USER_SELECT } from '../users/public-user.select';
import { CreateGroupDto } from './dto/create-group.dto';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async createGroup(userId: string, dto: CreateGroupDto) {
    return this.prisma.group.create({
      data: {
        name: dto.name,
        createdById: userId,
        members: {
          create: { userId, role: GroupRole.OWNER },
        },
      },
      include: { members: { include: { user: { select: PUBLIC_USER_SELECT } } } },
    });
  }

  async listMyGroups(userId: string) {
    const memberships = await this.prisma.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: { members: { include: { user: { select: PUBLIC_USER_SELECT } } } },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });
    return memberships.map((m) => m.group);
  }

  /** Throws if the user is not a member of the group. Returns their membership row. */
  async assertMember(groupId: string, userId: string) {
    const membership = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!membership) throw new ForbiddenException('You are not a member of this group');
    return membership;
  }

  async getGroupDetail(userId: string, groupId: string) {
    await this.assertMember(groupId, userId);
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { members: { include: { user: { select: PUBLIC_USER_SELECT } } } },
    });
    if (!group) throw new NotFoundException('Group not found');
    return group;
  }

  async removeMember(requesterId: string, groupId: string, targetUserId: string) {
    const requesterMembership = await this.assertMember(groupId, requesterId);

    if (requesterId !== targetUserId && requesterMembership.role !== GroupRole.OWNER) {
      throw new ForbiddenException('Only the group owner can remove other members');
    }

    const targetMembership = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });
    if (!targetMembership) throw new NotFoundException('Membership not found');

    if (targetMembership.role === GroupRole.OWNER) {
      throw new ForbiddenException('The group owner cannot be removed. Transfer ownership first.');
    }

    await this.prisma.groupMember.delete({ where: { id: targetMembership.id } });
    return { success: true };
  }
}
