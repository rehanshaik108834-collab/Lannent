import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/** Public routes are explicit exclusions; all other feature requests require verified bearer identity. */
@Injectable()
export class RequireAuthMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    if (!req.user || !req.user.role || req.user.via !== 'token') {
      throw new UnauthorizedException(
        'This endpoint requires you to be signed in. Send a valid bearer token.',
      );
    }
    next();
  }
}
