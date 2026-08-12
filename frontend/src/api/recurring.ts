import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Cadence, RecurringExpense, SplitType } from '../types/api';

export interface RecurringExpenseInput {
  description: string;
  amountCents: number;
  paidById: string;
  splitType: SplitType;
  participantUserIds?: string[];
  splits?: { userId: string; value: number }[];
  cadence: Cadence;
  startDate?: string;
}

export function useRecurringExpenses(groupId: string | undefined) {
  return useQuery({
    queryKey: ['groups', groupId, 'recurring'],
    queryFn: async () => (await api.get<RecurringExpense[]>(`/groups/${groupId}/recurring`)).data,
    enabled: !!groupId,
  });
}

export function useCreateRecurringExpense(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RecurringExpenseInput) =>
      (await api.post<RecurringExpense>(`/groups/${groupId}/recurring`, input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'recurring'] }),
  });
}

export function useSetRecurringActive(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) =>
      (await api.patch<RecurringExpense>(`/recurring/${id}/active`, { active })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'recurring'] }),
  });
}
