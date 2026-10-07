import { Injectable } from '@nestjs/common';
import { LedgerRepository } from './ledger.repository';
import { LedgerContext } from './ledger-context';
import { WalletOperations } from './wallet-operations';
import { EscrowFundingOperations } from './escrow-funding-operations';
import { PayoutOperations } from './payout-operations';
import { RefundOperations } from './refund-operations';
import { resetFeeConfig } from './fee-config';

/** Public ledger facade. Each money operation commits all stores or restores them. */
@Injectable()
export class LedgerService {
  constructor(
    private readonly ledger: LedgerRepository,
    private readonly context: LedgerContext,
    private readonly wallets: WalletOperations,
    private readonly funding: EscrowFundingOperations,
    private readonly payouts: PayoutOperations,
    private readonly refunds: RefundOperations,
  ) {}
  deposit(userId: string, amount: number) {
    return this.context.run(() => this.wallets.deposit(userId, amount));
  }
  withdraw(userId: string, amount: number) {
    return this.context.run(() => this.wallets.withdraw(userId, amount));
  }
  fundProjectEscrow(
    taskId: string,
    clientId: string,
    budget: number,
    title = 'project',
  ) {
    return this.context.run(() =>
      this.funding.fundProjectEscrow(taskId, clientId, budget, title),
    );
  }
  fundAuditEscrow(
    taskId: string,
    clientId: string,
    fee: number,
    label = 'technical audit',
  ) {
    return this.context.run(() =>
      this.funding.fundAuditEscrow(taskId, clientId, fee, label),
    );
  }
  releaseMilestone(
    params: Parameters<PayoutOperations['releaseMilestone']>[0],
  ) {
    return this.context.run(() => this.payouts.releaseMilestone(params));
  }
  releaseAuditFee(params: Parameters<PayoutOperations['releaseAuditFee']>[0]) {
    return this.context.run(() => this.payouts.releaseAuditFee(params));
  }
  refundToClient(params: Parameters<RefundOperations['refundToClient']>[0]) {
    return this.context.run(() => this.refunds.refundToClient(params));
  }
  refundAuditEscrow(
    params: Parameters<RefundOperations['refundAuditEscrow']>[0],
  ) {
    return this.context.run(() => this.refunds.refundAuditEscrow(params));
  }
  getEscrow(taskId: string) {
    return this.ledger.getEscrow(taskId);
  }
  allEscrow() {
    return this.ledger.allEscrow();
  }
  totalHeld() {
    return this.ledger.totalHeld();
  }
  getRevenue() {
    return this.ledger.getRevenue();
  }
  totalRevenue() {
    return this.ledger.totalRevenue();
  }
  getBillings(clientId: string, workerId: string) {
    return this.ledger.getBillings(clientId, workerId);
  }
  getMilestoneRelease(milestoneId: string) {
    return this.ledger.getMilestoneRelease(milestoneId);
  }
  resetToSeed() {
    this.ledger.resetToSeed();
    resetFeeConfig();
  }
}
