import type { FileReference } from '../files/files.types';
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
  /** Unfinished work closed by a project termination. */
  | 'cancelled';
export type Deliverable = {
  title?: string;
  description?: string;
  link?: string;
  branch?: string;
  files?: FileReference[];
};
export type MilestoneRecord = {
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
  revisionReason?: string;
  revisionRequest?: {
    reason: string;
    requestedAt: string;
    requestedBy?: string;
  };
};
