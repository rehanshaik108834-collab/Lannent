import { Injectable, BadRequestException } from '@nestjs/common';
import {
  workerServiceFeePaise,
  workerServiceRate,
  expertServiceFeePaise,
  FEE_CONFIG,
} from './fee-config';
import { formatInr, fromPaise, toPaise } from '../../common/money/inr';

import { LedgerContext } from './ledger-context';

@Injectable()
export class PayoutOperations {
  constructor(private readonly context: LedgerContext) {}
  // ── Escrow out ────────────────────────────────────────────────────────────

  /**
   * Releases a milestone to the worker, net of the tiered service fee.
   * Idempotent: a second call for the same milestone moves no money and
   * returns what the first release paid, so double approval cannot pay twice.
   */
  releaseMilestone(params: {
    milestoneId: string;
    taskId: string;
    clientId: string;
    workerId: string;
    amount: number;
    description?: string;
  }) {
    const { milestoneId, taskId, clientId, workerId } = params;
    const amount = fromPaise(toPaise(params.amount));

    const recorded = this.context.ledger.getMilestoneRelease(milestoneId);
    if (recorded) {
      // Not an error — the guard is doing its job — but a second approval
      // arriving at all is worth seeing in the log.
      this.context.log.money('milestone.release.skipped', {
        milestone: milestoneId,
        task: taskId,
        reason: 'already-released',
      });
      return { alreadyReleased: true, ...recorded };
    }
    const amountPaise = toPaise(params.amount);
    if (amountPaise <= 0)
      throw new BadRequestException(
        'Milestone amount must be greater than zero.',
      );
    if (!workerId)
      throw new BadRequestException('Milestone has no worker to pay.');

    const heldPaise = this.context.projectHeld(taskId);
    if (heldPaise < amountPaise) {
      throw new BadRequestException(
        `Escrow for this project holds ${formatInr(fromPaise(heldPaise))}, which does not cover ` +
          `the ${formatInr(fromPaise(amountPaise))} milestone.`,
      );
    }

    const priorBillings = this.context.ledger.getBillings(clientId, workerId);
    const rate = workerServiceRate(priorBillings);
    const feePaise = workerServiceFeePaise(amountPaise, priorBillings);
    const fee = fromPaise(feePaise);
    const net = fromPaise(amountPaise - feePaise);

    this.context.ledger.addProjectHeld(taskId, -amount);
    this.context.users.addToWallet(workerId, net);
    this.context.ledger.addBillings(clientId, workerId, amount);
    this.context.ledger.markMilestoneReleased(milestoneId, {
      workerId,
      amount,
      fee,
      rate,
      net,
    });

    this.context.ledger.recordRevenue({
      feeType: 'worker-service',
      amount: fee,
      baseAmount: amount,
      rate,
      fromUserId: workerId,
      taskId,
      milestoneId,
    });
    this.context.transactions.create({
      type: 'milestone-release',
      amount: net,
      grossAmount: amount,
      feeAmount: fee,
      netAmount: net,
      feeType: 'worker-service',
      fromId: 'escrow',
      toId: workerId,
      taskId,
      milestoneId,
      description:
        params.description ||
        `Payment released (${formatInr(amount)} less ${rate}% service fee)`,
      status: 'completed',
    });

    this.context.log.money('milestone.release', {
      milestone: milestoneId,
      task: taskId,
      client: clientId,
      worker: workerId,
      gross: amount,
      fee,
      rate: `${rate}%`,
      net,
      held: this.context.ledger.getEscrow(taskId).projectHeld,
    });
    return {
      alreadyReleased: false,
      amount,
      fee,
      rate,
      net,
      balance: this.context.balanceOf(workerId),
    };
  }

  /**
   * Pays the expert reviewer their agreed fee from audit escrow, net of
   * commission. Idempotent per audit request.
   */
  releaseAuditFee(params: {
    auditRequestId: string;
    taskId: string;
    expertId: string;
    amount: number;
    description?: string;
  }) {
    const { auditRequestId, taskId, expertId } = params;

    if (this.context.ledger.isAuditPaid(auditRequestId)) {
      this.context.log.money('audit.release.skipped', {
        audit: auditRequestId,
        task: taskId,
        reason: 'already-paid',
      });
      return { alreadyPaid: true, amount: 0, fee: 0, net: 0 };
    }
    const amountPaise = toPaise(params.amount);
    if (amountPaise <= 0)
      throw new BadRequestException(
        'Agreed audit fee must be greater than zero.',
      );
    if (!expertId) throw new BadRequestException('Audit has no expert to pay.');

    const heldPaise = this.context.auditHeld(taskId);
    if (heldPaise < amountPaise) {
      throw new BadRequestException(
        `Audit escrow holds ${formatInr(fromPaise(heldPaise))}, which does not cover the agreed fee ` +
          `of ${formatInr(fromPaise(amountPaise))}.`,
      );
    }

    const amount = fromPaise(amountPaise);
    const feePaise = expertServiceFeePaise(amountPaise);
    const fee = fromPaise(feePaise);
    const net = fromPaise(amountPaise - feePaise);

    this.context.ledger.addAuditHeld(taskId, -amount);
    this.context.users.addToWallet(expertId, net);
    this.context.ledger.markAuditPaid(auditRequestId);

    this.context.ledger.recordRevenue({
      feeType: 'expert-service',
      amount: fee,
      baseAmount: amount,
      rate: FEE_CONFIG.expertService.percent,
      fromUserId: expertId,
      taskId,
      milestoneId: null,
    });
    this.context.transactions.create({
      type: 'audit-release',
      amount: net,
      grossAmount: amount,
      feeAmount: fee,
      netAmount: net,
      feeType: 'expert-service',
      fromId: 'escrow',
      toId: expertId,
      taskId,
      auditRequestId,
      description:
        params.description ||
        `Audit fee released (${formatInr(amount)} less ${FEE_CONFIG.expertService.percent}% commission)`,
      status: 'completed',
    });

    this.context.log.money('audit.release', {
      audit: auditRequestId,
      task: taskId,
      expert: expertId,
      gross: amount,
      fee,
      net,
      held: this.context.ledger.getEscrow(taskId).auditHeld,
    });
    return {
      alreadyPaid: false,
      amount,
      fee,
      net,
      balance: this.context.balanceOf(expertId),
    };
  }
}
