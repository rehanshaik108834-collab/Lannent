/** Ledger history only. No generic browser create endpoint exists. */
export type TransactionRecord = {
  id: string;
  type: string;
  amount: number;
  fromId: string;
  toId: string;
  taskId: string | null;
  milestoneId: string | null;
  description: string;
  status: string;
  createdAt: string;
  grossAmount?: number;
  feeAmount?: number;
  netAmount?: number;
  feeType?: string;
  auditRequestId?: string;
};
