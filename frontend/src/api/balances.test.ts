import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
import { renderHookWithClient, waitFor } from './test-utils';
import { useBalances, useSettleUpSuggestions } from './balances';

vi.mock('../lib/api', () => ({
  api: { get: vi.fn() },
}));

describe('balances api hooks', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
  });

  it('useBalances does not fetch without a groupId', () => {
    const { result } = renderHookWithClient(() => useBalances(undefined));
    expect(result.current.fetchStatus).toBe('idle');
    expect(api.get).not.toHaveBeenCalled();
  });

  it('useBalances fetches group balances', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [{ userId: 'u1', netCents: 500 }] } as any);

    const { result } = renderHookWithClient(() => useBalances('g1'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith('/groups/g1/balances');
    expect(result.current.data).toEqual([{ userId: 'u1', netCents: 500 }]);
  });

  it('useSettleUpSuggestions does not fetch without a groupId', () => {
    const { result } = renderHookWithClient(() => useSettleUpSuggestions(undefined));
    expect(result.current.fetchStatus).toBe('idle');
    expect(api.get).not.toHaveBeenCalled();
  });

  it('useSettleUpSuggestions fetches suggested settlements', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [{ fromUserId: 'u2', toUserId: 'u1', amountCents: 500 }] } as any);

    const { result } = renderHookWithClient(() => useSettleUpSuggestions('g1'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith('/groups/g1/settle-up');
  });
});
