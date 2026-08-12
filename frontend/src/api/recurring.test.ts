import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
import { renderHookWithClient, waitFor } from './test-utils';
import { useCreateRecurringExpense, useRecurringExpenses, useSetRecurringActive } from './recurring';

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

describe('recurring api hooks', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
    vi.mocked(api.patch).mockReset();
  });

  it('useRecurringExpenses does not fetch without a groupId', () => {
    const { result } = renderHookWithClient(() => useRecurringExpenses(undefined));
    expect(result.current.fetchStatus).toBe('idle');
    expect(api.get).not.toHaveBeenCalled();
  });

  it('useRecurringExpenses fetches the group recurring expenses', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [{ id: 'r1' }] } as any);

    const { result } = renderHookWithClient(() => useRecurringExpenses('g1'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith('/groups/g1/recurring');
  });

  it('useCreateRecurringExpense posts the input and invalidates the recurring list', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 'r1' } } as any);
    const { result, queryClient } = renderHookWithClient(() => useCreateRecurringExpense('g1'));
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const input = {
      description: 'Rent',
      amountCents: 20000,
      paidById: 'u1',
      splitType: 'EQUAL' as const,
      participantUserIds: ['u1', 'u2'],
      cadence: 'MONTHLY' as const,
    };

    result.current.mutate(input);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.post).toHaveBeenCalledWith('/groups/g1/recurring', input);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['groups', 'g1', 'recurring'] });
  });

  it('useSetRecurringActive patches the active flag and invalidates the recurring list', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { id: 'r1', active: false } } as any);
    const { result, queryClient } = renderHookWithClient(() => useSetRecurringActive('g1'));
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    result.current.mutate({ id: 'r1', active: false });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.patch).toHaveBeenCalledWith('/recurring/r1/active', { active: false });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['groups', 'g1', 'recurring'] });
  });
});
