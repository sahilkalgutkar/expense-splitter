import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
import { renderHookWithClient, waitFor } from './test-utils';
import { useAcceptInvite, useCreateInvite, usePendingInvites } from './invites';

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

describe('invites api hooks', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
  });

  it('usePendingInvites does not fetch without a groupId', () => {
    const { result } = renderHookWithClient(() => usePendingInvites(undefined));
    expect(result.current.fetchStatus).toBe('idle');
    expect(api.get).not.toHaveBeenCalled();
  });

  it('usePendingInvites fetches pending invites for the group', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [{ id: 'inv1' }] } as any);

    const { result } = renderHookWithClient(() => usePendingInvites('g1'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith('/groups/g1/invites');
  });

  it('useCreateInvite posts the email and invalidates the pending invites list', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 'inv1' } } as any);
    const { result, queryClient } = renderHookWithClient(() => useCreateInvite('g1'));
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    result.current.mutate('dave@example.com');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.post).toHaveBeenCalledWith('/groups/g1/invites', { email: 'dave@example.com' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['groups', 'g1', 'invites'] });
  });

  it('useAcceptInvite posts the token to the accept endpoint', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 'g1' } } as any);
    const { result } = renderHookWithClient(() => useAcceptInvite());

    result.current.mutate('invite-token-abc');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.post).toHaveBeenCalledWith('/invites/invite-token-abc/accept');
  });
});
