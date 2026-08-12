import { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { formatCents } from '../../lib/money';
import { useRecurringExpenses, useSetRecurringActive } from '../../api/recurring';
import { AddRecurringModal } from './AddRecurringModal';
import type { Group } from '../../types/api';

export function RecurringTab({ group }: { group: Group }) {
  const { data: recurring, isLoading } = useRecurringExpenses(group.id);
  const setActive = useSetRecurringActive(group.id);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setModalOpen(true)}>Add recurring bill</Button>
      </div>

      {isLoading && <p className="text-slate-500">Loading…</p>}
      {!isLoading && recurring?.length === 0 && (
        <Card>
          <p className="text-slate-500">No recurring bills set up yet.</p>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {recurring?.map((r) => (
          <Card key={r.id}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">{r.description}</p>
                <p className="text-sm text-slate-500">
                  {r.cadence === 'WEEKLY' ? 'Weekly' : 'Monthly'} · next on {new Date(r.nextRunAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-900">{formatCents(r.amountCents)}</span>
                <button
                  onClick={() => setActive.mutate({ id: r.id, active: !r.active })}
                  className={`text-xs hover:underline ${r.active ? 'text-slate-500' : 'text-indigo-600'}`}
                >
                  {r.active ? 'Pause' : 'Resume'}
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <AddRecurringModal group={group} open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
