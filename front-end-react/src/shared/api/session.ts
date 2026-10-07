import type { CurrentUser } from '../types/auth';

export const TOKEN_KEY = 'lannent_token';
export const SESSION_KEY = 'lannent_session';
export const SESSION_EXPIRED = 'lannent:session-expired';
let memoryToken = '';
let memoryOnly = false;

export function getToken(): string {
  if (memoryOnly) return memoryToken;
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return memoryToken;
  }
}

/** Keep legacy display keys compatible while supporting browsers with blocked storage. */
export function saveSession(user: CurrentUser, token: string): void {
  memoryToken = token;
  try {
    localStorage.setItem(TOKEN_KEY, token);
    memoryOnly = false;
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        userId: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        avatarColor: user.avatarColor,
      }),
    );
  } catch {
    memoryOnly = true;
  }
}

export function clearSession(): void {
  memoryToken = '';
  memoryOnly = false;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* No persistent storage is available. */
  }
}

export function reportExpiredSession(token: string): void {
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED, { detail: token }));
}
