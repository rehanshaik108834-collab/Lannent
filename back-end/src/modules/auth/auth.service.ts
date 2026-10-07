import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { ALL_ROLES } from '../../common/constants/roles';
import { JWT_EXPIRES_IN } from '../../common/security/jwt.config';

export interface TokenClaims {
  sub: string;
  role: string;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService,
  ) {}

  /**
   * Authenticates and issues a token.
   *
   * Delegates the credential check to `UsersService.login`, so the rules that
   * refuse a suspended account or a wrong password live in one place.
   */
  login(email: string, password: string) {
    const { user, session } = this.users.login(email, password);
    const claims: TokenClaims = {
      sub: user.id,
      role: user.role,
      email: user.email,
    };
    const { password: _omit, ...safeUser } = user;

    return {
      token: this.jwt.sign(claims),
      expiresIn: JWT_EXPIRES_IN,
      user: safeUser,
      session,
    };
  }

  /** Verifies a token, returning its claims or null. Never throws. */
  verify(token: string): TokenClaims | null {
    try {
      const claims = this.jwt.verify<TokenClaims>(token);
      if (typeof claims.sub !== 'string' || !claims.sub) return null;
      const user = this.users.findById(claims.sub);
      if (!user || user.status !== 'active' || !ALL_ROLES.includes(user.role))
        return null;
      // Account changes take effect immediately, without waiting for token expiry.
      return { sub: user.id, role: user.role, email: user.email };
    } catch {
      return null;
    }
  }

  /** Confirms a token is still good and reports who it belongs to. */
  whoami(token: string) {
    const claims = this.verify(token);
    if (!claims) return { valid: false, user: null };
    const user = this.users.findById(claims.sub);
    const { password: _omit, ...safeUser } = user;
    return { valid: true, user: user ? safeUser : null };
  }
}
