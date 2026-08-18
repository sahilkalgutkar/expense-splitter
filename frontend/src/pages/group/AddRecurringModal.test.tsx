import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddRecurringModal } from './AddRecurringModal';
import type { Group } from '../../types/api';

const mutateAsyncMock = vi.fn();
vi.mock('../../api/recurring', () => ({
  useCreateRecurringExpense: () => ({ mutateAsync: mutateAsyncMock }),
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
  return { onClose, ...render(<AddRecurringModal group={group} open onClose={onClose} />) };
}

describe('AddRecurringModal', () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
  });

  it('renders nothing when closed', () => {
    const { container } = render(<AddRecurringModal group={group} open={false} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('defaults to Monthly cadence and an equal split with no per-person inputs', () => {
    renderModal();
    expect(screen.getByLabelText('Repeats')).toHaveValue('MONTHLY');
    expect(screen.queryAllByPlaceholderText('$')).toHaveLength(0);
  });

  it('requires a description and a positive amount', async () => {
    renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'Add recurring bill' }));

    expect(await screen.findByText('Description is required')).toBeInTheDocument();
    expect(screen.getByText('Amount must be greater than 0')).toBeInTheDocument();
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it('submits an equal-split weekly recurring bill with checked participants and cents conversion', async () => {
    const { onClose } = renderModal();
    mutateAsyncMock.mockResolvedValueOnce({ id: 'r1' });

    await userEvent.type(screen.getByLabelText('Description'), 'Rent');
    await userEvent.type(screen.getByLabelText('Amount ($)'), '1500');
    await userEvent.selectOptions(screen.getByLabelText('Repeats'), 'WEEKLY');
    // Uncheck Bob.
    const checkboxes = screen.getAllByRole('checkbox');
    await userEvent.click(checkboxes[1]);

    await userEvent.click(screen.getByRole('button', { name: 'Add recurring bill' }));

    expect(mutateAsyncMock).toHaveBeenCalledWith({
      description: 'Rent',
      amountCents: 150000,
      paidById: 'u1',
      splitType: 'EQUAL',
      cadence: 'WEEKLY',
      participantUserIds: ['u1'],
      splits: undefined,
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('submits an exact split with splits array (no participantUserIds) and cents-converted values', async () => {
    renderModal();
    mutateAsyncMock.mockResolvedValueOnce({ id: 'r1' });

    await userEvent.type(screen.getByLabelText('Description'), 'Utilities');
    await userEvent.type(screen.getByLabelText('Amount ($)'), '90');
    await userEvent.selectOptions(screen.getByLabelText('Split type'), 'EXACT');

    const [aliceInput, bobInput] = screen.getAllByPlaceholderText('$');
    await userEvent.clear(aliceInput);
    await userEvent.type(aliceInput, '50');
    await userEvent.clear(bobInput);
    await userEvent.type(bobInput, '40');

    await userEvent.click(screen.getByRole('button', { name: 'Add recurring bill' }));

    expect(mutateAsyncMock).toHaveBeenCalledWith({
      description: 'Utilities',
      amountCents: 9000,
      paidById: 'u1',
      splitType: 'EXACT',
      cadence: 'MONTHLY',
      participantUserIds: undefined,
      splits: [
        { userId: 'u1', value: 5000 },
        { userId: 'u2', value: 4000 },
      ],
    });
  });

  it('shows the server error and keeps the modal open when submission fails', async () => {
    const { onClose } = renderModal();
    mutateAsyncMock.mockRejectedValueOnce(new Error('network down'));

    await userEvent.type(screen.getByLabelText('Description'), 'Rent');
    await userEvent.type(screen.getByLabelText('Amount ($)'), '10');
    await userEvent.click(screen.getByRole('button', { name: 'Add recurring bill' }));

    expect(await screen.findByText('Could not create recurring bill')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
