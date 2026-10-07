export type DisputeRecord = {
  id: string;
  taskId: string;
  milestoneId: string | null;
  raisedBy: string;
  againstId: string;
  status: string;
  reason: string;
  createdAt: string;
  expertId: string | null;
  verdict: string | null;
  resolution: string | null;
  resolvedAt: string | null;
  raisedByName?: string;
  againstName?: string;
  amount?: string;
  project?: string;
  milestone?: string;
  auditRequestId?: string;
  settlement?: DisputeSettlement | null;
};
export type DisputeSettlement = {
  kind: string;
  held?: number;
  release?: ReturnType<
    import('../ledger/payout-operations').PayoutOperations['releaseMilestone']
  > | null;
  refund?: { amount: number; balance: number } | null;
};
