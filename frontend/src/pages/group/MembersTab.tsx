import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { isAxiosError } from 'axios';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useRemoveMember } from '../../api/groups';
import { useCreateInvite, usePendingInvites } from '../../api/invites';
import { useAuth } from '../../auth/AuthContext';
import type { Group } from '../../types/api';

const inviteSchema = z.object({ email: z.string().email('Enter a valid email') });
type InviteForm = z.infer<typeof inviteSchema>;

export function MembersTab({ group }: { group: Group }) {
  const { user } = useAuth();
  const removeMember = useRemoveMember(group.id);
  const createInvite = useCreateInvite(group.id);
  const { data: pendingInvites } = usePendingInvites(group.id);
  const [serverError, setServerError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState<string | null>(null);

  const myRole = group.members.find((m) => m.userId === user?.id)?.role;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteForm>({ resolver: zodResolver(inviteSchema) });

  async function onSubmit(data: InviteForm) {
    setServerError(null);
    setInviteSent(null);
    try {
      await createInvite.mutateAsync(data.email);
      setInviteSent(data.email);
      reset();
    } catch (err) {
      setServerError(isAxiosError(err) ? (err.response?.data?.message ?? 'Could not send invite') : 'Could not send invite');
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Members</h2>
        <div className="flex flex-col gap-2">
          {group.members.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {m.user.name} {m.role === 'OWNER' && <span className="ml-1 text-xs text-indigo-600">Owner</span>}
                </p>
                <p className="text-xs text-slate-500">{m.user.email}</p>
              </div>
              {(myRole === 'OWNER' || m.userId === user?.id) && m.role !== 'OWNER' && (
                <button
                  onClick={() => removeMember.mutate(m.userId)}
                  className="text-xs text-red-500 hover:underline"
                >
                  {m.userId === user?.id ? 'Leave' : 'Remove'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Invite someone</h2>
        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="flex items-end gap-3">
            <div className="flex-1">
              <Input label="Email" type="email" placeholder="roommate@example.com" {...register('email')} error={errors.email?.message} />
            </div>
            <Button type="submit" isLoading={isSubmitting}>
              Send invite
            </Button>
          </form>
          {inviteSent && <p className="mt-2 text-sm text-green-600">Invite sent to {inviteSent}.</p>}
          {serverError && <p className="mt-2 text-sm text-red-600">{serverError}</p>}
        </Card>

        {pendingInvites && pendingInvites.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {pendingInvites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm">
                <span className="text-slate-700">{invite.email}</span>
                <span className="text-xs text-slate-400">Pending · expires {new Date(invite.expiresAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
