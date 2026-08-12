import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { isAxiosError } from 'axios';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { useCreateRecurringExpense } from '../../api/recurring';
import { dollarsToCents } from '../../lib/money';
import type { Group, SplitType } from '../../types/api';

const participantSchema = z.object({
  userId: z.string(),
  name: z.string(),
  checked: z.boolean(),
  value: z.coerce.number().min(0).optional(),
});

const recurringSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  paidById: z.string().min(1),
  splitType: z.enum(['EQUAL', 'EXACT', 'PERCENTAGE']),
  cadence: z.enum(['WEEKLY', 'MONTHLY']),
  participants: z.array(participantSchema).min(1),
});

type RecurringFormInput = z.input<typeof recurringSchema>;
type RecurringForm = z.output<typeof recurringSchema>;

export function AddRecurringModal({ group, open, onClose }: { group: Group; open: boolean; onClose: () => void }) {
  const createRecurring = useCreateRecurringExpense(group.id);
  const [serverError, setServerError] = useState<string | null>(null);

  const defaultValues: RecurringFormInput = {
    description: '',
    amount: undefined,
    paidById: group.members[0]?.userId,
    splitType: 'EQUAL',
    cadence: 'MONTHLY',
    participants: group.members.map((m) => ({ userId: m.userId, name: m.user.name, checked: true, value: 0 })),
  };

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RecurringFormInput, unknown, RecurringForm>({ resolver: zodResolver(recurringSchema), defaultValues });

  const { fields } = useFieldArray({ control, name: 'participants' });
  const splitType = watch('splitType');

  useEffect(() => {
    if (open) {
      reset(defaultValues);
      setServerError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, group]);

  async function onSubmit(data: RecurringForm) {
    setServerError(null);
    const amountCents = dollarsToCents(data.amount);
    const checkedParticipants = data.participants.filter((p) => p.checked);

    try {
      await createRecurring.mutateAsync({
        description: data.description,
        amountCents,
        paidById: data.paidById,
        splitType: data.splitType as SplitType,
        cadence: data.cadence,
        participantUserIds: data.splitType === 'EQUAL' ? checkedParticipants.map((p) => p.userId) : undefined,
        splits:
          data.splitType === 'EQUAL'
            ? undefined
            : checkedParticipants.map((p) => ({
                userId: p.userId,
                value: data.splitType === 'EXACT' ? dollarsToCents(p.value ?? 0) : (p.value ?? 0),
              })),
      });
      onClose();
    } catch (err) {
      setServerError(
        isAxiosError(err) ? (err.response?.data?.message ?? 'Could not create recurring bill') : 'Could not create recurring bill',
      );
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add recurring bill">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input label="Description" placeholder="e.g. Rent" {...register('description')} error={errors.description?.message} />
        <Input label="Amount ($)" type="number" step="0.01" {...register('amount')} error={errors.amount?.message} />

        <Select label="Paid by" {...register('paidById')}>
          {group.members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.user.name}
            </option>
          ))}
        </Select>

        <Select label="Repeats" {...register('cadence')}>
          <option value="WEEKLY">Weekly</option>
          <option value="MONTHLY">Monthly</option>
        </Select>

        <Select label="Split type" {...register('splitType')}>
          <option value="EQUAL">Equal</option>
          <option value="EXACT">Exact amounts</option>
          <option value="PERCENTAGE">Percentage</option>
        </Select>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700">Split between</span>
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-3">
              <input type="checkbox" {...register(`participants.${index}.checked`)} className="h-4 w-4 rounded border-slate-300" />
              <span className="flex-1 text-sm text-slate-700">{field.name}</span>
              {splitType !== 'EQUAL' && (
                <input
                  type="number"
                  step="0.01"
                  placeholder={splitType === 'EXACT' ? '$' : '%'}
                  {...register(`participants.${index}.value`)}
                  className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                />
              )}
            </div>
          ))}
        </div>

        {serverError && <p className="text-sm text-red-600">{serverError}</p>}

        <Button type="submit" isLoading={isSubmitting}>
          Add recurring bill
        </Button>
      </form>
    </Modal>
  );
}
