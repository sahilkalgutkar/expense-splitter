import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Settlement } from '../types/api';

export interface CreateSettlementInput {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
  note?: string;
}

export function useSettlements(groupId: string | undefined) {
  return useQuery({
    queryKey: ['groups', groupId, 'settlements'],
    queryFn: async () => (await api.get<Settlement[]>(`/groups/${groupId}/settlements`)).data,
    enabled: !!groupId,
  });
}

export function useRecordSettlement(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSettlementInput) =>
      (await api.post<Settlement>(`/groups/${groupId}/settlements`, input)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] });
    },
  });
}
