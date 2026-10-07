export interface FileReference {
  id?: string;
  name: string;
  size?: number;
  mime?: string;
  url?: string;
  uploadedBy?: string | null;
}
export interface FileRecord {
  id: string;
  name: string;
  storedName: string;
  size: number;
  mime: string;
  uploadedBy: string | null;
  taskId: string | null;
  milestoneId: string | null;
  purpose: string | null;
  createdAt: string;
}
