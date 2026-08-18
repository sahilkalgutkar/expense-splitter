import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddExpenseModal } from './AddExpenseModal';
import type { Group } from '../../types/api';

const mutateAsyncMock = vi.fn();
vi.mock('../../api/expenses', () => ({
  useCreateExpense: () => ({ mutateAsync: mutateAsyncMock }),
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

function renderModal(onClose = vi.fn()) {
  return { onClose, ...render(<AddExpenseModal group={group} open onClose={onClose} />) };
}

describe('AddExpenseModal', () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
  });

  it('renders nothing when closed', () => {
    const { container } = render(<AddExpenseModal group={group} open={false} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('defaults to an equal split and hides per-person value inputs', () => {
    renderModal();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    // "Alice"/"Bob" each appear twice: once in the "Paid by" <option>, once as a participant row.
    expect(screen.getAllByText('Alice')).toHaveLength(2);
    expect(screen.getAllByText('Bob')).toHaveLength(2);
    // No numeric split inputs shown for EQUAL.
    expect(screen.queryAllByPlaceholderText('$')).toHaveLength(0);
    expect(screen.queryAllByPlaceholderText('%')).toHaveLength(0);
  });

  it('shows per-person amount inputs and a sum hint when split type is Exact amounts', async () => {
    renderModal();
    await userEvent.selectOptions(screen.getByLabelText('Split type'), 'EXACT');
    expect(screen.getAllByPlaceholderText('$')).toHaveLength(2);
    expect(screen.getByText('Amounts must sum to the total.')).toBeInTheDocument();
  });

  it('shows per-person percentage inputs and a sum hint when split type is Percentage', async () => {
    renderModal();
    await userEvent.selectOptions(screen.getByLabelText('Split type'), 'PERCENTAGE');
    expect(screen.getAllByPlaceholderText('%')).toHaveLength(2);
    expect(screen.getByText('Percentages must sum to 100.')).toBeInTheDocument();
  });

  it('requires a description and a positive amount', async () => {
    renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'Add expense' }));

    expect(await screen.findByText('Description is required')).toBeInTheDocument();
    expect(screen.getByText('Amount must be greater than 0')).toBeInTheDocument();
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it('submits an equal split with only the checked participants, converting dollars to cents', async () => {
    const { onClose } = renderModal();
    mutateAsyncMock.mockResolvedValueOnce({ id: 'e1' });

    await userEvent.type(screen.getByLabelText('Description'), 'Dinner');
    await userEvent.type(screen.getByLabelText('Amount ($)'), '50');
    // Uncheck Bob so only Alice is a participant.
    const checkboxes = screen.getAllByRole('checkbox');
    await userEvent.click(checkboxes[1]);

    await userEvent.click(screen.getByRole('button', { name: 'Add expense' }));

    expect(mutateAsyncMock).toHaveBeenCalledWith({
      description: 'Dinner',
      amountCents: 5000,
      paidById: 'u1',
      splitType: 'EQUAL',
      participantUserIds: ['u1'],
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('submits an exact split converting each participant value to cents', async () => {
    renderModal();
    mutateAsyncMock.mockResolvedValueOnce({ id: 'e1' });

    await userEvent.type(screen.getByLabelText('Description'), 'Dinner');
    await userEvent.type(screen.getByLabelText('Amount ($)'), '30');
    await userEvent.selectOptions(screen.getByLabelText('Split type'), 'EXACT');

    const [aliceInput, bobInput] = screen.getAllByPlaceholderText('$');
    await userEvent.clear(aliceInput);
    await userEvent.type(aliceInput, '20');
    await userEvent.clear(bobInput);
    await userEvent.type(bobInput, '10');

    await userEvent.click(screen.getByRole('button', { name: 'Add expense' }));

    expect(mutateAsyncMock).toHaveBeenCalledWith({
      description: 'Dinner',
      amountCents: 3000,
      paidById: 'u1',
      splitType: 'EXACT',
      splits: [
        { userId: 'u1', value: 2000 },
        { userId: 'u2', value: 1000 },
      ],
    });
  });

  it('submits a percentage split leaving values as raw percentages (not converted to cents)', async () => {
    renderModal();
    mutateAsyncMock.mockResolvedValueOnce({ id: 'e1' });

    await userEvent.type(screen.getByLabelText('Description'), 'Dinner');
    await userEvent.type(screen.getByLabelText('Amount ($)'), '30');
    await userEvent.selectOptions(screen.getByLabelText('Split type'), 'PERCENTAGE');

    const [aliceInput, bobInput] = screen.getAllByPlaceholderText('%');
    await userEvent.clear(aliceInput);
    await userEvent.type(aliceInput, '60');
    await userEvent.clear(bobInput);
    await userEvent.type(bobInput, '40');

    await userEvent.click(screen.getByRole('button', { name: 'Add expense' }));

    expect(mutateAsyncMock).toHaveBeenCalledWith({
      description: 'Dinner',
      amountCents: 3000,
      paidById: 'u1',
      splitType: 'PERCENTAGE',
      splits: [
        { userId: 'u1', value: 60 },
        { userId: 'u2', value: 40 },
      ],
    });
  });

  it('shows the server error and keeps the modal open when submission fails', async () => {
    const { onClose } = renderModal();
    mutateAsyncMock.mockRejectedValueOnce({ isAxiosError: true, response: { data: { message: 'Group is full' } } });

    await userEvent.type(screen.getByLabelText('Description'), 'Dinner');
    await userEvent.type(screen.getByLabelText('Amount ($)'), '10');
    await userEvent.click(screen.getByRole('button', { name: 'Add expense' }));

    expect(await screen.findByText('Group is full')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
