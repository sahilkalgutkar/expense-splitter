import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
import { renderHookWithClient, waitFor } from './test-utils';
import { useCreateExpense, useDeleteExpense, useExpenses } from './expenses';

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

const INVALIDATED_KEYS = [
  ['groups', 'g1', 'expenses'],
  ['groups', 'g1', 'balances'],
  ['groups', 'g1', 'settle-up'],
];

describe('expenses api hooks', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
    vi.mocked(api.delete).mockReset();
  });

  it('useExpenses does not fetch without a groupId', () => {
    const { result } = renderHookWithClient(() => useExpenses(undefined));
    expect(result.current.fetchStatus).toBe('idle');
    expect(api.get).not.toHaveBeenCalled();
  });

  it('useExpenses fetches the group expenses', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [{ id: 'e1' }] } as any);

    const { result } = renderHookWithClient(() => useExpenses('g1'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith('/groups/g1/expenses');
  });

  it('useCreateExpense posts the input and invalidates expenses, balances, and settle-up', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: 'e1' } } as any);
    const { result, queryClient } = renderHookWithClient(() => useCreateExpense('g1'));
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const input = {
      description: 'Cabin',
      amountCents: 1000,
      paidById: 'u1',
      splitType: 'EQUAL' as const,
      participantUserIds: ['u1', 'u2'],
    };

    result.current.mutate(input);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.post).toHaveBeenCalledWith('/groups/g1/expenses', input);
    for (const queryKey of INVALIDATED_KEYS) {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey });
    }
  });

  it('useDeleteExpense deletes by id and invalidates expenses, balances, and settle-up', async () => {
    vi.mocked(api.delete).mockResolvedValue({} as any);
    const { result, queryClient } = renderHookWithClient(() => useDeleteExpense('g1'));
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    result.current.mutate('e1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.delete).toHaveBeenCalledWith('/expenses/e1');
    for (const queryKey of INVALIDATED_KEYS) {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey });
    }
  });
});
