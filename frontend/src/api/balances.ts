import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { MemberBalance, SettleUpSuggestion } from '../types/api';

export function useBalances(groupId: string | undefined) {
  return useQuery({
    queryKey: ['groups', groupId, 'balances'],
    queryFn: async () => (await api.get<MemberBalance[]>(`/groups/${groupId}/balances`)).data,
    enabled: !!groupId,
  });
}

export function useSettleUpSuggestions(groupId: string | undefined) {
  return useQuery({
    queryKey: ['groups', groupId, 'settle-up'],
    queryFn: async () => (await api.get<SettleUpSuggestion[]>(`/groups/${groupId}/settle-up`)).data,
    enabled: !!groupId,
  });
}
