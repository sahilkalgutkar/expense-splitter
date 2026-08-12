import { describe, expect, it } from 'vitest';
import { dollarsToCents, formatCents } from './money';

describe('formatCents', () => {
  it('formats whole dollar amounts', () => {
    expect(formatCents(2500)).toBe('$25.00');
  });

  it('formats amounts with cents', () => {
    expect(formatCents(1099)).toBe('$10.99');
  });

  it('formats zero', () => {
    expect(formatCents(0)).toBe('$0.00');
  });

  it('formats negative amounts', () => {
    expect(formatCents(-500)).toBe('-$5.00');
  });

  it('respects a non-default currency', () => {
    expect(formatCents(1000, 'EUR')).toContain('10.00');
  });
});

describe('dollarsToCents', () => {
  it('converts whole dollars', () => {
    expect(dollarsToCents(25)).toBe(2500);
  });

  it('rounds fractional cents from floating point input', () => {
    expect(dollarsToCents(19.99)).toBe(1999);
  });

  it('round-trips with formatCents for common amounts', () => {
    expect(dollarsToCents(0.1) + dollarsToCents(0.2)).toBe(30);
  });
});
