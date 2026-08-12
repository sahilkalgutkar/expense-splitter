import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InvitesService } from './invites.service';
import { InviteStatus } from '../generated/prisma/client';

describe('InvitesService', () => {
  let prisma: any;
  let groupsService: any;
  let emailService: any;
  let invitesService: InvitesService;

  const groupId = 'group-1';
  const group = { id: groupId, name: 'Trip' };

  beforeEach(() => {
    prisma = {
      group: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(group),
        findUnique: jest.fn(),
      },
      groupMember: {
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
      },
      invite: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn().mockResolvedValue(undefined),
    };
    groupsService = { assertMember: jest.fn().mockResolvedValue({}) };
    emailService = { sendInviteEmail: jest.fn().mockResolvedValue(undefined) };
    invitesService = new InvitesService(prisma, groupsService, emailService);
  });

  describe('createInvite', () => {
    it('requires the requester to be a group member', async () => {
      groupsService.assertMember.mockRejectedValue(new ForbiddenException());

      await expect(
        invitesService.createInvite('outsider', groupId, {
          email: 'x@example.com',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.invite.create).not.toHaveBeenCalled();
    });

    it('rejects inviting someone who is already a member', async () => {
      prisma.groupMember.findFirst.mockResolvedValue({ id: 'gm-1' });

      await expect(
        invitesService.createInvite('alice', groupId, {
          email: 'bob@example.com',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.invite.create).not.toHaveBeenCalled();
    });

    it('creates an invite with a random token and sends the invite email', async () => {
      prisma.invite.create.mockResolvedValue({
        id: 'invite-1',
        token: 'irrelevant-because-random',
      });

      await invitesService.createInvite('alice', groupId, {
        email: 'dave@example.com',
      });

      const createArgs = prisma.invite.create.mock.calls[0][0];
      expect(createArgs.data.groupId).toBe(groupId);
      expect(createArgs.data.email).toBe('dave@example.com');
      expect(createArgs.data.invitedById).toBe('alice');
      expect(typeof createArgs.data.token).toBe('string');
      expect(createArgs.data.token.length).toBeGreaterThan(0);
      expect(createArgs.data.expiresAt.getTime()).toBeGreaterThan(Date.now());

      expect(emailService.sendInviteEmail).toHaveBeenCalledWith(
        'dave@example.com',
        'Trip',
        expect.stringContaining(createArgs.data.token),
      );
    });
  });

  describe('listPendingForGroup', () => {
    it('requires membership and filters to PENDING invites', async () => {
      prisma.invite.findMany.mockResolvedValue([]);

      await invitesService.listPendingForGroup('alice', groupId);

      expect(groupsService.assertMember).toHaveBeenCalledWith(groupId, 'alice');
      expect(prisma.invite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { groupId, status: InviteStatus.PENDING },
        }),
      );
    });
  });

  describe('acceptInvite', () => {
    const baseInvite = {
      id: 'invite-1',
      groupId,
      email: 'dave@example.com',
      status: InviteStatus.PENDING,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    };

    it('throws NotFoundException when the token does not match an invite', async () => {
      prisma.invite.findUnique.mockResolvedValue(null);

      await expect(
        invitesService.acceptInvite('dave@example.com', 'dave', 'bad-token'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the invite was already used', async () => {
      prisma.invite.findUnique.mockResolvedValue({
        ...baseInvite,
        status: InviteStatus.ACCEPTED,
      });

      await expect(
        invitesService.acceptInvite('dave@example.com', 'dave', 'token'),
      ).rejects.toThrow(BadRequestException);
    });

    it('marks an expired invite as EXPIRED and rejects it', async () => {
      prisma.invite.findUnique.mockResolvedValue({
        ...baseInvite,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        invitesService.acceptInvite('dave@example.com', 'dave', 'token'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.invite.update).toHaveBeenCalledWith({
        where: { id: baseInvite.id },
        data: { status: InviteStatus.EXPIRED },
      });
    });

    it('rejects acceptance from a different email address, case-insensitively checked', async () => {
      prisma.invite.findUnique.mockResolvedValue(baseInvite);

      await expect(
        invitesService.acceptInvite(
          'someone-else@example.com',
          'dave',
          'token',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('adds the user to the group and marks the invite ACCEPTED on success (case-insensitive email match)', async () => {
      prisma.invite.findUnique.mockResolvedValue(baseInvite);
      prisma.group.findUnique.mockResolvedValue({ id: groupId, members: [] });

      const result = await invitesService.acceptInvite(
        'DAVE@example.com',
        'dave',
        'token',
      );

      expect(prisma.groupMember.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { groupId_userId: { groupId, userId: 'dave' } },
          create: { groupId, userId: 'dave' },
        }),
      );
      expect(prisma.invite.update).toHaveBeenCalledWith({
        where: { id: baseInvite.id },
        data: { status: InviteStatus.ACCEPTED },
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(2);
      expect(result).toEqual({ id: groupId, members: [] });
    });
  });
});
