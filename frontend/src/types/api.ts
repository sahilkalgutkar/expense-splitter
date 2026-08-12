export type SplitType = 'EQUAL' | 'EXACT' | 'PERCENTAGE';
export type Cadence = 'WEEKLY' | 'MONTHLY';
export type GroupRole = 'OWNER' | 'MEMBER';
export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: GroupRole;
  joinedAt: string;
  user: PublicUser;
}

export interface Group {
  id: string;
  name: string;
  createdById: string;
  createdAt: string;
  members: GroupMember[];
}

export interface ExpenseSplit {
  id: string;
  expenseId: string;
  userId: string;
  shareCents: number;
  user: PublicUser;
}

export interface Expense {
  id: string;
  groupId: string;
  paidById: string;
  paidBy: PublicUser;
  description: string;
  amountCents: number;
  currency: string;
  category: string | null;
  date: string;
  createdById: string;
  createdBy: PublicUser;
  recurringExpenseId: string | null;
  createdAt: string;
  splits: ExpenseSplit[];
}

export interface MemberBalance {
  userId: string;
  name: string;
  email: string;
  netCents: number;
}

export interface SettleUpSuggestion {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
  fromUser?: PublicUser;
  toUser?: PublicUser;
}

export interface Settlement {
  id: string;
  groupId: string;
  fromUserId: string;
  fromUser: PublicUser;
  toUserId: string;
  toUser: PublicUser;
  amountCents: number;
  note: string | null;
  settledAt: string;
}

export interface RecurringExpense {
  id: string;
  groupId: string;
  description: string;
  amountCents: number;
  paidById: string;
  splitType: SplitType;
  splitConfig: { participantUserIds?: string[]; splits?: { userId: string; value: number }[] };
  cadence: Cadence;
  nextRunAt: string;
  active: boolean;
  createdById: string;
  createdAt: string;
}

export interface Invite {
  id: string;
  groupId: string;
  email: string;
  token: string;
  invitedById: string;
  status: InviteStatus;
  expiresAt: string;
  createdAt: string;
}
