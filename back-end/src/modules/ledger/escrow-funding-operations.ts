import { Injectable, BadRequestException } from '@nestjs/common';
import {
  marketplaceFeePaise,
  initiationFeePaise,
  FEE_CONFIG,
} from './fee-config';
import { formatInr, fromPaise, toPaise } from '../../common/money/inr';

import { LedgerContext } from './ledger-context';

@Injectable()
export class EscrowFundingOperations {
  constructor(private readonly context: LedgerContext) {}
  // ── Escrow in ─────────────────────────────────────────────────────────────

  /**
   * Funds project escrow when a worker is hired. The client pays the budget
   * plus the marketplace and contract-initiation fees; only the budget is held.
   */
  fundProjectEscrow(
    taskId: string,
    clientId: string,
    budgetRupees: number,
    taskTitle = 'project',
  ) {
    const budgetPaise = toPaise(budgetRupees);
    if (budgetPaise <= 0)
      throw new BadRequestException(
        'Project budget must be greater than zero.',
      );
    const marketplacePaise = marketplaceFeePaise(budgetPaise);
    const initiationPaise = initiationFeePaise(budgetPaise);
    const totalPaise = budgetPaise + marketplacePaise + initiationPaise;
    const budget = fromPaise(budgetPaise);
    const marketplace = fromPaise(marketplacePaise);
    const initiation = fromPaise(initiationPaise);
    const total = fromPaise(totalPaise);
    const fees = fromPaise(marketplacePaise + initiationPaise);

    this.context.requireFunds(clientId, totalPaise, 'funding this project');
    this.context.users.deductFromWallet(clientId, total);
    this.context.ledger.addProjectHeld(taskId, budget);

    this.context.ledger.recordRevenue({
      feeType: 'client-marketplace',
      amount: marketplace,
      baseAmount: budget,
      rate: FEE_CONFIG.clientMarketplace.percent,
      fromUserId: clientId,
      taskId,
      milestoneId: null,
    });
    this.context.ledger.recordRevenue({
      feeType: 'contract-initiation',
      amount: initiation,
      baseAmount: budget,
      rate: 0,
      fromUserId: clientId,
      taskId,
      milestoneId: null,
    });

    this.context.transactions.create({
      type: 'escrow-lock',
      amount: budget,
      grossAmount: total,
      feeAmount: fees,
      netAmount: budget,
      fromId: clientId,
      toId: 'escrow',
      taskId,
      description: `Escrow funded for ${taskTitle}`,
      status: 'completed',
    });
    this.context.transactions.create({
      type: 'platform-fee',
      amount: fees,
      feeAmount: fees,
      feeType: 'client-marketplace',
      fromId: clientId,
      toId: 'platform',
      taskId,
      description: `Marketplace fee ${formatInr(marketplace)} + contract initiation ${formatInr(initiation)}`,
      status: 'completed',
    });

    this.context.log.money('escrow.fund.project', {
      task: taskId,
      client: clientId,
      budget,
      marketplace,
      initiation,
      charged: total,
      held: this.context.ledger.getEscrow(taskId).projectHeld,
    });
    return {
      budget,
      marketplace,
      initiation,
      totalCharged: total,
      held: this.context.ledger.getEscrow(taskId),
    };
  }

  /** Funds the expert reviewer's agreed audit fee into escrow. Held separately from project funds. */
  fundAuditEscrow(
    taskId: string,
    clientId: string,
    auditFeeRupees: number,
    label = 'technical audit',
  ) {
    const feePaise = toPaise(auditFeeRupees);
    if (feePaise <= 0)
      throw new BadRequestException('Audit fee must be greater than zero.');
    const auditFee = fromPaise(feePaise);
    this.context.requireFunds(clientId, feePaise, 'funding this audit');

    this.context.users.deductFromWallet(clientId, auditFee);
    this.context.ledger.addAuditHeld(taskId, auditFee);

    this.context.transactions.create({
      type: 'audit-escrow-lock',
      amount: auditFee,
      fromId: clientId,
      toId: 'escrow',
      taskId,
      description: `Escrow funded for ${label}`,
      status: 'completed',
    });

    this.context.log.money('escrow.fund.audit', {
      task: taskId,
      client: clientId,
      fee: auditFee,
      held: this.context.ledger.getEscrow(taskId).auditHeld,
    });
    return { auditFee, held: this.context.ledger.getEscrow(taskId) };
  }
}
