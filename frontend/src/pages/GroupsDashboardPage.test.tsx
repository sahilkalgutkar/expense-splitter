import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GroupsDashboardPage } from './GroupsDashboardPage';

const useGroupsMock = vi.fn();
const mutateAsyncMock = vi.fn();
vi.mock('../api/groups', () => ({
  useGroups: () => useGroupsMock(),
  useCreateGroup: () => ({ mutateAsync: mutateAsyncMock }),
}));

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Alice', email: 'alice@example.com' } }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <GroupsDashboardPage />
    </MemoryRouter>,
  );
}

const group = (
  overrides: Partial<{ id: string; name: string; members: { id: string; userId: string; user: { name: string } }[] }> = {},
) => ({
  id: 'g1',
  name: 'Apartment 4B',
  members: [{ id: 'm1', userId: 'u1', user: { name: 'Alice' } }],
  ...overrides,
});

describe('GroupsDashboardPage', () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
  });

  it('shows a loading message while groups are loading', () => {
    useGroupsMock.mockReturnValue({ data: undefined, isLoading: true });
    renderPage();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows an empty state when the user has no groups', () => {
    useGroupsMock.mockReturnValue({ data: [], isLoading: false });
    renderPage();
    expect(screen.getByText("You're not in any groups yet. Create one to get started.")).toBeInTheDocument();
  });

  it('lists groups with member count and links to the group detail page', () => {
    useGroupsMock.mockReturnValue({
      data: [group({ members: [{ id: 'm1', userId: 'u1', user: { name: 'Alice' } }, { id: 'm2', userId: 'u2', user: { name: 'Bob' } }] })],
      isLoading: false,
    });
    renderPage();

    expect(screen.getByText('Apartment 4B')).toBeInTheDocument();
    expect(screen.getByText('2 members')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Apartment 4B/ })).toHaveAttribute('href', '/groups/g1');
  });

  it('uses singular "member" for a group with one member', () => {
    useGroupsMock.mockReturnValue({ data: [group()], isLoading: false });
    renderPage();
    expect(screen.getByText('1 member')).toBeInTheDocument();
  });

  it('shows the signed-in user email', () => {
    useGroupsMock.mockReturnValue({ data: [], isLoading: false });
    renderPage();
    expect(screen.getByText('Signed in as alice@example.com')).toBeInTheDocument();
  });

  it('validates the group name is required before submitting', async () => {
    useGroupsMock.mockReturnValue({ data: [], isLoading: false });
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'New group' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create group' }));

    expect(await screen.findByText('Group name is required')).toBeInTheDocument();
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it('creates a group and closes the modal on submit', async () => {
    useGroupsMock.mockReturnValue({ data: [], isLoading: false });
    mutateAsyncMock.mockResolvedValueOnce(group());
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'New group' }));
    await userEvent.type(screen.getByLabelText('Group name'), 'Road Trip');
    await userEvent.click(screen.getByRole('button', { name: 'Create group' }));

    expect(mutateAsyncMock).toHaveBeenCalledWith('Road Trip');
    // Modal closes -> its title is no longer in the document.
    expect(await screen.findByText('Your groups')).toBeInTheDocument();
    expect(screen.queryByLabelText('Group name')).not.toBeInTheDocument();
  });
});
