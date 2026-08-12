import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
import { renderHookWithClient, waitFor } from './test-utils';
import { useRecordSettlement, useSettlements } from './settlements';

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

describe('settlements api hooks', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
  });

  it('useSettlements does not fetch without a groupId', () => {
    const { result } = renderHookWithClient(() => useSettlements(undefined));
    expect(result.current.fetchStatus).toBe('idle');
    expect(api.get).not.toHaveBeenCalled();
  });

  it('useSettlements fetches the group settlement history', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [{ id: 's1' }] } as any);

    const { result } = renderHookWithClient(() => useSettlements('g1'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith('/groups/g1/settlements');
  });

  it('useRecordSettlement posts the input and invalidates the whole group (balances included)', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 's1' } } as any);
    const { result, queryClient } = renderHookWithClient(() => useRecordSettlement('g1'));
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const input = { fromUserId: 'u2', toUserId: 'u1', amountCents: 500 };

    result.current.mutate(input);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.post).toHaveBeenCalledWith('/groups/g1/settlements', input);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['groups', 'g1'] });
  });
});
