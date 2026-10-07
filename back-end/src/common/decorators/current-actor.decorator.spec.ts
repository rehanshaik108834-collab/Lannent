import { UnauthorizedException } from '@nestjs/common';
import { verifiedActor } from './current-actor.decorator';
import { ALL_ROLES } from '../constants/roles';

describe('CurrentActor boundary', () => {
  it('returns the middleware account shape for every supported role', () => {
    for (const role of ALL_ROLES)
      expect(
        verifiedActor({
          id: 'u1',
          role,
          email: 'actor@example.test',
          password: 'never expose',
        }),
      ).toEqual({ id: 'u1', role, email: 'actor@example.test' });
  });
  it('rejects missing, malformed and unknown-role actors with 401', () => {
    for (const user of [
      undefined,
      null,
      {},
      { id: 1, role: 'client' },
      { id: '', role: 'client' },
      { id: 'u1', role: 'admin' },
    ])
      expect(() => verifiedActor(user)).toThrow(UnauthorizedException);
  });
});
