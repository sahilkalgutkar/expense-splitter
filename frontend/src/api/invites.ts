import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Group, Invite } from '../types/api';

export function usePendingInvites(groupId: string | undefined) {
  return useQuery({
    queryKey: ['groups', groupId, 'invites'],
    queryFn: async () => (await api.get<Invite[]>(`/groups/${groupId}/invites`)).data,
    enabled: !!groupId,
  });
}

export function useCreateInvite(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) => (await api.post<Invite>(`/groups/${groupId}/invites`, { email })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'invites'] }),
  });
}

export function useAcceptInvite() {
  return useMutation({
    mutationFn: async (token: string) => (await api.post<Group>(`/invites/${token}/accept`)).data,
  });
}
