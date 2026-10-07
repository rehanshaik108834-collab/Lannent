import type { FileReference } from '../files/files.types';
export interface ExpertApplicationRecord {
  id: string;
  name: string;
  email: string;
  status: string;
  appliedAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  password?: string;
  accountId?: string | null;
  phone?: string;
  phoneCountry?: string;
  country?: string;
  expertise?: string;
  experience?: string;
  linkedin?: string;
  github?: string;
  motivation?: string;
  resumeName?: string;
  certificateName?: string;
  resumeFile?: FileReference | null;
  certificateFile?: FileReference | null;
}
