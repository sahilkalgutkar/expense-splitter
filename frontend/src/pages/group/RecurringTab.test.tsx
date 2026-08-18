import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecurringTab } from './RecurringTab';
import type { Group } from '../../types/api';

const useRecurringExpensesMock = vi.fn();
const setActiveMutateMock = vi.fn();
const createMutateAsyncMock = vi.fn();
vi.mock('../../api/recurring', () => ({
  useRecurringExpenses: (groupId: string | undefined) => useRecurringExpensesMock(groupId),
  useSetRecurringActive: () => ({ mutate: setActiveMutateMock }),
  useCreateRecurringExpense: () => ({ mutateAsync: createMutateAsyncMock }),
}));

const group: Group = {
  id: 'g1',
  name: 'Trip',
  createdById: 'u1',
  createdAt: '',
  members: [{ id: 'm1', groupId: 'g1', userId: 'u1', role: 'OWNER', joinedAt: '', user: { id: 'u1', name: 'Alice', email: 'a@example.com', createdAt: '' } }],
};

const recurring = (overrides: Record<string, unknown> = {}) => ({
  id: 'r1',
  groupId: 'g1',
  description: 'Rent',
  amountCents: 150000,
  paidById: 'u1',
  splitType: 'EQUAL',
  splitConfig: {},
  cadence: 'MONTHLY',
  nextRunAt: '2026-09-01T00:00:00.000Z',
  active: true,
  createdById: 'u1',
  createdAt: '',
  ...overrides,
});

describe('RecurringTab', () => {
  beforeEach(() => {
    useRecurringExpensesMock.mockReset();
    setActiveMutateMock.mockReset();
    createMutateAsyncMock.mockReset();
  });

  it('shows a loading message while recurring bills load', () => {
    useRecurringExpensesMock.mockReturnValue({ data: undefined, isLoading: true });
    render(<RecurringTab group={group} />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows an empty state with no recurring bills', () => {
    useRecurringExpensesMock.mockReturnValue({ data: [], isLoading: false });
    render(<RecurringTab group={group} />);
    expect(screen.getByText('No recurring bills set up yet.')).toBeInTheDocument();
  });

  it('renders a monthly recurring bill with its amount and next run date', () => {
    useRecurringExpensesMock.mockReturnValue({ data: [recurring()], isLoading: false });
    render(<RecurringTab group={group} />);
    expect(screen.getByText('Rent')).toBeInTheDocument();
    expect(screen.getByText('$1,500.00')).toBeInTheDocument();
    expect(screen.getByText(/Monthly · next on/)).toBeInTheDocument();
  });

  it('renders "Weekly" for a weekly cadence', () => {
    useRecurringExpensesMock.mockReturnValue({ data: [recurring({ cadence: 'WEEKLY' })], isLoading: false });
    render(<RecurringTab group={group} />);
    expect(screen.getByText(/Weekly · next on/)).toBeInTheDocument();
  });

  it('pauses an active bill and toggles the button label', async () => {
    useRecurringExpensesMock.mockReturnValue({ data: [recurring({ active: true })], isLoading: false });
    render(<RecurringTab group={group} />);

    const pauseButton = screen.getByRole('button', { name: 'Pause' });
    await userEvent.click(pauseButton);
    expect(setActiveMutateMock).toHaveBeenCalledWith({ id: 'r1', active: false });
  });

  it('shows "Resume" for a paused bill', async () => {
    useRecurringExpensesMock.mockReturnValue({ data: [recurring({ active: false })], isLoading: false });
    render(<RecurringTab group={group} />);

    const resumeButton = screen.getByRole('button', { name: 'Resume' });
    await userEvent.click(resumeButton);
    expect(setActiveMutateMock).toHaveBeenCalledWith({ id: 'r1', active: true });
  });

  it('opens the add recurring bill modal', async () => {
    useRecurringExpensesMock.mockReturnValue({ data: [], isLoading: false });
    render(<RecurringTab group={group} />);

    expect(screen.queryByText('Add recurring bill', { selector: 'h2' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add recurring bill' }));
    expect(screen.getByText('Add recurring bill', { selector: 'h2' })).toBeInTheDocument();
  });
});
