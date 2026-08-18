import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { GroupDetailPage } from './GroupDetailPage';

const useGroupMock = vi.fn();
vi.mock('../api/groups', () => ({
  useGroup: (groupId: string | undefined) => useGroupMock(groupId),
}));

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: null, logout: vi.fn(), login: vi.fn(), register: vi.fn(), isLoading: false }),
}));

vi.mock('./group/ExpensesTab', () => ({ ExpensesTab: () => <div>expenses-tab</div> }));
vi.mock('./group/BalancesTab', () => ({ BalancesTab: () => <div>balances-tab</div> }));
vi.mock('./group/SettleUpTab', () => ({ SettleUpTab: () => <div>settle-up-tab</div> }));
vi.mock('./group/MembersTab', () => ({ MembersTab: () => <div>members-tab</div> }));
vi.mock('./group/RecurringTab', () => ({ RecurringTab: () => <div>recurring-tab</div> }));

function renderPage(groupId = 'g1') {
  return render(
    <MemoryRouter initialEntries={[`/groups/${groupId}`]}>
      <Routes>
        <Route path="/groups/:groupId" element={<GroupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('GroupDetailPage', () => {
  it('shows a loading state while the group is loading', () => {
    useGroupMock.mockReturnValue({ data: undefined, isLoading: true });
    renderPage();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(useGroupMock).toHaveBeenCalledWith('g1');
  });

  it('renders the group name, member count, and defaults to the Expenses tab', () => {
    useGroupMock.mockReturnValue({
      data: { id: 'g1', name: 'Apartment 4B', members: [{ id: 'm1' }, { id: 'm2' }] },
      isLoading: false,
    });
    renderPage();

    expect(screen.getByText('Apartment 4B')).toBeInTheDocument();
    expect(screen.getByText('2 members')).toBeInTheDocument();
    expect(screen.getByText('expenses-tab')).toBeInTheDocument();
    expect(screen.queryByText('balances-tab')).not.toBeInTheDocument();
  });

  it('switches tabs when a tab button is clicked', async () => {
    useGroupMock.mockReturnValue({
      data: { id: 'g1', name: 'Apartment 4B', members: [{ id: 'm1' }] },
      isLoading: false,
    });
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Balances' }));
    expect(screen.getByText('balances-tab')).toBeInTheDocument();
    expect(screen.queryByText('expenses-tab')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Settle Up' }));
    expect(screen.getByText('settle-up-tab')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Recurring' }));
    expect(screen.getByText('recurring-tab')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Members' }));
    expect(screen.getByText('members-tab')).toBeInTheDocument();
  });
});
