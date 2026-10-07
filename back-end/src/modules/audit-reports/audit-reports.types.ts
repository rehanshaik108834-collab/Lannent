export type AuditReportRecord = {
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
  workerName?: string;
};
