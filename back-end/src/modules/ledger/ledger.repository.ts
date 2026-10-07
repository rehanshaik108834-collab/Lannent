import { Injectable } from '@nestjs/common';
import { SEED_TRANSACTIONS, SEED_TASKS } from '../seed/seed.data';
import { FeeType, round2 } from './fee-config';

export interface RevenueEntry {
  id: string;
  feeType: FeeType;
  /** The fee the platform kept. */
  amount: number;
  /** The amount the fee was calculated from. */
  baseAmount: number;
  /** Percentage applied, where one applies (fixed-only fees record 0). */
  rate: number;
  /** Who paid the fee. */
  fromUserId: string;
  taskId: string | null;
  milestoneId: string | null;
  createdAt: string;
}

/** What a milestone release paid, kept so a repeated approval can report it. */
export interface MilestoneRelease {
  workerId: string;
  /** Gross amount that left escrow. */
  amount: number;
  fee: number;
  rate: number;
  net: number;
}

export interface EscrowBalance {
  /** Held for milestone payments to the worker. */
  projectHeld: number;
  /** Held for the expert reviewer's agreed audit fee. */
  auditHeld: number;
}

/**
 * LedgerRepository — in-memory store for the things the app never tracked:
 * per-task escrow balances, platform revenue, and the counters that make
 * releases tiered and idempotent.
 */
@Injectable()
export class LedgerRepository {
  private escrowByTask: Record<string, EscrowBalance> = {};
  private revenueEntries: RevenueEntry[] = [];
  /** `${clientId}:${workerId}` -> lifetime billings, drives the worker fee tier. */
  private billingsByPair: Record<string, number> = {};
  private releasedMilestones = new Map<string, MilestoneRelease>();
  private paidAuditRequestIds = new Set<string>();
  private counter = 1;

  constructor() {
    this.resetToSeed();
  }

  generateId(): string {
    return 'rev_' + Date.now() + '_' + this.counter++;
  }

  // ── Escrow ────────────────────────────────────────────────────────────────
  getEscrow(taskId: string): EscrowBalance {
    if (!this.escrowByTask[taskId]) {
      this.escrowByTask[taskId] = { projectHeld: 0, auditHeld: 0 };
    }
    return this.escrowByTask[taskId];
  }

  addProjectHeld(taskId: string, delta: number): number {
    const e = this.getEscrow(taskId);
    e.projectHeld = round2(e.projectHeld + delta);
    return e.projectHeld;
  }

  addAuditHeld(taskId: string, delta: number): number {
    const e = this.getEscrow(taskId);
    e.auditHeld = round2(e.auditHeld + delta);
    return e.auditHeld;
  }

  allEscrow(): Record<string, EscrowBalance> {
    return this.escrowByTask;
  }

  /** Total value currently held across every task. */
  totalHeld(): number {
    return round2(
      Object.values(this.escrowByTask).reduce(
        (a, e) => a + e.projectHeld + e.auditHeld,
        0,
      ),
    );
  }

  // ── Revenue ───────────────────────────────────────────────────────────────
  recordRevenue(entry: Omit<RevenueEntry, 'id' | 'createdAt'>): RevenueEntry {
    const row: RevenueEntry = {
      id: this.generateId(),
      createdAt: new Date().toISOString().slice(0, 10),
      ...entry,
    };
    this.revenueEntries.push(row);
    return row;
  }

  getRevenue(): RevenueEntry[] {
    return this.revenueEntries;
  }

  totalRevenue(): number {
    return round2(this.revenueEntries.reduce((a, r) => a + r.amount, 0));
  }

  // ── Lifetime billings (worker fee tier) ───────────────────────────────────
  private pairKey(clientId: string, workerId: string) {
    return `${clientId}:${workerId}`;
  }

  getBillings(clientId: string, workerId: string): number {
    return this.billingsByPair[this.pairKey(clientId, workerId)] || 0;
  }

  addBillings(clientId: string, workerId: string, delta: number): number {
    const k = this.pairKey(clientId, workerId);
    this.billingsByPair[k] = round2((this.billingsByPair[k] || 0) + delta);
    return this.billingsByPair[k];
  }

  // ── Idempotency guards ────────────────────────────────────────────────────
  isMilestoneReleased(id: string): boolean {
    return this.releasedMilestones.has(id);
  }
  getMilestoneRelease(id: string): MilestoneRelease | null {
    const release = this.releasedMilestones.get(id);
    return release ? { ...release } : null;
  }
  markMilestoneReleased(id: string, release: MilestoneRelease): void {
    this.releasedMilestones.set(id, { ...release });
  }
  isAuditPaid(id: string): boolean {
    return this.paidAuditRequestIds.has(id);
  }
  markAuditPaid(id: string): void {
    this.paidAuditRequestIds.add(id);
  }

  /**
   * Rebuilds derived state from the seeded transaction ledger, so seeded
   * projects start with the escrow and billing history their rows imply.
   * Seed rows predate the fee model, so they contribute no revenue.
   */
  resetToSeed(): void {
    this.escrowByTask = {};
    this.revenueEntries = [];
    this.billingsByPair = {};
    this.releasedMilestones = new Map();
    this.paidAuditRequestIds = new Set();

    const clientOf: Record<string, string> = {};
    for (const t of SEED_TASKS) clientOf[t.id] = t.clientId;

    for (const tx of SEED_TRANSACTIONS) {
      if (!tx.taskId) continue;
      // Release rows record the NET paid out; the GROSS is what left escrow.
      const gross = tx.grossAmount ?? tx.amount;
      if (tx.type === 'escrow-lock') {
        this.addProjectHeld(tx.taskId, gross);
      } else if (tx.type === 'milestone-release') {
        this.addProjectHeld(tx.taskId, -gross);
        const clientId = clientOf[tx.taskId];
        if (clientId) this.addBillings(clientId, tx.toId, gross);
        if (tx.milestoneId) {
          const fee = tx.feeAmount || 0;
          this.markMilestoneReleased(tx.milestoneId, {
            workerId: tx.toId,
            amount: gross,
            fee,
            rate: gross > 0 ? Math.round((fee / gross) * 1000) / 10 : 0,
            net: tx.amount,
          });
        }
      } else if (tx.type === 'audit-escrow-lock') {
        this.addAuditHeld(tx.taskId, gross);
      } else if (tx.type === 'audit-release') {
        this.addAuditHeld(tx.taskId, -gross);
        if (tx.auditRequestId) this.markAuditPaid(tx.auditRequestId);
      }

      // Seeded rows that recorded a fee represent commission the platform
      // actually took. Without this they leave escrow but appear nowhere in
      // revenue, so the distribution cannot balance.
      if (tx.feeAmount !== undefined && tx.feeAmount > 0) {
        this.recordRevenue({
          feeType: (tx.feeType || 'worker-service') as FeeType,
          amount: tx.feeAmount,
          baseAmount: gross,
          rate: gross > 0 ? Math.round((tx.feeAmount / gross) * 1000) / 10 : 0,
          fromUserId: tx.toId,
          taskId: tx.taskId || null,
          milestoneId: tx.milestoneId || null,
        });
        this.revenueEntries[this.revenueEntries.length - 1].createdAt =
          tx.createdAt;
      }
    }
  }
}
