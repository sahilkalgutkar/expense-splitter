import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Layout } from '../components/Layout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { useCreateGroup, useGroups } from '../api/groups';
import { useAuth } from '../auth/AuthContext';

const createGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required'),
});
type CreateGroupForm = z.infer<typeof createGroupSchema>;

export function GroupsDashboardPage() {
  const { user } = useAuth();
  const { data: groups, isLoading } = useGroups();
  const createGroup = useCreateGroup();
  const [modalOpen, setModalOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateGroupForm>({ resolver: zodResolver(createGroupSchema) });

  async function onSubmit(data: CreateGroupForm) {
    await createGroup.mutateAsync(data.name);
    reset();
    setModalOpen(false);
  }

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Your groups</h1>
        <Button onClick={() => setModalOpen(true)}>New group</Button>
      </div>

      {isLoading && <p className="text-slate-500">Loading…</p>}

      {!isLoading && groups?.length === 0 && (
        <Card>
          <p className="text-slate-500">You're not in any groups yet. Create one to get started.</p>
        </Card>
      )}

      <div className="grid gap-3">
        {groups?.map((group) => (
          <Link key={group.id} to={`/groups/${group.id}`}>
            <Card className="transition-shadow hover:shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-medium text-slate-900">{group.name}</h2>
                  <p className="text-sm text-slate-500">
                    {group.members.length} member{group.members.length === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex -space-x-2">
                  {group.members.slice(0, 4).map((m) => (
                    <div
                      key={m.id}
                      title={m.user.name}
                      className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-indigo-100 text-xs font-medium text-indigo-700"
                    >
                      {m.user.name.slice(0, 1).toUpperCase()}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create a group">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Input
            label="Group name"
            placeholder="e.g. Apartment 4B"
            {...register('name')}
            error={errors.name?.message}
          />
          <Button type="submit" isLoading={isSubmitting}>
            Create group
          </Button>
        </form>
      </Modal>

      {user && <p className="mt-8 text-xs text-slate-400">Signed in as {user.email}</p>}
    </Layout>
  );
}
