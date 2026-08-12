import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useGroup } from '../api/groups';
import { ExpensesTab } from './group/ExpensesTab';
import { BalancesTab } from './group/BalancesTab';
import { SettleUpTab } from './group/SettleUpTab';
import { MembersTab } from './group/MembersTab';
import { RecurringTab } from './group/RecurringTab';

const TABS = ['Expenses', 'Balances', 'Settle Up', 'Recurring', 'Members'] as const;
type Tab = (typeof TABS)[number];

export function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { data: group, isLoading } = useGroup(groupId);
  const [tab, setTab] = useState<Tab>('Expenses');

  if (isLoading || !group || !groupId) {
    return (
      <Layout>
        <p className="text-slate-500">Loading…</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">{group.name}</h1>
      <p className="mb-6 text-sm text-slate-500">{group.members.length} members</p>

      <div className="mb-6 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Expenses' && <ExpensesTab group={group} />}
      {tab === 'Balances' && <BalancesTab group={group} />}
      {tab === 'Settle Up' && <SettleUpTab group={group} />}
      {tab === 'Recurring' && <RecurringTab group={group} />}
      {tab === 'Members' && <MembersTab group={group} />}
    </Layout>
  );
}
