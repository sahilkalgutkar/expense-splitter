import { useBalances } from '../../api/balances';
import { Card } from '../../components/ui/Card';
import { formatCents } from '../../lib/money';
import type { Group } from '../../types/api';

export function BalancesTab({ group }: { group: Group }) {
  const { data: balances, isLoading } = useBalances(group.id);

  if (isLoading) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="flex flex-col gap-3">
      {balances?.map((b) => (
        <Card key={b.userId}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">{b.name}</p>
              <p className="text-xs text-slate-500">{b.email}</p>
            </div>
            <span
              className={`font-semibold ${b.netCents > 0 ? 'text-green-600' : b.netCents < 0 ? 'text-red-600' : 'text-slate-400'}`}
            >
              {b.netCents === 0
                ? 'Settled up'
                : b.netCents > 0
                  ? `is owed ${formatCents(b.netCents)}`
                  : `owes ${formatCents(Math.abs(b.netCents))}`}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}
