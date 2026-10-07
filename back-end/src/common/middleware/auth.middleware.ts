import {
  Injectable,
  NestMiddleware,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { bearerToken } from '../security/bearer-token';
import { AuthService } from '../../modules/auth/auth.service';
import { getContext, shortId } from '../logging/request-context';

declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: string; role: string; email?: string; via: 'token' };
    /** What the caller actually sent, before a verified token overrode it. */
    claimed?: { role?: string; userId?: string };
  }
}

/** Resolves a verified bearer token to the current active account. No credential leaves the request anonymous. */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger('Auth');

  constructor(private readonly auth: AuthService) {}

  use(req: Request, res: Response, next: NextFunction) {
    req.claimed = { role: req.get('role'), userId: req.get('user-id') };

    const header = req.get('authorization') || '';
    if (header) {
      const token = bearerToken(header);
      const claims = token ? this.auth.verify(token) : null;

      if (!claims) {
        this.logger.warn(
          `[${shortId(req.id)}] rejected an invalid bearer token on ${req.method} ${req.originalUrl}`,
        );
        throw new UnauthorizedException(
          'That token is not valid or has expired. Sign in again to get a new one.',
        );
      }

      req.user = {
        id: claims.sub,
        role: claims.role,
        email: claims.email,
        via: 'token',
      };
      // The token is the authority, so the request is made to agree with it.
      // Twenty handlers across six controllers read identity from these two
      // headers; rewriting them here means a signed token beats whatever the
      // caller typed, everywhere, without each of those reads changing. The
      // originals stay on `req.claimed` so a mismatch is visible rather than
      // silently erased.
      if (
        (req.claimed.role && req.claimed.role !== claims.role) ||
        (req.claimed.userId && req.claimed.userId !== claims.sub)
      ) {
        this.logger.warn(
          `[${shortId(req.id)}] headers claimed ${req.claimed.userId ?? '-'}/${req.claimed.role ?? '-'} ` +
            `but the token says ${claims.sub}/${claims.role} — the token wins`,
        );
      }
      req.headers['role'] = claims.role;
      req.headers['user-id'] = claims.sub;
      this.syncContext(req);
      return next();
    }

    this.syncContext(req);
    next();
  }

  /** Keeps the log context aligned with whoever the token says this is. */
  private syncContext(req: Request) {
    const ctx = getContext();
    if (!ctx || !req.user) return;
    ctx.userId = req.user.id || ctx.userId;
    ctx.role = req.user.role || ctx.role;
  }
}
