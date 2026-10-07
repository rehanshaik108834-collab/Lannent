import { describe, it, expect, vi } from 'vitest';
import { ApiError, createApiClient } from './client';

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data }));
function setup(response = envelope({ id: 1 })) {
  const fetcher = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetcher);
  const expired = vi.fn();
  const client = createApiClient({
    origin: 'http://localhost:5173',
    token: () => 'test-token',
    onUnauthorized: expired,
  });
  return { client, fetcher, expired };
}
describe('API transport', () => {
  it('uses the same-origin API, unwraps data, and sends only bearer identity', async () => {
    const { client, fetcher } = setup();
    expect(await client.request('/users')).toEqual({ id: 1 });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('http://localhost:5173/api/users');
    expect(init.headers.get('Authorization')).toBe('Bearer test-token');
    expect(init.headers.has('x-lannent-session')).toBe(false);
    expect(init.headers.has('Content-Type')).toBe(false);
  });
  it('keeps public login requests free of bearer credentials', async () => {
    const { client, fetcher } = setup();
    await client.request('/auth/login', {
      method: 'POST',
      body: { email: 'a' },
      auth: false,
    });
    expect(fetcher.mock.calls[0][1].headers.has('Authorization')).toBe(false);
    expect(fetcher.mock.calls[0][1].body).toBe('{"email":"a"}');
  });
  it('retains error status and request ID and expires authenticated 401s', async () => {
    const { client, expired } = setup(
      new Response(JSON.stringify({ message: ['Expired'] }), {
        status: 401,
        headers: { 'X-Request-Id': 'r1' },
      }),
    );
    await expect(client.request('/auth/me')).rejects.toMatchObject({
      message: 'Expired',
      status: 401,
      requestId: 'r1',
    });
    expect(expired).toHaveBeenCalledWith('test-token');
  });
  it('does not expire another account when an old request returns 401', async () => {
    let token = 'first';
    const expired = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        token = 'second';
        return new Response('{}', { status: 401 });
      }),
    );
    const client = createApiClient({
      token: () => token,
      onUnauthorized: expired,
    });
    await expect(client.request('/auth/me')).rejects.toBeInstanceOf(ApiError);
    expect(expired).not.toHaveBeenCalled();
  });
  it('accepts empty responses and rejects malformed envelopes', async () => {
    const { client, fetcher } = setup(new Response(null, { status: 204 }));
    expect(
      await client.request('/notifications/1', { method: 'DELETE' }),
    ).toBeUndefined();
    fetcher.mockResolvedValueOnce(new Response('<html>error</html>'));
    await expect(client.request('/users')).rejects.toThrow('unreadable');
    fetcher.mockResolvedValueOnce(new Response('{}'));
    await expect(client.request('/users')).rejects.toThrow('unexpected');
  });
  it('keeps multipart boundaries browser-owned and application uploads public', async () => {
    const { client, fetcher } = setup();
    await client.uploadFile(new File(['content'], 'sample.txt'), {
      purpose: 'expert-application',
    });
    expect(fetcher.mock.calls[0][0]).toContain('/api/files/application');
    expect(fetcher.mock.calls[0][1].body).toBeInstanceOf(FormData);
    expect(fetcher.mock.calls[0][1].headers.has('Content-Type')).toBe(false);
    expect(fetcher.mock.calls[0][1].headers.has('Authorization')).toBe(false);
  });
  it('resolves stored file URLs without an environment variable and rejects external files', () => {
    const { client } = setup();
    expect(client.fileUrl('/api/files/f1')).toBe(
      'http://localhost:5173/api/files/f1',
    );
    expect(() => client.fileUrl({ name: 'missing' })).toThrow(
      'no stored download',
    );
    expect(() => client.fileUrl('https://elsewhere.test/api/files/f1')).toThrow(
      'valid stored download',
    );
  });
  it('prevents path escapes from sending credentials elsewhere', async () => {
    const { client, fetcher } = setup();
    await expect(client.request('/../outside')).rejects.toThrow(
      'configured API',
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('file downloads and explicit API origins', () => {
  it('uses a configured cross-origin base with bearer-only identity', async () => {
    const fetcher = vi.fn().mockResolvedValue(envelope([]));
    vi.stubGlobal('fetch', fetcher);
    const client = createApiClient({
      baseUrl: 'https://api.example.test/api/',
      token: () => 'token',
    });
    await client.request('/notifications?userId=u1');
    expect(fetcher.mock.calls[0][0]).toBe(
      'https://api.example.test/api/notifications?userId=u1',
    );
    expect([...fetcher.mock.calls[0][1].headers.keys()]).toEqual([
      'authorization',
    ]);
  });
  it('downloads authenticated bytes using the server filename and delays revocation', async () => {
    vi.useFakeTimers();
    const create = vi.fn().mockReturnValue('blob:test');
    const revoke = vi.fn();
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }),
    );
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    const { client, fetcher } = setup(
      new Response('file-content', {
        headers: { 'Content-Disposition': 'attachment; filename="report.txt"' },
      }),
    );
    try {
      await client.downloadFile({ name: 'old-name', url: '/api/files/f1' });
      expect(fetcher.mock.calls[0][1].headers.get('Authorization')).toBe(
        'Bearer test-token',
      );
      expect((click.mock.instances[0] as HTMLAnchorElement).download).toBe(
        'report.txt',
      );
      expect(create).toHaveBeenCalledOnce();
      expect(revoke).not.toHaveBeenCalled();
      vi.advanceTimersByTime(30_000);
      expect(revoke).toHaveBeenCalledWith('blob:test');
    } finally {
      vi.useRealTimers();
    }
  });
  it.each([403, 404])(
    'reports a %s file response without fabricating a download',
    async (status) => {
      const { client } = setup(
        new Response(JSON.stringify({ message: 'File unavailable' }), {
          status,
        }),
      );
      await expect(client.downloadFile('/api/files/f1')).rejects.toMatchObject({
        status,
        message: 'File unavailable',
      });
    },
  );
});
