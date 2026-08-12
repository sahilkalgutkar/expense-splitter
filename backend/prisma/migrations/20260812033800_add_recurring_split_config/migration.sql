/*
  Warnings:

  - Added the required column `paidById` to the `RecurringExpense` table without a default value. This is not possible if the table is not empty.
  - Added the required column `splitConfig` to the `RecurringExpense` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "RecurringExpense" ADD COLUMN     "paidById" TEXT NOT NULL,
ADD COLUMN     "splitConfig" JSONB NOT NULL;

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
