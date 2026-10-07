import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import express from 'express';
import type { Request, Response } from 'express';
import type { NestExpressApplication } from '@nestjs/platform-express';

export function isApiPath(path: string): boolean {
  return (
    path === '/api' ||
    path.startsWith('/api/') ||
    path === '/api-docs' ||
    path.startsWith('/api-docs/')
  );
}
export function isDocumentRequest(
  request: Pick<Request, 'path' | 'method' | 'headers'>,
): boolean {
  if (
    !['GET', 'HEAD'].includes(request.method) ||
    isApiPath(request.path) ||
    request.path === '/assets' ||
    request.path.startsWith('/assets/')
  )
    return false;
  if (request.path === '/' || request.path === '/index.html') return true;
  if (
    extname(request.path) &&
    !/^\/pages\/[a-z0-9-]+\.html$/.test(request.path)
  )
    return false;
  return request.headers.accept?.includes('text/html') ?? false;
}

/** Serve the React build, keeping APIs, Swagger, file streams and missing assets outside SPA fallback. */
export function configureFrontend(
  app: NestExpressApplication,
  directory = process.env.FRONTEND_DIST ||
    join(__dirname, '..', '..', '..', 'front-end-react', 'dist'),
): void {
  const root = resolve(directory);
  const entry = join(root, 'index.html');
  if (!existsSync(entry))
    throw new Error(
      `React build not found at ${entry}. Run npm run build:all from back-end before starting the server.`,
    );
  const connect = (process.env.FRONTEND_CONNECT_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      const url = new URL(value);
      if (!['https:', 'http:'].includes(url.protocol))
        throw new Error(
          'FRONTEND_CONNECT_ORIGINS must contain HTTP(S) origins.',
        );
      return url.origin;
    });
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    `connect-src 'self' ${connect.join(' ')}`,
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; ');
  const htmlHeaders = (res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', csp);
  };
  app.use(
    '/assets',
    express.static(join(root, 'assets'), {
      index: false,
      immutable: true,
      maxAge: '1y',
      dotfiles: 'deny',
    }),
  );
  const assets = express.static(root, {
    index: false,
    dotfiles: 'deny',
    setHeaders: (res, file) => {
      if (extname(file) === '.html') htmlHeaders(res);
    },
  });
  app.use((req: Request, res: Response, next: () => void) => {
    if (isApiPath(req.path)) return next();
    assets(req, res, next);
  });
  app.use((req: Request, res: Response, next: () => void) => {
    if (!isDocumentRequest(req)) return next();
    htmlHeaders(res);
    res.sendFile(entry);
  });
}
