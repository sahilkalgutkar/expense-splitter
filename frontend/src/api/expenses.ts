import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Expense, SplitType } from '../types/api';

export interface ExpenseInput {
  description: string;
  amountCents: number;
  currency?: string;
  category?: string;
  date?: string;
  paidById: string;
  splitType: SplitType;
  participantUserIds?: string[];
  splits?: { userId: string; value: number }[];
}

export function useExpenses(groupId: string | undefined) {
  return useQuery({
    queryKey: ['groups', groupId, 'expenses'],
    queryFn: async () => (await api.get<Expense[]>(`/groups/${groupId}/expenses`)).data,
    enabled: !!groupId,
  });
}

function useInvalidateGroupData(groupId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'expenses'] });
    queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'balances'] });
    queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'settle-up'] });
  };
}

export function useCreateExpense(groupId: string) {
  const invalidate = useInvalidateGroupData(groupId);
  return useMutation({
    mutationFn: async (input: ExpenseInput) =>
      (await api.post<Expense>(`/groups/${groupId}/expenses`, input)).data,
    onSuccess: invalidate,
  });
}

export function useDeleteExpense(groupId: string) {
  const invalidate = useInvalidateGroupData(groupId);
  return useMutation({
    mutationFn: async (expenseId: string) => {
      await api.delete(`/expenses/${expenseId}`);
    },
    onSuccess: invalidate,
  });
}
