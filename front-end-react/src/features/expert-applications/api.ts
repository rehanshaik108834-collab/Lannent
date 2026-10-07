import { api } from '../../shared/api/client';
import type {
  ExpertApplication,
  FileReference,
} from '../../shared/types/domain';

/** Wire adapters for Expert Reviewer applications. Submitting and uploading are public. */

export interface ApplicationInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  country?: string;
  expertise?: string;
  experience?: string;
  linkedin?: string;
  github?: string;
  motivation?: string;
  resumeFile?: FileReference;
  certificateFile?: FileReference;
}

export const submitApplication = (input: ApplicationInput) =>
  api.request<ExpertApplication>('/expert-applications', {
    method: 'POST',
    body: input,
    auth: false,
  });

/** Public upload for a résumé or certificate; only intake can open it afterwards. */
export const uploadApplicationDocument = (file: File) =>
  api.uploadFile(file, { purpose: 'expert-application' });

export const listApplications = () =>
  api.request<ExpertApplication[]>('/expert-applications');

/** Intake decision. Approval creates the expert account with the applicant's own password. */
export const decideApplication = (
  id: string,
  status: 'approved' | 'rejected',
) =>
  api.request<ExpertApplication>(
    `/expert-applications/${encodeURIComponent(id)}/status`,
    {
      method: 'PATCH',
      body: { status },
    },
  );
