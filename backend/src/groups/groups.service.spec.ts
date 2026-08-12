import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { GroupRole } from '../generated/prisma/client';

describe('GroupsService', () => {
  let prisma: any;
  let groupsService: GroupsService;

  beforeEach(() => {
    prisma = {
      group: { create: jest.fn(), findUnique: jest.fn() },
      groupMember: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
    };
    groupsService = new GroupsService(prisma);
  });

  describe('createGroup', () => {
    it('creates the group with the creator as OWNER', async () => {
      prisma.group.create.mockResolvedValue({ id: 'group-1' });

      await groupsService.createGroup('alice', { name: 'Trip' });

      expect(prisma.group.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Trip',
            createdById: 'alice',
            members: { create: { userId: 'alice', role: GroupRole.OWNER } },
          }),
        }),
      );
    });
  });

  describe('listMyGroups', () => {
    it('returns the groups from the requester memberships', async () => {
      prisma.groupMember.findMany.mockResolvedValue([
        { group: { id: 'group-1' } },
        { group: { id: 'group-2' } },
      ]);

      const result = await groupsService.listMyGroups('alice');

      expect(result).toEqual([{ id: 'group-1' }, { id: 'group-2' }]);
    });
  });

  describe('assertMember', () => {
    it('throws ForbiddenException when the user is not a member', async () => {
      prisma.groupMember.findUnique.mockResolvedValue(null);

      await expect(
        groupsService.assertMember('group-1', 'stranger'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns the membership when the user is a member', async () => {
      const membership = { role: GroupRole.MEMBER };
      prisma.groupMember.findUnique.mockResolvedValue(membership);

      await expect(
        groupsService.assertMember('group-1', 'alice'),
      ).resolves.toBe(membership);
    });
  });

  describe('getGroupDetail', () => {
    it('throws NotFoundException when the group is missing', async () => {
      prisma.groupMember.findUnique.mockResolvedValue({
        role: GroupRole.MEMBER,
      });
      prisma.group.findUnique.mockResolvedValue(null);

      await expect(
        groupsService.getGroupDetail('alice', 'group-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('requires membership before returning the group', async () => {
      prisma.groupMember.findUnique.mockResolvedValue(null);

      await expect(
        groupsService.getGroupDetail('stranger', 'group-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.group.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('removeMember', () => {
    it('allows a member to remove themself', async () => {
      prisma.groupMember.findUnique
        .mockResolvedValueOnce({ role: GroupRole.MEMBER }) // requester membership
        .mockResolvedValueOnce({ id: 'gm-1', role: GroupRole.MEMBER }); // target membership

      const result = await groupsService.removeMember('bob', 'group-1', 'bob');

      expect(prisma.groupMember.delete).toHaveBeenCalledWith({
        where: { id: 'gm-1' },
      });
      expect(result).toEqual({ success: true });
    });

    it('forbids a non-owner from removing someone else', async () => {
      prisma.groupMember.findUnique.mockResolvedValueOnce({
        role: GroupRole.MEMBER,
      });

      await expect(
        groupsService.removeMember('bob', 'group-1', 'carol'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.groupMember.delete).not.toHaveBeenCalled();
    });

    it('allows the owner to remove another member', async () => {
      prisma.groupMember.findUnique
        .mockResolvedValueOnce({ role: GroupRole.OWNER })
        .mockResolvedValueOnce({ id: 'gm-2', role: GroupRole.MEMBER });

      const result = await groupsService.removeMember(
        'alice',
        'group-1',
        'bob',
      );

      expect(result).toEqual({ success: true });
    });

    it('throws NotFoundException when the target membership does not exist', async () => {
      prisma.groupMember.findUnique
        .mockResolvedValueOnce({ role: GroupRole.OWNER })
        .mockResolvedValueOnce(null);

      await expect(
        groupsService.removeMember('alice', 'group-1', 'ghost'),
      ).rejects.toThrow(NotFoundException);
    });

    it('refuses to remove the group owner, even by the owner themself', async () => {
      prisma.groupMember.findUnique
        .mockResolvedValueOnce({ role: GroupRole.OWNER })
        .mockResolvedValueOnce({ id: 'gm-1', role: GroupRole.OWNER });

      await expect(
        groupsService.removeMember('alice', 'group-1', 'alice'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.groupMember.delete).not.toHaveBeenCalled();
    });
  });
});
