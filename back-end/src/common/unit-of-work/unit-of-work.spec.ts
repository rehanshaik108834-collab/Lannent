import { runAtomically } from './unit-of-work';

class Wallets {
  balances: Record<string, number> = { a: 100, b: 0 };
  paid = new Set<string>();
  counter = 1;
}

describe('runAtomically', () => {
  it('keeps every write when the operation succeeds', () => {
    const wallets = new Wallets();
    const result = runAtomically([wallets], () => {
      wallets.balances.a -= 40;
      wallets.balances.b += 40;
      wallets.paid.add('m1');
      return 'done';
    });
    expect(result).toBe('done');
    expect(wallets.balances).toEqual({ a: 60, b: 40 });
    expect(wallets.paid.has('m1')).toBe(true);
  });

  it('restores records, sets, and counters of every participant on failure', () => {
    const first = new Wallets();
    const second = new Wallets();
    expect(() =>
      runAtomically([first, second], () => {
        first.balances.a -= 40;
        first.paid.add('m1');
        first.counter++;
        second.balances.b += 40;
        throw new Error('payout failed');
      }),
    ).toThrow('payout failed');

    expect(first.balances).toEqual({ a: 100, b: 0 });
    expect(first.paid.size).toBe(0);
    expect(first.counter).toBe(1);
    expect(second.balances).toEqual({ a: 100, b: 0 });
  });

  it('rolls back when a nested record object was mutated in place', () => {
    const store = { rows: [{ id: 'x', status: 'submitted' }] };
    const row = store.rows[0];
    expect(() =>
      runAtomically([store], () => {
        row.status = 'completed';
        throw new Error('later step failed');
      }),
    ).toThrow();
    expect(store.rows[0].status).toBe('submitted');
  });

  it('refuses asynchronous work and restores state', () => {
    const wallets = new Wallets();
    expect(() =>
      runAtomically([wallets], () => {
        wallets.balances.a = 0;
        return Promise.resolve();
      }),
    ).toThrow('synchronous');
    expect(wallets.balances.a).toBe(100);
  });
});
