import { BadRequestException } from '@nestjs/common';

export interface SplitInput {
  userId: string;
  value: number;
}

export interface ShareResult {
  userId: string;
  shareCents: number;
}

/** Divides amountCents evenly across userIds, handing any leftover cents (from integer division) to the first participants so the shares always sum exactly to amountCents. */
export function equalSplit(amountCents: number, userIds: string[]): ShareResult[] {
  if (userIds.length === 0) throw new BadRequestException('At least one participant is required');

  const base = Math.floor(amountCents / userIds.length);
  const remainder = amountCents - base * userIds.length;

  return userIds.map((userId, index) => ({
    userId,
    shareCents: base + (index < remainder ? 1 : 0),
  }));
}

export function exactSplit(amountCents: number, splits: SplitInput[]): ShareResult[] {
  if (splits.length === 0) throw new BadRequestException('At least one split is required');

  const sum = splits.reduce((total, s) => total + s.value, 0);
  if (sum !== amountCents) {
    throw new BadRequestException(`Exact split amounts (${sum}) must sum to the expense total (${amountCents})`);
  }

  return splits.map((s) => ({ userId: s.userId, shareCents: s.value }));
}

/** Converts percentages (summing to 100) into cent shares using the largest-remainder method, so rounding never causes the shares to miss the expense total. */
export function percentageSplit(amountCents: number, splits: SplitInput[]): ShareResult[] {
  if (splits.length === 0) throw new BadRequestException('At least one split is required');

  const percentSum = splits.reduce((total, s) => total + s.value, 0);
  if (Math.abs(percentSum - 100) > 0.01) {
    throw new BadRequestException(`Split percentages (${percentSum}) must sum to 100`);
  }

  const raw = splits.map((s) => (amountCents * s.value) / 100);
  const floored = raw.map(Math.floor);
  let allocated = floored.reduce((a, b) => a + b, 0);
  let remainderToDistribute = amountCents - allocated;

  const remainders = raw
    .map((value, index) => ({ index, frac: value - floored[index] }))
    .sort((a, b) => b.frac - a.frac);

  const shareCents = [...floored];
  for (let i = 0; i < remainderToDistribute; i++) {
    shareCents[remainders[i % remainders.length].index] += 1;
  }

  return splits.map((s, index) => ({ userId: s.userId, shareCents: shareCents[index] }));
}
