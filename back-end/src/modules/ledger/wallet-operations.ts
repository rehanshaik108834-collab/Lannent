import { Injectable, BadRequestException } from '@nestjs/common';
import { depositFeePaise, withdrawalFeePaise, FEE_CONFIG } from './fee-config';
import { formatInr, fromPaise, toPaise } from '../../common/money/inr';

import { LedgerContext } from './ledger-context';

@Injectable()
export class WalletOperations {
  constructor(private readonly context: LedgerContext) {}
  // ── Wallet in and out ─────────────────────────────────────────────────────

  /** Tops up a wallet. The platform keeps card processing; the user is credited the net. */
  deposit(userId: string, grossRupees: number) {
    const grossPaise = toPaise(grossRupees);
    if (grossPaise <= 0)
      throw new BadRequestException(
        'Deposit amount must be greater than zero.',
      );
    const feePaise = depositFeePaise(grossPaise);
    const gross = fromPaise(grossPaise);
    const fee = fromPaise(feePaise);
    if (feePaise >= grossPaise) {
      throw new BadRequestException(
        `Deposit of ${formatInr(gross)} does not cover the ${formatInr(fee)} processing fee.`,
      );
    }
    const net = fromPaise(grossPaise - feePaise);

    this.context.users.addToWallet(userId, net);
    this.context.ledger.recordRevenue({
      feeType: 'deposit-processing',
      amount: fee,
      baseAmount: gross,
      rate: FEE_CONFIG.deposit.percent,
      fromUserId: userId,
      taskId: null,
      milestoneId: null,
    });
    this.context.transactions.create({
      type: 'deposit',
      amount: net,
      grossAmount: gross,
      feeAmount: fee,
      netAmount: net,
      feeType: 'deposit-processing',
      fromId: 'external',
      toId: userId,
      description: `Wallet top-up (${formatInr(gross)} less ${formatInr(fee)} processing fee)`,
      status: 'completed',
    });

    this.context.log.money('deposit', {
      user: userId,
      gross,
      fee,
      net,
      balance: this.context.balanceOf(userId),
    });
    return { gross, fee, net, balance: this.context.balanceOf(userId) };
  }

  /** Withdraws to an external account. The full gross leaves the wallet; the payout fee is ours. */
  withdraw(userId: string, grossRupees: number) {
    const grossPaise = toPaise(grossRupees);
    if (grossPaise <= 0)
      throw new BadRequestException(
        'Withdrawal amount must be greater than zero.',
      );
    const feePaise = withdrawalFeePaise(grossPaise);
    const gross = fromPaise(grossPaise);
    const fee = fromPaise(feePaise);
    if (feePaise >= grossPaise) {
      throw new BadRequestException(
        `Withdrawal of ${formatInr(gross)} does not cover the ${formatInr(fee)} payout fee.`,
      );
    }
    this.context.requireFunds(userId, grossPaise, 'this withdrawal');
    const net = fromPaise(grossPaise - feePaise);

    this.context.users.deductFromWallet(userId, gross);
    this.context.ledger.recordRevenue({
      feeType: 'withdrawal-processing',
      amount: fee,
      baseAmount: gross,
      rate: FEE_CONFIG.withdrawal.percent,
      fromUserId: userId,
      taskId: null,
      milestoneId: null,
    });
    this.context.transactions.create({
      type: 'withdrawal',
      amount: gross,
      grossAmount: gross,
      feeAmount: fee,
      netAmount: net,
      feeType: 'withdrawal-processing',
      fromId: userId,
      toId: 'external',
      description: `Withdrawal (${formatInr(gross)} less ${formatInr(fee)} payout fee)`,
      status: 'completed',
    });

    this.context.log.money('withdraw', {
      user: userId,
      gross,
      fee,
      net,
      balance: this.context.balanceOf(userId),
    });
    return { gross, fee, net, balance: this.context.balanceOf(userId) };
  }
}
