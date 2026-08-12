import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
import { renderHookWithClient, waitFor } from './test-utils';
import { useCreateGroup, useGroup, useGroups, useRemoveMember } from './groups';

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

describe('groups api hooks', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
    vi.mocked(api.delete).mockReset();
  });

  it('useGroups fetches /groups', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [{ id: 'g1' }] } as any);

    const { result } = renderHookWithClient(() => useGroups());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith('/groups');
    expect(result.current.data).toEqual([{ id: 'g1' }]);
  });

  it('useGroup does not fetch when groupId is undefined', () => {
    const { result } = renderHookWithClient(() => useGroup(undefined));
    expect(result.current.fetchStatus).toBe('idle');
    expect(api.get).not.toHaveBeenCalled();
  });

  it('useGroup fetches /groups/:id when a groupId is given', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { id: 'g1' } } as any);

    const { result } = renderHookWithClient(() => useGroup('g1'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith('/groups/g1');
  });

  it('useCreateGroup posts the name and invalidates the groups list on success', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 'g2', name: 'Trip' } } as any);
    const { result, queryClient } = renderHookWithClient(() => useCreateGroup());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    result.current.mutate('Trip');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.post).toHaveBeenCalledWith('/groups', { name: 'Trip' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['groups'] });
  });

  it('useRemoveMember deletes the member and invalidates both the group and the groups list', async () => {
    vi.mocked(api.delete).mockResolvedValue({} as any);
    const { result, queryClient } = renderHookWithClient(() => useRemoveMember('g1'));
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    result.current.mutate('user-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.delete).toHaveBeenCalledWith('/groups/g1/members/user-1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['groups', 'g1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['groups'] });
  });
});
