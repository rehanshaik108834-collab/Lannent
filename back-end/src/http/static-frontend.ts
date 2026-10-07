import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import express from 'express';
import type { Request, Response } from 'express';
import type { NestExpressApplication } from '@nestjs/platform-express';

/**
 * Serve the original static UI (`front-end/`) from the API, as the app did
 * before the React rebuild. Same origin as `/api`, so no CORS round trips.
 *
 * No document CSP here: the static pages rely on inline scripts and handlers.
 */
export function configureStaticFrontend(
  app: NestExpressApplication,
  directory = process.env.STATIC_FRONTEND_DIR ||
    join(__dirname, '..', '..', '..', 'front-end'),
): void {
  const root = resolve(directory);
  if (!existsSync(join(root, 'index.html')))
    throw new Error(`Static frontend not found at ${root}.`);
  app.useStaticAssets(root, {
    index: ['index.html'],
    extensions: ['html'],
    dotfiles: 'deny',
  });
}

/** The URLs of the original UI: "/", "/index.html" and "/pages/<name>[.html]". */
export function isClassicPagePath(path: string): boolean {
  return (
    path === '/' ||
    path === '/index.html' ||
    /^\/pages\/[a-z0-9-]+(\.html)?$/.test(path)
  );
}

/**
 * Serve `front-end-classic/` — the React port of the original UI — at the
 * original URLs. Built assets are served as files; every original page URL
 * returns the app shell, which renders that page. Anything else (API, Swagger,
 * stored files, unknown paths) is left to the routes after this.
 *
 * Returns false when there is no build, so the caller can fall back.
 */
export function configureClassicFrontend(
  app: NestExpressApplication,
  directory = process.env.CLASSIC_FRONTEND_DIST ||
    join(__dirname, '..', '..', '..', 'front-end-classic', 'dist'),
): boolean {
  const root = resolve(directory);
  const entry = join(root, 'index.html');
  if (!existsSync(entry)) return false;

  app.use(
    '/assets',
    express.static(join(root, 'assets'), {
      index: false,
      immutable: true,
      maxAge: '1y',
      dotfiles: 'deny',
    }),
  );
  app.use((req: Request, res: Response, next: () => void) => {
    if (!['GET', 'HEAD'].includes(req.method) || !isClassicPagePath(req.path))
      return next();
    // The shell must never be cached, or a deploy would keep serving stale
    // asset names.
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(entry);
  });
  return true;
}
