import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BalancesTab } from './BalancesTab';
import type { Group } from '../../types/api';

const useBalancesMock = vi.fn();
vi.mock('../../api/balances', () => ({
  useBalances: (groupId: string | undefined) => useBalancesMock(groupId),
}));

const group = { id: 'g1', name: 'Trip', createdById: 'u1', createdAt: '', members: [] } as unknown as Group;

describe('BalancesTab', () => {
  it('shows a loading message while balances are loading', () => {
    useBalancesMock.mockReturnValue({ data: undefined, isLoading: true });
    render(<BalancesTab group={group} />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(useBalancesMock).toHaveBeenCalledWith('g1');
  });

  it('shows "is owed" in green for a positive balance', () => {
    useBalancesMock.mockReturnValue({
      data: [{ userId: 'u1', name: 'Alice', email: 'alice@example.com', netCents: 2500 }],
      isLoading: false,
    });
    render(<BalancesTab group={group} />);
    const label = screen.getByText('is owed $25.00');
    expect(label).toBeInTheDocument();
    expect(label).toHaveClass('text-green-600');
  });

  it('shows "owes" in red for a negative balance, using the absolute value', () => {
    useBalancesMock.mockReturnValue({
      data: [{ userId: 'u2', name: 'Bob', email: 'bob@example.com', netCents: -1500 }],
      isLoading: false,
    });
    render(<BalancesTab group={group} />);
    const label = screen.getByText('owes $15.00');
    expect(label).toBeInTheDocument();
    expect(label).toHaveClass('text-red-600');
  });

  it('shows "Settled up" for a zero balance', () => {
    useBalancesMock.mockReturnValue({
      data: [{ userId: 'u3', name: 'Carol', email: 'carol@example.com', netCents: 0 }],
      isLoading: false,
    });
    render(<BalancesTab group={group} />);
    const label = screen.getByText('Settled up');
    expect(label).toBeInTheDocument();
    expect(label).toHaveClass('text-slate-400');
  });
});
