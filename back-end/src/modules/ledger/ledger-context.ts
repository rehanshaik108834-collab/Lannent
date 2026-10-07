import { Injectable, BadRequestException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { TransactionsService } from '../transactions/transactions.service';
import { LedgerRepository } from './ledger.repository';
import { AppLoggerService } from '../../common/logging/app-logger.service';
import { Paise, formatInr, fromPaise } from '../../common/money/inr';

import { UsersRepository } from '../users/users.repository';
import { TransactionsRepository } from '../transactions/transactions.repository';
import { runAtomically } from '../../common/unit-of-work/unit-of-work';

/** Shared ledger stores and amount guards. No HTTP modules are imported. */
@Injectable()
export class LedgerContext {
  constructor(
    public readonly ledger: LedgerRepository,
    public readonly users: UsersService,
    public readonly transactions: TransactionsService,
    public readonly log: AppLoggerService,
    private readonly accounts: UsersRepository,
    private readonly history: TransactionsRepository,
  ) {}
  run<T>(work: () => T): T {
    return runAtomically([this.accounts, this.history, this.ledger], work);
  }
  balanceOf(userId: string): number {
    const u = this.users.findById(userId);
    return u?.walletBalance ?? 0;
  }

  /** Wallet balances are stored in rupees; compare in paise. */
  requireFunds(userId: string, amount: Paise, what: string) {
    const balance = Math.round(this.balanceOf(userId) * 100);
    if (balance < amount) {
      throw new BadRequestException(
        `Insufficient wallet balance for ${what}. Required ${formatInr(fromPaise(amount))}, ` +
          `available ${formatInr(fromPaise(balance))}.`,
      );
    }
  }

  /** Escrow balances are stored in rupees; read them as paise. */
  projectHeld(taskId: string): Paise {
    return Math.round(this.ledger.getEscrow(taskId).projectHeld * 100);
  }

  auditHeld(taskId: string): Paise {
    return Math.round(this.ledger.getEscrow(taskId).auditHeld * 100);
  }
}
