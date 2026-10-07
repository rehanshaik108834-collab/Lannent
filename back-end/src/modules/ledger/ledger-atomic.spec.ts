import { Test } from '@nestjs/testing';
import { LedgerCoreModule } from './ledger.core.module';
import { LedgerService } from './ledger.service';
import { LedgerRepository } from './ledger.repository';
import { UsersRepository } from '../users/users.repository';
import { TransactionsRepository } from '../transactions/transactions.repository';
import { LoggingModule } from '../../common/logging/logging.module';

/** Standalone ledger calls must roll back even without a surrounding workflow UoW. */
describe('Standalone ledger atomicity', () => {
  let ledger: LedgerService;
  let stores: {
    ledger: LedgerRepository;
    users: UsersRepository;
    history: TransactionsRepository;
  };
  beforeEach(async () => {
    const fixture = await Test.createTestingModule({
      imports: [LoggingModule, LedgerCoreModule],
    }).compile();
    ledger = fixture.get(LedgerService);
    stores = {
      ledger: fixture.get(LedgerRepository),
      users: fixture.get(UsersRepository),
      history: fixture.get(TransactionsRepository),
    };
    ledger.resetToSeed();
  });
  afterEach(() => jest.restoreAllMocks());
  const state = () =>
    structuredClone({
      users: stores.users.findAll(),
      history: stores.history.findAll(),
      revenue: stores.ledger.getRevenue(),
      escrow: stores.ledger.allEscrow(),
      billings: stores.ledger.getBillings('u1', 'u5'),
      release: stores.ledger.getMilestoneRelease('m13'),
    });

  it('restores a wallet credit when revenue recording fails', () => {
    const before = state();
    jest
      .spyOn(LedgerRepository.prototype, 'recordRevenue')
      .mockImplementation(() => {
        throw new Error('revenue unavailable');
      });
    expect(() => ledger.deposit('u1', 100)).toThrow('revenue unavailable');
    expect(state()).toEqual(before);
  });
  it('restores payout, escrow, fees, billings and the release marker if history writing fails', () => {
    ledger.fundProjectEscrow('t3', 'u1', 1200);
    const before = state();
    const writer = jest
      .spyOn(TransactionsRepository.prototype, 'insert')
      .mockImplementation(() => {
        throw new Error('history unavailable');
      });
    const payment = {
      milestoneId: 'm13',
      taskId: 't3',
      clientId: 'u1',
      workerId: 'u5',
      amount: 500,
    };
    expect(() => ledger.releaseMilestone(payment)).toThrow(
      'history unavailable',
    );
    expect(state()).toEqual(before);
    writer.mockRestore();
    expect(ledger.releaseMilestone(payment).alreadyReleased).toBe(false);
    expect(ledger.releaseMilestone(payment).alreadyReleased).toBe(true);
  });
});
