import { getToken, reportExpiredSession } from './session';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status = 0,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean;
}

interface ClientOptions {
  baseUrl?: string;
  origin?: string;
  token?: () => string;
  onUnauthorized?: (token: string) => void;
}

export interface FileReference {
  id?: string;
  name: string;
  size?: number;
  mime?: string;
  url?: string;
}

function messageFrom(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object' || !('message' in body))
    return fallback;
  const message = body.message;
  if (Array.isArray(message))
    return (
      message.filter((item) => typeof item === 'string').join(', ') || fallback
    );
  return typeof message === 'string' && message ? message : fallback;
}

/** One transport for JSON and files. No UI state, navigation, or domain side effects live here. */
export function createApiClient(options: ClientOptions = {}) {
  const origin = options.origin || window.location.origin;
  const base = new URL(
    (options.baseUrl?.trim() || '/api').replace(/\/+$/, ''),
    origin,
  );
  if (
    !['http:', 'https:'].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  ) {
    throw new Error(
      'VITE_API_URL must be an HTTP(S) API URL or an absolute path such as /api.',
    );
  }
  const readToken = options.token || getToken;
  const onUnauthorized = options.onUnauthorized || reportExpiredSession;

  function endpoint(path: string): string {
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\'))
      throw new Error('API paths must start with a single slash.');
    const url = new URL(base.href.replace(/\/$/, '') + path);
    if (
      url.origin !== base.origin ||
      !url.pathname.startsWith(base.pathname.replace(/\/$/, '') + '/')
    ) {
      throw new Error('API path must stay inside the configured API.');
    }
    return url.href;
  }

  async function send(
    url: string,
    options: RequestOptions = {},
  ): Promise<Response> {
    const { body, auth = true, headers: suppliedHeaders, ...init } = options;
    const token = auth ? readToken() : '';
    const headers = new Headers(suppliedHeaders);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    let payload: BodyInit | undefined;
    if (body instanceof FormData) {
      payload = body;
      headers.delete('Content-Type');
    } else if (body !== undefined) {
      headers.set('Content-Type', 'application/json');
      payload = JSON.stringify(body);
    }
    let response: Response;
    try {
      response = await fetch(url, { ...init, headers, body: payload });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error;
      throw new ApiError(
        'The server could not be reached. Check your connection and try again.',
      );
    }
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      // Ignore a late 401 from an account that has already signed out or switched.
      if (response.status === 401 && token && readToken() === token)
        onUnauthorized(token);
      throw new ApiError(
        messageFrom(body, `Request failed (${response.status}).`),
        response.status,
        response.headers.get('X-Request-Id') || undefined,
      );
    }
    return response;
  }

  async function request<T>(
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const response = await send(endpoint(path), options);
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    if (!text) return undefined as T;
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new ApiError(
        'The server returned an unreadable response.',
        response.status,
      );
    }
    if (body && typeof body === 'object' && 'success' in body) {
      if (body.success !== true)
        throw new ApiError(
          messageFrom(body, 'The request was not completed.'),
          response.status,
        );
      if ('data' in body) return body.data as T;
    }
    throw new ApiError(
      'The server returned an unexpected response.',
      response.status,
    );
  }

  function fileUrl(reference: FileReference | string): string {
    const path = typeof reference === 'string' ? reference : reference.url;
    if (!path) throw new ApiError('This file has no stored download.');
    const url = new URL(path, base.origin);
    // Only credentialed API files belong in this helper. Never send tokens to external URLs.
    if (
      url.origin !== base.origin ||
      !url.pathname.startsWith(base.pathname.replace(/\/$/, '') + '/files/')
    ) {
      throw new ApiError('This file has no valid stored download.');
    }
    return url.href;
  }

  async function downloadFile(
    reference: FileReference | string,
    fallbackName?: string,
  ): Promise<void> {
    const response = await send(fileUrl(reference));
    await saveDownload(
      response,
      fallbackName ||
        (typeof reference === 'string' ? 'download' : reference.name),
    );
  }

  /** Authenticated API byte streams, such as compliance CSV exports. */
  async function download(path: string, filename: string): Promise<void> {
    await saveDownload(await send(endpoint(path)), filename);
  }

  async function saveDownload(
    response: Response,
    fallbackName: string,
  ): Promise<void> {
    const disposition = response.headers.get('Content-Disposition') || '';
    const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
    let filename = /filename="?([^";]+)/i.exec(disposition)?.[1];
    if (encoded) {
      try {
        filename = decodeURIComponent(encoded);
      } catch {
        /* Use plain filename. */
      }
    }
    const objectUrl = URL.createObjectURL(await response.blob());
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename || fallbackName;
    anchor.hidden = true;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Browsers may still read the blob after click returns.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
  }

  async function uploadFile(
    file: File,
    meta: {
      taskId?: string;
      milestoneId?: string;
      purpose?: 'deliverable' | 'expert-application';
    } = {},
  ): Promise<FileReference> {
    const form = new FormData();
    form.append('file', file);
    if (meta.taskId) form.append('taskId', meta.taskId);
    if (meta.milestoneId) form.append('milestoneId', meta.milestoneId);
    if (meta.purpose) form.append('purpose', meta.purpose);
    const application = meta.purpose === 'expert-application';
    return request(application ? '/files/application' : '/files', {
      method: 'POST',
      body: form,
      auth: !application,
    });
  }

  return { request, fileUrl, downloadFile, download, uploadFile };
}

export const api = createApiClient({ baseUrl: import.meta.env.VITE_API_URL });
