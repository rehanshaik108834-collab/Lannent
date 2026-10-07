/** Exactly one bearer credential; raw JWTs and alternative schemes are refused. */
export function bearerToken(header?: string): string | null {
  return /^Bearer\s+(\S+)$/i.exec(header?.trim() || '')?.[1] || null;
}
