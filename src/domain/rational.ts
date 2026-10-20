import { z } from 'zod';

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

export const QSchema = z.strictObject({
  n: z.number().int().safe().refine((n) => !Object.is(n, -0), 'Negative zero is not canonical'),
  d: z.number().int().safe().positive(),
}).refine(({ n, d }) => gcd(BigInt(n), BigInt(d)) === 1n, 'Rational must be reduced (zero is 0/1)');

export type Q = z.infer<typeof QSchema>;
export const TimeSchema = QSchema.refine(({ n }) => n >= 0, 'Time must be nonnegative');
export const DurationSchema = QSchema.refine(({ n }) => n > 0, 'Duration must be positive');

function reduced(n: bigint, d: bigint): Q {
  if (d === 0n) throw new RangeError('Zero denominator');
  if (d < 0n) [n, d] = [-n, -d];
  const divisor = gcd(n, d);
  n /= divisor;
  d /= divisor;
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (n > max || n < -max || d > max) throw new RangeError('Rational exceeds safe integer representation');
  return { n: Number(n), d: Number(d) };
}

export function q(n: number, d = 1): Q {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d)) throw new RangeError('Expected safe integers');
  return reduced(BigInt(n), BigInt(d));
}

export function add(a: Q, b: Q): Q {
  QSchema.parse(a);
  QSchema.parse(b);
  return reduced(BigInt(a.n) * BigInt(b.d) + BigInt(b.n) * BigInt(a.d), BigInt(a.d) * BigInt(b.d));
}

export function subtract(a: Q, b: Q): Q {
  QSchema.parse(b);
  return add(a, q(-b.n, b.d));
}

export function multiply(a: Q, b: Q): Q {
  QSchema.parse(a);
  QSchema.parse(b);
  return reduced(BigInt(a.n) * BigInt(b.n), BigInt(a.d) * BigInt(b.d));
}

export function compare(a: Q, b: Q): -1 | 0 | 1 {
  QSchema.parse(a);
  QSchema.parse(b);
  const delta = BigInt(a.n) * BigInt(b.d) - BigInt(b.n) * BigInt(a.d);
  return delta < 0n ? -1 : delta > 0n ? 1 : 0;
}

export function overlaps(aStart: Q, aEnd: Q, bStart: Q, bEnd: Q): boolean {
  return compare(aStart, bEnd) < 0 && compare(bStart, aEnd) < 0;
}

export function exactTicks(time: Q, ppq: number): number {
  if (!Number.isSafeInteger(ppq) || ppq <= 0) throw new RangeError('PPQ must be a positive safe integer');
  const ticks = multiply(time, q(ppq));
  if (ticks.d !== 1) throw new RangeError('Adapter cannot represent time at this PPQ without rounding');
  return ticks.n;
}
