import { PrismaClient } from '../src/generated/prisma/client';

const TABLES = [
  'RefreshToken',
  'ExpenseSplit',
  'Expense',
  'RecurringExpense',
  'Settlement',
  'Invite',
  'GroupMember',
  'Group',
  'User',
];

/** Wipes every app table between e2e test files so runs are idempotent regardless of execution order. */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const quoted = TABLES.map((t) => `"${t}"`).join(', ');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`,
  );
}
