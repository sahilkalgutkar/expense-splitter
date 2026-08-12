import { useSettleUpSuggestions } from '../../api/balances';
import { useSettlements, useRecordSettlement } from '../../api/settlements';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { formatCents } from '../../lib/money';
import type { Group } from '../../types/api';

export function SettleUpTab({ group }: { group: Group }) {
  const { data: suggestions, isLoading } = useSettleUpSuggestions(group.id);
  const { data: history } = useSettlements(group.id);
  const recordSettlement = useRecordSettlement(group.id);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Suggested payments</h2>
        {isLoading && <p className="text-slate-500">Loading…</p>}
        {!isLoading && suggestions?.length === 0 && (
          <Card>
            <p className="text-slate-500">Everyone is settled up. 🎉</p>
          </Card>
        )}
        <div className="flex flex-col gap-3">
          {suggestions?.map((s, i) => (
            <Card key={i}>
              <div className="flex items-center justify-between">
                <p className="text-slate-900">
                  <span className="font-medium">{s.fromUser?.name}</span> pays{' '}
                  <span className="font-medium">{s.toUser?.name}</span>
                </p>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-900">{formatCents(s.amountCents)}</span>
                  <Button
                    variant="secondary"
                    isLoading={recordSettlement.isPending}
                    onClick={() =>
                      recordSettlement.mutate({
                        fromUserId: s.fromUserId,
                        toUserId: s.toUserId,
                        amountCents: s.amountCents,
                        note: 'Settled via suggestion',
                      })
                    }
                  >
                    Mark as paid
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Settlement history</h2>
        {history?.length === 0 && <p className="text-sm text-slate-400">No settlements recorded yet.</p>}
        <div className="flex flex-col gap-2">
          {history?.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm">
              <span>
                {s.fromUser.name} → {s.toUser.name}
                {s.note && <span className="text-slate-400"> · {s.note}</span>}
              </span>
              <span className="flex items-center gap-3 text-slate-500">
                {formatCents(s.amountCents)}
                <span className="text-xs">{new Date(s.settledAt).toLocaleDateString()}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
