import { BadRequestException } from '@nestjs/common';
import { formatInr, fromPaise, percentOf, splitInHalf, toPaise } from './inr';

describe('INR money helpers', () => {
  it('converts rupees to paise without floating-point crumbs', () => {
    expect(toPaise(0.1 + 0.2)).toBe(30);
    expect(toPaise(1234.56)).toBe(123456);
    expect(fromPaise(123456)).toBe(1234.56);
  });

  it('rejects amounts with more than two decimals or non-finite values', () => {
    expect(() => toPaise(10.005)).toThrow(BadRequestException);
    expect(() => toPaise(Number.NaN)).toThrow(BadRequestException);
    expect(() => toPaise(Infinity)).toThrow(BadRequestException);
  });

  it('applies percentages exactly and rounds half-up to the paisa', () => {
    expect(percentOf(100000, 2.9)).toBe(2900);
    expect(percentOf(150, 10)).toBe(15);
    // 0.25% of ₹1.00 is a quarter paisa; 0.25% of ₹2.00 is half a paisa.
    expect(percentOf(100, 0.25)).toBe(0);
    expect(percentOf(200, 0.25)).toBe(1);
  });

  it('gives the worker half rounded down and the client the odd paisa', () => {
    expect(splitInHalf(100001)).toEqual({ worker: 50000, client: 50001 });
    expect(splitInHalf(1)).toEqual({ worker: 0, client: 1 });
    expect(splitInHalf(200)).toEqual({ worker: 100, client: 100 });
  });

  it('formats rupees in Indian grouping', () => {
    expect(formatInr(123456.5)).toBe('₹1,23,456.50');
  });
});
