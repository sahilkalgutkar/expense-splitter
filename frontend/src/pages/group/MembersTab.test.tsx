import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MembersTab } from './MembersTab';
import type { Group } from '../../types/api';

const removeMutateMock = vi.fn();
const createInviteMutateAsyncMock = vi.fn();
const usePendingInvitesMock = vi.fn();
vi.mock('../../api/groups', () => ({
  useRemoveMember: () => ({ mutate: removeMutateMock }),
}));
vi.mock('../../api/invites', () => ({
  useCreateInvite: () => ({ mutateAsync: createInviteMutateAsyncMock }),
  usePendingInvites: () => usePendingInvitesMock(),
}));

let authUser: { id: string } | null = { id: 'u1' };
vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: authUser }),
}));

function buildGroup(members: Group['members']): Group {
  return { id: 'g1', name: 'Trip', createdById: 'u1', createdAt: '', members };
}

const owner = { id: 'm1', groupId: 'g1', userId: 'u1', role: 'OWNER' as const, joinedAt: '', user: { id: 'u1', name: 'Alice', email: 'alice@example.com', createdAt: '' } };
const member = { id: 'm2', groupId: 'g1', userId: 'u2', role: 'MEMBER' as const, joinedAt: '', user: { id: 'u2', name: 'Bob', email: 'bob@example.com', createdAt: '' } };

describe('MembersTab', () => {
  beforeEach(() => {
    authUser = { id: 'u1' };
    removeMutateMock.mockReset();
    createInviteMutateAsyncMock.mockReset();
    usePendingInvitesMock.mockReset().mockReturnValue({ data: [] });
  });

  it('lists members and marks the owner', () => {
    render(<MembersTab group={buildGroup([owner, member])} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('does not show a remove/leave action for the owner row', () => {
    render(<MembersTab group={buildGroup([owner, member])} />);
    // Owner (Alice) has no action button since role === 'OWNER'; only Bob (member) gets one.
    expect(screen.getAllByRole('button', { name: /Remove|Leave/ })).toHaveLength(1);
  });

  it('lets the group owner remove another member', async () => {
    authUser = { id: 'u1' };
    render(<MembersTab group={buildGroup([owner, member])} />);

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(removeMutateMock).toHaveBeenCalledWith('u2');
  });

  it('lets a member leave the group themselves', async () => {
    authUser = { id: 'u2' };
    render(<MembersTab group={buildGroup([owner, member])} />);

    const leaveButton = screen.getByRole('button', { name: 'Leave' });
    await userEvent.click(leaveButton);
    expect(removeMutateMock).toHaveBeenCalledWith('u2');
  });

  it('does not let a non-owner member remove someone else', () => {
    authUser = { id: 'u2' };
    const otherMember = { id: 'm3', groupId: 'g1', userId: 'u3', role: 'MEMBER' as const, joinedAt: '', user: { id: 'u3', name: 'Carol', email: 'carol@example.com', createdAt: '' } };
    render(<MembersTab group={buildGroup([owner, member, otherMember])} />);

    // u2 (Bob) can only Leave for themselves, no action shown for Carol.
    expect(screen.getAllByRole('button', { name: /Remove|Leave/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Leave' })).toBeInTheDocument();
  });

  it('validates the invite email before submitting', async () => {
    render(<MembersTab group={buildGroup([owner])} />);

    // No TLD: passes the browser's native <input type="email"> constraint validation (so the
    // submit event actually reaches React) but fails Zod's stricter email pattern.
    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email@test');
    await userEvent.click(screen.getByRole('button', { name: 'Send invite' }));

    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument();
    expect(createInviteMutateAsyncMock).not.toHaveBeenCalled();
  });

  it('sends an invite and shows a confirmation message', async () => {
    createInviteMutateAsyncMock.mockResolvedValueOnce({ id: 'inv1' });
    render(<MembersTab group={buildGroup([owner])} />);

    await userEvent.type(screen.getByLabelText('Email'), 'carol@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send invite' }));

    expect(createInviteMutateAsyncMock).toHaveBeenCalledWith('carol@example.com');
    expect(await screen.findByText('Invite sent to carol@example.com.')).toBeInTheDocument();
  });

  it('shows the server error message when the invite fails', async () => {
    createInviteMutateAsyncMock.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { message: 'Already a member' } },
    });
    render(<MembersTab group={buildGroup([owner])} />);

    await userEvent.type(screen.getByLabelText('Email'), 'carol@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send invite' }));

    expect(await screen.findByText('Already a member')).toBeInTheDocument();
  });

  it('lists pending invites', () => {
    usePendingInvitesMock.mockReturnValue({
      data: [{ id: 'inv1', groupId: 'g1', email: 'dave@example.com', token: 't1', invitedById: 'u1', status: 'PENDING', expiresAt: '2026-12-31T00:00:00.000Z', createdAt: '' }],
    });
    render(<MembersTab group={buildGroup([owner])} />);
    expect(screen.getByText('dave@example.com')).toBeInTheDocument();
    expect(screen.getByText(/Pending · expires/)).toBeInTheDocument();
  });
});
