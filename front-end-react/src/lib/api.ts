// Compatibility entry point for contributors using the original helper location.
import { api } from '../shared/api/client';
export { ApiError } from '../shared/api/client';
export const apiGet = <T>(path: string) => api.request<T>(path);
export const apiPost = <T>(path: string, body?: unknown) =>
  api.request<T>(path, { method: 'POST', body });
export const apiPatch = <T>(path: string, body?: unknown) =>
  api.request<T>(path, { method: 'PATCH', body });
export const apiDelete = <T>(path: string) =>
  api.request<T>(path, { method: 'DELETE' });
export const { uploadFile, fileUrl, downloadFile } = api;
