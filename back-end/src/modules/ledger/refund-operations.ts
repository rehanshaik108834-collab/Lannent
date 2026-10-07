import { Injectable, BadRequestException } from '@nestjs/common';
import { formatInr, fromPaise, toPaise } from '../../common/money/inr';

import { LedgerContext } from './ledger-context';

@Injectable()
export class RefundOperations {
  constructor(private readonly context: LedgerContext) {}
  /**
   * Returns held project funds to the client. Marketplace and initiation fees
   * are not refunded, which matches how the major marketplaces treat them.
   */
  refundToClient(params: {
    taskId: string;
    clientId: string;
    amount: number;
    reason?: string;
  }) {
    const { taskId, clientId } = params;
    const amountPaise = toPaise(params.amount);
    if (amountPaise <= 0)
      throw new BadRequestException('Refund amount must be greater than zero.');
    const amount = fromPaise(amountPaise);

    const heldPaise = this.context.projectHeld(taskId);
    if (heldPaise < amountPaise) {
      throw new BadRequestException(
        `Escrow for this project holds ${formatInr(fromPaise(heldPaise))}, which does not cover ` +
          `a ${formatInr(amount)} refund.`,
      );
    }

    this.context.ledger.addProjectHeld(taskId, -amount);
    this.context.users.addToWallet(clientId, amount);

    this.context.transactions.create({
      type: 'refund',
      amount,
      fromId: 'escrow',
      toId: clientId,
      taskId,
      description: params.reason || 'Escrow refunded to client',
      status: 'completed',
    });

    this.context.log.money('refund.project', {
      task: taskId,
      client: clientId,
      amount,
      held: this.context.ledger.getEscrow(taskId).projectHeld,
      reason: params.reason,
    });
    return { amount, balance: this.context.balanceOf(clientId) };
  }

  /** Returns unspent audit escrow to the client — e.g. an abandoned draft project. */
  refundAuditEscrow(params: {
    taskId: string;
    clientId: string;
    amount: number;
    reason?: string;
  }) {
    const { taskId, clientId } = params;
    const amountPaise = toPaise(params.amount);
    if (amountPaise <= 0)
      throw new BadRequestException('Refund amount must be greater than zero.');
    const amount = fromPaise(amountPaise);

    const heldPaise = this.context.auditHeld(taskId);
    if (heldPaise < amountPaise) {
      throw new BadRequestException(
        `Audit escrow holds ${formatInr(fromPaise(heldPaise))}, which does not cover ` +
          `a ${formatInr(amount)} refund.`,
      );
    }

    this.context.ledger.addAuditHeld(taskId, -amount);
    this.context.users.addToWallet(clientId, amount);

    this.context.transactions.create({
      type: 'refund',
      amount,
      fromId: 'escrow',
      toId: clientId,
      taskId,
      description: params.reason || 'Audit escrow refunded to client',
      status: 'completed',
    });

    this.context.log.money('refund.audit', {
      task: taskId,
      client: clientId,
      amount,
      held: this.context.ledger.getEscrow(taskId).auditHeld,
      reason: params.reason,
    });
    return { amount, balance: this.context.balanceOf(clientId) };
  }
}
