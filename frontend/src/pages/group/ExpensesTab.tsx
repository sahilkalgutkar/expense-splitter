import { useState } from 'react';
import { useExpenses, useDeleteExpense } from '../../api/expenses';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { formatCents } from '../../lib/money';
import { useAuth } from '../../auth/AuthContext';
import { AddExpenseModal } from './AddExpenseModal';
import type { Group } from '../../types/api';

export function ExpensesTab({ group }: { group: Group }) {
  const { user } = useAuth();
  const { data: expenses, isLoading } = useExpenses(group.id);
  const deleteExpense = useDeleteExpense(group.id);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setModalOpen(true)}>Add expense</Button>
      </div>

      {isLoading && <p className="text-slate-500">Loading…</p>}
      {!isLoading && expenses?.length === 0 && (
        <Card>
          <p className="text-slate-500">No expenses yet. Add the first one.</p>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {expenses?.map((expense) => (
          <Card key={expense.id}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-slate-900">{expense.description}</p>
                <p className="text-sm text-slate-500">
                  Paid by {expense.paidBy.name} · {new Date(expense.date).toLocaleDateString()}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {expense.splits.map((s) => `${s.user.name}: ${formatCents(s.shareCents, expense.currency)}`).join(' · ')}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-900">{formatCents(expense.amountCents, expense.currency)}</span>
                {(expense.createdById === user?.id || group.members.find((m) => m.userId === user?.id)?.role === 'OWNER') && (
                  <button
                    onClick={() => deleteExpense.mutate(expense.id)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <AddExpenseModal group={group} open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
