import { BadRequestException } from '@nestjs/common';

/**
 * INR money helpers.
 *
 * The platform uses one currency, INR. Public API fields stay in rupees with at
 * most two decimals; every calculation converts to integer paise first, so a
 * fee, its net and a split always add back up to the gross exactly.
 */

/** Whole paise. Always an integer. */
export type Paise = number;

export const CURRENCY = 'INR' as const;

/**
 * Converts a rupee amount to paise. Rejects values with more than two decimal
 * places instead of silently rounding money a caller asked for.
 */
export function toPaise(rupees: number): Paise {
  if (typeof rupees !== 'number' || !Number.isFinite(rupees)) {
    throw new BadRequestException('Amount must be a finite number of rupees.');
  }
  const paise = Math.round(rupees * 100);
  // Tolerates binary noise such as 0.1 + 0.2, not a genuine third decimal.
  if (Math.abs(paise - rupees * 100) > 1e-6 * Math.max(1, Math.abs(rupees))) {
    throw new BadRequestException(
      `₹${rupees} has more than two decimal places.`,
    );
  }
  return paise;
}

/** Converts paise back to rupees for the public boundary. */
export function fromPaise(paise: Paise): number {
  return paise / 100;
}

/**
 * `percent`% of an amount, rounded half-up to the paisa.
 *
 * Uses BigInt so the multiplication is exact. The rate keeps four decimal
 * places of a percent (e.g. 2.9 or 0.25), which covers every configured fee.
 */
export function percentOf(paise: Paise, percent: number): Paise {
  if (paise < 0) throw new Error('percentOf expects a non-negative amount.');
  const scaledRate = BigInt(Math.round(percent * 10_000)); // percent × 10⁴
  const divisor = 1_000_000n; // 100 (percent) × 10⁴ (rate scale)
  return Number((BigInt(paise) * scaledRate + divisor / 2n) / divisor);
}

/**
 * Splits an amount in two for a split verdict. The worker receives half
 * rounded down; the client receives the remainder, including any odd paisa.
 */
export function splitInHalf(paise: Paise): { worker: Paise; client: Paise } {
  const worker = Math.floor(paise / 2);
  return { worker, client: paise - worker };
}

const formatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: CURRENCY,
});

/** Formats a rupee amount for messages and descriptions, e.g. ₹1,234.50. */
export function formatInr(rupees: number): string {
  return formatter.format(rupees);
}
