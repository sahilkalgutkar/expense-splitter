export interface SettlementSuggestion {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
}

interface HeapEntry {
  userId: string;
  amount: number;
}

/** Simple binary max-heap keyed on `amount`, used to repeatedly pull the largest creditor/debtor in O(log n). */
class MaxHeap {
  private items: HeapEntry[] = [];

  size(): number {
    return this.items.length;
  }

  push(entry: HeapEntry): void {
    this.items.push(entry);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent].amount >= this.items[i].amount) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
  }

  pop(): HeapEntry | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop() as HeapEntry;
    if (this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const left = 2 * i + 1;
        const right = 2 * i + 2;
        let largest = i;
        if (left < this.items.length && this.items[left].amount > this.items[largest].amount) largest = left;
        if (right < this.items.length && this.items[right].amount > this.items[largest].amount) largest = right;
        if (largest === i) break;
        [this.items[i], this.items[largest]] = [this.items[largest], this.items[i]];
        i = largest;
      }
    }
    return top;
  }
}

/**
 * Minimum cash-flow settle-up: given each member's net balance (positive = owed money,
 * negative = owes money), greedily matches the largest creditor with the largest debtor and
 * transfers the smaller of the two amounts, repeating until every balance is zeroed out.
 *
 * This is the same greedy graph-reduction heuristic Splitwise itself uses. It is not guaranteed
 * to produce the mathematically minimal number of transactions in every case (that variant of the
 * problem is NP-hard), but it always produces a valid, small settlement plan in O(n log n).
 */
export function computeSettlement(balances: Map<string, number>): SettlementSuggestion[] {
  const creditors = new MaxHeap();
  const debtors = new MaxHeap();

  for (const [userId, net] of balances) {
    if (net > 0) creditors.push({ userId, amount: net });
    else if (net < 0) debtors.push({ userId, amount: -net });
  }

  const result: SettlementSuggestion[] = [];

  while (creditors.size() > 0 && debtors.size() > 0) {
    const creditor = creditors.pop() as HeapEntry;
    const debtor = debtors.pop() as HeapEntry;
    const amount = Math.min(creditor.amount, debtor.amount);

    if (amount > 0) {
      result.push({ fromUserId: debtor.userId, toUserId: creditor.userId, amountCents: amount });
    }

    const creditorRemaining = creditor.amount - amount;
    const debtorRemaining = debtor.amount - amount;
    if (creditorRemaining > 0) creditors.push({ userId: creditor.userId, amount: creditorRemaining });
    if (debtorRemaining > 0) debtors.push({ userId: debtor.userId, amount: debtorRemaining });
  }

  return result;
}
