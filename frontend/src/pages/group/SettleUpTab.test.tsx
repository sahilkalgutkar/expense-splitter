import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettleUpTab } from './SettleUpTab';
import type { Group } from '../../types/api';

const useSettleUpSuggestionsMock = vi.fn();
const useSettlementsMock = vi.fn();
const recordSettlementMutateMock = vi.fn();
vi.mock('../../api/balances', () => ({
  useSettleUpSuggestions: (groupId: string | undefined) => useSettleUpSuggestionsMock(groupId),
}));
vi.mock('../../api/settlements', () => ({
  useSettlements: (groupId: string | undefined) => useSettlementsMock(groupId),
  useRecordSettlement: () => ({ mutate: recordSettlementMutateMock, isPending: false }),
}));

const group: Group = { id: 'g1', name: 'Trip', createdById: 'u1', createdAt: '', members: [] };

const alice = { id: 'u1', name: 'Alice', email: 'a@example.com', createdAt: '' };
const bob = { id: 'u2', name: 'Bob', email: 'b@example.com', createdAt: '' };

describe('SettleUpTab', () => {
  beforeEach(() => {
    useSettleUpSuggestionsMock.mockReset();
    useSettlementsMock.mockReset().mockReturnValue({ data: [] });
    recordSettlementMutateMock.mockReset();
  });

  it('shows a loading message while suggestions load', () => {
    useSettleUpSuggestionsMock.mockReturnValue({ data: undefined, isLoading: true });
    render(<SettleUpTab group={group} />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows a celebratory empty state when everyone is settled up', () => {
    useSettleUpSuggestionsMock.mockReturnValue({ data: [], isLoading: false });
    render(<SettleUpTab group={group} />);
    expect(screen.getByText('Everyone is settled up. 🎉')).toBeInTheDocument();
  });

  it('renders a suggested payment and records it when marked as paid', async () => {
    useSettleUpSuggestionsMock.mockReturnValue({
      data: [{ fromUserId: 'u2', toUserId: 'u1', amountCents: 1000, fromUser: bob, toUser: alice }],
      isLoading: false,
    });
    render(<SettleUpTab group={group} />);

    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('$10.00')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Mark as paid' }));
    expect(recordSettlementMutateMock).toHaveBeenCalledWith({
      fromUserId: 'u2',
      toUserId: 'u1',
      amountCents: 1000,
      note: 'Settled via suggestion',
    });
  });

  it('shows "No settlements recorded yet" when there is no history', () => {
    useSettleUpSuggestionsMock.mockReturnValue({ data: [], isLoading: false });
    useSettlementsMock.mockReturnValue({ data: [] });
    render(<SettleUpTab group={group} />);
    expect(screen.getByText('No settlements recorded yet.')).toBeInTheDocument();
  });

  it('renders settlement history with an optional note', () => {
    useSettleUpSuggestionsMock.mockReturnValue({ data: [], isLoading: false });
    useSettlementsMock.mockReturnValue({
      data: [
        {
          id: 's1',
          groupId: 'g1',
          fromUserId: 'u2',
          fromUser: bob,
          toUserId: 'u1',
          toUser: alice,
          amountCents: 500,
          note: 'Coffee run',
          settledAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    render(<SettleUpTab group={group} />);

    expect(screen.getByText(/Bob → Alice/)).toBeInTheDocument();
    expect(screen.getByText(/Coffee run/)).toBeInTheDocument();
    expect(screen.getByText('$5.00')).toBeInTheDocument();
  });
});
