import { BadRequestException } from '@nestjs/common';
import { equalSplit, exactSplit, percentageSplit } from './split-calculator';

describe('equalSplit', () => {
  it('divides evenly when the amount splits cleanly', () => {
    expect(equalSplit(900, ['a', 'b', 'c'])).toEqual([
      { userId: 'a', shareCents: 300 },
      { userId: 'b', shareCents: 300 },
      { userId: 'c', shareCents: 300 },
    ]);
  });

  it('hands leftover cents to the first participants so shares sum exactly to the total', () => {
    const result = equalSplit(1000, ['a', 'b', 'c']);
    expect(result.reduce((sum, s) => sum + s.shareCents, 0)).toBe(1000);
    expect(result).toEqual([
      { userId: 'a', shareCents: 334 },
      { userId: 'b', shareCents: 333 },
      { userId: 'c', shareCents: 333 },
    ]);
  });

  it('throws when there are no participants', () => {
    expect(() => equalSplit(1000, [])).toThrow(BadRequestException);
  });
});

describe('exactSplit', () => {
  it('uses the given shares when they sum to the total', () => {
    const result = exactSplit(1000, [
      { userId: 'a', value: 600 },
      { userId: 'b', value: 400 },
    ]);
    expect(result).toEqual([
      { userId: 'a', shareCents: 600 },
      { userId: 'b', shareCents: 400 },
    ]);
  });

  it('throws when the shares do not sum to the total', () => {
    expect(() =>
      exactSplit(1000, [
        { userId: 'a', value: 600 },
        { userId: 'b', value: 300 },
      ]),
    ).toThrow(BadRequestException);
  });

  it('throws when there are no splits', () => {
    expect(() => exactSplit(1000, [])).toThrow(BadRequestException);
  });
});

describe('percentageSplit', () => {
  it('converts percentages summing to 100 into cent shares summing to the total', () => {
    const result = percentageSplit(1000, [
      { userId: 'a', value: 50 },
      { userId: 'b', value: 50 },
    ]);
    expect(result.reduce((sum, s) => sum + s.shareCents, 0)).toBe(1000);
  });

  it('distributes rounding remainder cents via the largest-remainder method without losing a cent', () => {
    const result = percentageSplit(1001, [
      { userId: 'a', value: 33.33 },
      { userId: 'b', value: 33.33 },
      { userId: 'c', value: 33.34 },
    ]);
    expect(result.reduce((sum, s) => sum + s.shareCents, 0)).toBe(1001);
  });

  it('throws when percentages do not sum to 100', () => {
    expect(() =>
      percentageSplit(1000, [
        { userId: 'a', value: 40 },
        { userId: 'b', value: 40 },
      ]),
    ).toThrow(BadRequestException);
  });

  it('throws when there are no splits', () => {
    expect(() => percentageSplit(1000, [])).toThrow(BadRequestException);
  });
});
