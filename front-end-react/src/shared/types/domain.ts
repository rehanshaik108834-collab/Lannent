/**
 * API record shapes used by the marketplace screens.
 *
 * They mirror the backend's `*.types.ts` records and the projections the API
 * returns (see documentation/11-w2-implementation.md). Money fields are INR
 * rupees with at most two decimals; the server does all arithmetic.
 * "Project" in the UI is a `task` on the wire (`taskId` relationships).
 */

export type ProjectStatus =
  'draft' | 'open' | 'in-progress' | 'completed' | 'cancelled' | 'terminated';

export interface Project {
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
  status: ProjectStatus;
  auditEnabled: boolean;
  progress: number;
  createdAt: string;
  auditExpertId?: string;
  terminationRequest?: {
    requestedBy: string;
    reason: string;
    requestedAt: string;
  };
  termination?: TerminationSettlement;
}

export type MilestoneStatus =
  | 'pending'
  | 'in-progress'
  | 'submitted'
  | 'review'
  | 'completed'
  | 'approved'
  | 'disputed'
  | 'audit-passed'
  | 'revision-needed'
  | 'cancelled';

export interface FileReference {
  id?: string;
  name: string;
  size?: number;
  mime?: string;
  url?: string;
}

export interface Deliverable {
  title?: string;
  description?: string;
  link?: string;
  branch?: string;
  files?: FileReference[];
}

export interface Milestone {
  id: string;
  taskId: string;
  title: string;
  description: string;
  budget: number;
  status: MilestoneStatus;
  submittedAt: string | null;
  approvedAt: string | null;
  deliverable: Deliverable | null;
  workerId: string | null;
  dueDate: string | null;
  priority: string;
  progress: number;
  revisionRequest?: { reason: string; requestedAt: string };
}

export interface MilestoneRelease {
  alreadyReleased: boolean;
  amount: number;
  fee: number;
  rate?: number;
  net: number;
}

export type ProposalStatus = 'pending' | 'hired' | 'rejected' | 'withdrawn';

export interface Proposal {
  id: string;
  taskId: string;
  workerId: string;
  createdAt: string;
  status: ProposalStatus;
  type: 'proposal' | 'invitation';
  workerName?: string;
  avatar?: string;
  avatarColor?: string;
  rating?: number;
  location?: string;
  bidPrice?: string;
  timeline?: string;
  coverLetter?: string;
  skills?: string[];
  completedProjects?: number;
}

/** Another account as the directory shows it: no email, phone or balance. */
export interface DirectoryUser {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  avatarColor?: string;
  status?: string;
  location?: string;
  skills?: string[];
  rating?: number;
  completedProjects?: number;
  jobTitle?: string;
  experienceLevel?: string;
  hourlyRate?: number;
  availability?: unknown;
  bio?: string;
  company?: string;
  specialization?: string;
  domains?: string[];
  reviewsDone?: number;
}

/** Your own account (or an oversight read): includes private fields. */
export interface Account extends DirectoryUser {
  email: string;
  walletBalance: number;
}

export interface Transaction {
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
}

/** Deposit/withdrawal result, as returned by the ledger. */
export interface WalletMovement {
  gross: number;
  fee: number;
  net: number;
  balance: number;
}

export interface Message {
  id: string;
  taskId: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
  senderName?: string;
}

// ── W4: audits, reports, disputes, termination, applications ──────────────

export type AuditStatus =
  | 'preview-sent'
  | 'negotiating'
  | 'agreed'
  | 'escrow-funded'
  | 'in-progress'
  | 'report-submitted'
  | 'paid'
  | 'declined'
  | 'cancelled';

export interface AuditOffer {
  id: string;
  offeredBy: 'client' | 'expert';
  amount: number;
  note: string;
  status: 'pending' | 'countered' | 'accepted';
  createdAt: string;
}

export interface AuditProgress {
  total: number;
  audited: number;
  auditedMilestoneIds: string[];
  awaitingReviewMilestoneIds: string[];
  pendingMilestoneIds: string[];
  complete: boolean;
}

/** An expert engagement: a project technical audit or a dispute arbitration. */
export interface AuditEngagement {
  id: string;
  kind: 'project-audit' | 'dispute-audit';
  taskId: string;
  clientId: string;
  expertId: string | null;
  workerId?: string | null;
  milestoneId?: string | null;
  disputeId?: string | null;
  status: AuditStatus;
  agreedAmount: number | null;
  offers: AuditOffer[];
  auditedMilestoneIds: string[];
  feePaid?: boolean;
  project?: string;
  milestone?: string;
  severity?: string;
  createdAt: string;
  auditProgress?: AuditProgress;
}

export interface AuditPreview {
  auditRequest: AuditEngagement;
  kind: AuditEngagement['kind'];
  project: Pick<
    Project,
    | 'id'
    | 'title'
    | 'description'
    | 'category'
    | 'budget'
    | 'deadline'
    | 'skills'
    | 'status'
    | 'progress'
  > | null;
  client: { id: string; name: string; company?: string } | null;
  worker: {
    id: string;
    name: string;
    rating?: number;
    skills?: string[];
  } | null;
  milestones: Pick<
    Milestone,
    'id' | 'title' | 'description' | 'budget' | 'status' | 'deliverable'
  >[];
  focusMilestone: Milestone | null;
  dispute: {
    id: string;
    reason: string;
    raisedByName?: string;
    againstName?: string;
    amount?: string;
    status: string;
  } | null;
  offers: AuditOffer[];
  agreedAmount: number | null;
}

export interface AuditReport {
  id: string;
  auditRequestId: string;
  taskId: string;
  expertId: string;
  createdAt: string;
  milestoneId?: string | null;
  verdict?: string;
  overall?: string;
  findings?: string;
  codequality?: number;
  security?: number;
  performance?: number;
  documentation?: number;
  milestoneTitle?: string;
  projectTitle?: string;
}

export type ReportPayout =
  | {
      pending: true;
      reason: string;
      audited: number;
      total: number;
      remaining: string[];
    }
  | {
      pending?: false;
      alreadyPaid: boolean;
      amount: number;
      fee: number;
      net: number;
    };

export type DisputeVerdict = 'client-favour' | 'worker-favour' | 'split';

export interface Dispute {
  id: string;
  taskId: string;
  milestoneId: string | null;
  raisedBy: string;
  againstId: string;
  status: 'open' | 'resolved' | string;
  reason: string;
  createdAt: string;
  expertId: string | null;
  verdict: DisputeVerdict | null;
  resolution: string | null;
  resolvedAt: string | null;
  raisedByName?: string;
  againstName?: string;
  amount?: string;
  project?: string;
  milestone?: string;
  auditRequestId?: string;
  settlement?: {
    kind: 'funded-rework' | 'paid' | 'split';
    held?: number;
    release?: MilestoneRelease | null;
    refund?: { amount: number } | null;
  } | null;
}

export interface TerminationSettlement {
  finalizedAt: string;
  projectRefunded: number;
  auditRefunded: number;
  cancelledMilestoneIds: string[];
  closedEngagementIds: string[];
}

export type TerminationResult =
  | {
      state: 'pending';
      blockingMilestoneIds: string[];
      activeDisputeIds: string[];
      task: Project;
    }
  | { state: 'finalized'; termination: TerminationSettlement; task: Project };

export interface ExpertApplication {
  id: string;
  name: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  accountId?: string | null;
  phone?: string;
  country?: string;
  expertise?: string;
  experience?: string;
  linkedin?: string;
  github?: string;
  motivation?: string;
  resumeFile?: FileReference | null;
  certificateFile?: FileReference | null;
}
