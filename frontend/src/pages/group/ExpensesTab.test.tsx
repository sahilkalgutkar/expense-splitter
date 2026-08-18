import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExpensesTab } from './ExpensesTab';
import type { Group } from '../../types/api';

const useExpensesMock = vi.fn();
const deleteMutateMock = vi.fn();
const createMutateAsyncMock = vi.fn();
vi.mock('../../api/expenses', () => ({
  useExpenses: (groupId: string | undefined) => useExpensesMock(groupId),
  useDeleteExpense: () => ({ mutate: deleteMutateMock }),
  useCreateExpense: () => ({ mutateAsync: createMutateAsyncMock }),
}));

let authUser: { id: string } | null = { id: 'u1' };
vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: authUser }),
}));

const group: Group = {
  id: 'g1',
  name: 'Trip',
  createdById: 'u1',
  createdAt: '',
  members: [
    { id: 'm1', groupId: 'g1', userId: 'u1', role: 'OWNER', joinedAt: '', user: { id: 'u1', name: 'Alice', email: 'a@example.com', createdAt: '' } },
    { id: 'm2', groupId: 'g1', userId: 'u2', role: 'MEMBER', joinedAt: '', user: { id: 'u2', name: 'Bob', email: 'b@example.com', createdAt: '' } },
  ],
};

const expense = (overrides: Record<string, unknown> = {}) => ({
  id: 'e1',
  groupId: 'g1',
  paidById: 'u1',
  paidBy: { id: 'u1', name: 'Alice', email: 'a@example.com', createdAt: '' },
  description: 'Groceries',
  amountCents: 4000,
  currency: 'USD',
  category: null,
  date: '2026-01-01T00:00:00.000Z',
  createdById: 'u1',
  createdBy: { id: 'u1', name: 'Alice', email: 'a@example.com', createdAt: '' },
  recurringExpenseId: null,
  createdAt: '',
  splits: [
    { id: 's1', expenseId: 'e1', userId: 'u1', shareCents: 2000, user: { id: 'u1', name: 'Alice', email: 'a@example.com', createdAt: '' } },
    { id: 's2', expenseId: 'e1', userId: 'u2', shareCents: 2000, user: { id: 'u2', name: 'Bob', email: 'b@example.com', createdAt: '' } },
  ],
  ...overrides,
});

describe('ExpensesTab', () => {
  beforeEach(() => {
    authUser = { id: 'u1' };
    useExpensesMock.mockReset();
    deleteMutateMock.mockReset();
    createMutateAsyncMock.mockReset();
  });

  it('shows a loading message while expenses load', () => {
    useExpensesMock.mockReturnValue({ data: undefined, isLoading: true });
    render(<ExpensesTab group={group} />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows an empty state with no expenses', () => {
    useExpensesMock.mockReturnValue({ data: [], isLoading: false });
    render(<ExpensesTab group={group} />);
    expect(screen.getByText('No expenses yet. Add the first one.')).toBeInTheDocument();
  });

  it('renders an expense with its payer, amount, and per-person split', () => {
    useExpensesMock.mockReturnValue({ data: [expense()], isLoading: false });
    render(<ExpensesTab group={group} />);

    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.getByText(/Paid by Alice/)).toBeInTheDocument();
    expect(screen.getByText('$40.00')).toBeInTheDocument();
    expect(screen.getByText('Alice: $20.00 · Bob: $20.00')).toBeInTheDocument();
  });

  it('shows a delete link and deletes when the expense creator clicks it', async () => {
    authUser = { id: 'u1' };
    useExpensesMock.mockReturnValue({ data: [expense({ createdById: 'u1' })], isLoading: false });
    render(<ExpensesTab group={group} />);

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(deleteMutateMock).toHaveBeenCalledWith('e1');
  });

  it('shows a delete link for a group owner even if they did not create the expense', () => {
    authUser = { id: 'u1' }; // u1 is OWNER per group fixture
    useExpensesMock.mockReturnValue({ data: [expense({ createdById: 'u2' })], isLoading: false });
    render(<ExpensesTab group={group} />);
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('hides the delete link for a non-owner who did not create the expense', () => {
    authUser = { id: 'u2' }; // u2 is a plain MEMBER
    useExpensesMock.mockReturnValue({ data: [expense({ createdById: 'u1' })], isLoading: false });
    render(<ExpensesTab group={group} />);
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('opens the add expense modal when "Add expense" is clicked', async () => {
    authUser = { id: 'u1' };
    useExpensesMock.mockReturnValue({ data: [], isLoading: false });
    render(<ExpensesTab group={group} />);

    expect(screen.queryByText('Add expense', { selector: 'h2' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add expense' }));
    expect(screen.getByText('Add expense', { selector: 'h2' })).toBeInTheDocument();
  });
});
