import { NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthService current account validation', () => {
  const jwt = new JwtService({
    secret: 'test-only-auth-secret-that-is-long-enough',
  });
  let account: {
    id: string;
    role: string;
    email: string;
    status: string;
    password: string;
  };
  let service: AuthService;
  let token: string;

  beforeEach(() => {
    account = {
      id: 'u1',
      role: 'client',
      email: 'client@example.test',
      status: 'active',
      password: 'private-hash',
    };
    const users = {
      findById: jest.fn(() => {
        if (account.status === 'deleted') throw new NotFoundException();
        return account;
      }),
    } as unknown as UsersService;
    service = new AuthService(jwt, users);
    token = jwt.sign({ sub: 'u1', role: 'client', email: account.email });
  });

  it('restores a real active account without exposing its password', () => {
    expect(service.whoami(token)).toEqual({
      valid: true,
      user: {
        id: 'u1',
        role: 'client',
        email: account.email,
        status: 'active',
      },
    });
  });

  it('rejects a token after its account is suspended', () => {
    account.status = 'suspended';
    expect(service.verify(token)).toBeNull();
    expect(service.whoami(token)).toEqual({ valid: false, user: null });
  });

  it('rejects deleted accounts without leaking a lookup error', () => {
    account.status = 'deleted';
    expect(service.verify(token)).toBeNull();
    expect(service.whoami(token)).toEqual({ valid: false, user: null });
  });

  it('uses the current account role instead of stale token privileges', () => {
    account.role = 'worker';
    expect(service.verify(token)?.role).toBe('worker');
  });

  it('rejects expired, forged, malformed, and unknown-role credentials', () => {
    expect(
      service.verify(jwt.sign({ sub: 'u1' }, { expiresIn: -1 })),
    ).toBeNull();
    expect(service.verify('not-a-token')).toBeNull();
    expect(service.verify(jwt.sign({ sub: 123 }))).toBeNull();
    account.role = 'unknown';
    expect(service.verify(token)).toBeNull();
  });
});
