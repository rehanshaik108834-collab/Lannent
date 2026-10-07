export type TaskStatus =
  | 'draft'
  | 'open'
  | 'in-progress'
  | 'completed'
  | 'cancelled'
  | 'terminated';
/** Monetary fields are public INR rupees; ledger calculations use integer paise. */
export type TaskRecord = {
  id: string;
  title: string;
  description: string;
  category: string;
  budget: number;
  currency: string;
  deadline?: string;
  skills: string[];
  clientId: string;
  workerId: string | null;
  status: TaskStatus;
  auditEnabled: boolean;
  progress: number;
  createdAt: string;
  auditExpertId?: string;
  auditFee?: number;
  auditDomain?: string;
  /** Set when a party asks to end the contract; work is blocked from then on. */
  terminationRequest?: TerminationRequest;
  /** Recorded once, when the contract is actually ended and money returned. */
  termination?: TerminationSettlement;
};

export type TerminationRequest = {
  requestedBy: string;
  reason: string;
  requestedAt: string;
};

export type TerminationSettlement = {
  finalizedAt: string;
  /** Project escrow returned to the client, INR. */
  projectRefunded: number;
  /** Unpaid audit escrow returned to the client, INR. */
  auditRefunded: number;
  cancelledMilestoneIds: string[];
  closedEngagementIds: string[];
};
