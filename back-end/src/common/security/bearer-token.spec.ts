import { bearerToken } from './bearer-token';
describe('Bearer credential syntax', () => {
  it('accepts one bearer credential', () => {
    expect(bearerToken('Bearer abc')).toBe('abc');
    expect(bearerToken('bearer abc')).toBe('abc');
  });
  it('rejects raw tokens, alternate schemes and multiple credentials', () => {
    for (const header of [
      undefined,
      '',
      'abc',
      'Basic abc',
      'Bearer abc def',
      'Bearer',
    ])
      expect(bearerToken(header)).toBeNull();
  });
});
