import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApi } from '../src/configure-api';

/**
 * W2 authorization through the real HTTP contract (acceptance A03–A06).
 *
 * Every request carries a real bearer token for a seeded account. Each test
 * attempts what that account must not be able to do — act on someone else's
 * record, forge an identity field, write a protected field, or read another
 * account's private data — and checks the refusal and the unchanged state.
 */
describe('Authorization (W2: D04–D07, D16)', () => {
  let app: INestApplication;
  const tokens: Record<string, string> = {};

  const accounts = {
    client: ['client@gmail.com', 'Password@123'], // u1, owns t1–t4
    otherClient: ['bob@gmail.com', 'Password@123'], // u8, owns t5–t6
    worker: ['worker@gmail.com', 'Password@123'], // u2
    sarah: ['sarah@gmail.com', 'Password@123'], // u5, hired on t1
    expert: ['expert@gmail.com', 'Password@123'], // u3
    superuser: ['super@gmail.com', 'Superadmin@123'], // u4
    compliance: ['compliance@gmail.com', 'Compliance@123'], // u13
  } as const;
  type Who = keyof typeof accounts;

  const api = () => request(app.getHttpServer());
  const as = (who: Who) => ({ Authorization: `Bearer ${tokens[who]}` });
  const get = (who: Who, path: string) => api().get(`/api${path}`).set(as(who));
  const post = (who: Who, path: string, body: object = {}) =>
    api().post(`/api${path}`).set(as(who)).send(body);
  const patch = (who: Who, path: string, body: object = {}) =>
    api().patch(`/api${path}`).set(as(who)).send(body);
  const del = (who: Who, path: string) =>
    api().delete(`/api${path}`).set(as(who));
  const balanceOf = async (who: Who, id: string) =>
    (await get(who, `/users/${id}`).expect(200)).body.data.walletBalance;

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = fixture.createNestApplication();
    configureApi(app);
    await app.init();
    for (const [who, [email, password]] of Object.entries(accounts)) {
      const login = await api()
        .post('/api/auth/login')
        .send({ email, password })
        .expect(201);
      tokens[who] = login.body.data.token;
    }
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('D07: protected account fields', () => {
    it.each([
      ['walletBalance', 999999],
      ['status', 'suspended'],
      ['rating', 5],
      ['reviewsDone', 99],
      ['role', 'superuser'],
      ['email', 'someone-else@example.com'],
    ])('rejects a self-service change to %s', async (field, value) => {
      const before = (await get('client', '/users/u1').expect(200)).body.data;
      await patch('client', '/users/u1', { [field]: value }).expect(400);
      const after = (await get('client', '/users/u1').expect(200)).body.data;
      expect(after).toEqual(before);
    });

    it('accepts a profile edit that resends identity fields unchanged', async () => {
      const res = await patch('client', '/users/u1', {
        name: 'James Client',
        email: 'client@gmail.com',
        location: 'Bengaluru',
      }).expect(200);
      expect(res.body.data.location).toBe('Bengaluru');
    });

    it("refuses edits to another account's profile", async () => {
      await patch('worker', '/users/u1', { name: 'Hijacked' }).expect(403);
    });

    it('has no browser route that writes balances or transaction history', async () => {
      const before = await balanceOf('client', 'u1');
      await post('client', '/users/u1/wallet/deduct', { amount: 10 }).expect(
        404,
      );
      await post('client', '/transactions', {
        type: 'refund',
        amount: 5000,
        fromId: 'escrow',
        toId: 'u1',
      }).expect(404);
      expect(await balanceOf('client', 'u1')).toBe(before);
    });

    it('lets only operations change account status, never their own', async () => {
      await patch('client', '/users/u8/status', { status: 'suspended' }).expect(
        403,
      );
      await patch('superuser', '/users/u4/status', {
        status: 'suspended',
      }).expect(400);
      await patch('superuser', '/users/u10/status', {
        status: 'suspended',
      }).expect(200);
      await patch('superuser', '/users/u10/status', {
        status: 'active',
      }).expect(200);
    });
  });

  describe('D05: viewer-scoped reads', () => {
    it('shows other accounts as directory entries without private fields', async () => {
      const users = (await get('worker', '/users').expect(200)).body.data;
      const client = users.find((u: any) => u.id === 'u1');
      const self = users.find((u: any) => u.id === 'u2');
      expect(client).toMatchObject({ id: 'u1', name: 'James Client' });
      expect(client.email).toBeUndefined();
      expect(client.walletBalance).toBeUndefined();
      expect(client.password).toBeUndefined();
      expect(self.walletBalance).toEqual(expect.any(Number));
      expect(self.password).toBeUndefined();
    });

    it('returns only your own transactions, and refuses to name another account', async () => {
      const rows = (await get('worker', '/transactions').expect(200)).body.data;
      expect(rows.every((t: any) => t.fromId === 'u2' || t.toId === 'u2')).toBe(
        true,
      );
      await get('worker', '/transactions?userId=u1').expect(403);
      const all = (await get('compliance', '/transactions').expect(200)).body
        .data;
      expect(all.length).toBeGreaterThan(rows.length);
    });

    it('keeps notifications private, including mark-all-read', async () => {
      await get('worker', '/notifications?userId=u1').expect(403);
      await patch('worker', '/notifications/u1/read-all').expect(403);
      const own = (await get('worker', '/notifications').expect(200)).body.data;
      expect(own.every((n: any) => n.userId === 'u2')).toBe(true);
    });

    it('returns only your own conversations', async () => {
      const rows = (await get('worker', '/messages').expect(200)).body.data;
      expect(
        rows.every((m: any) => m.senderId === 'u2' || m.receiverId === 'u2'),
      ).toBe(true);
    });

    it('hides projects in progress from non-participants but keeps open ones discoverable', async () => {
      const ids = (
        await get('otherClient', '/tasks').expect(200)
      ).body.data.map((t: any) => t.id);
      expect(ids).toContain('t3'); // open
      expect(ids).not.toContain('t1'); // u1 and u5 only
      await get('otherClient', '/tasks/t1').expect(403);
      expect(
        (await get('otherClient', '/milestones?taskId=t1').expect(200)).body
          .data,
      ).toEqual([]);
      await get('otherClient', '/milestones/m3').expect(403);
    });

    it("refuses another project's escrow but shows your own", async () => {
      await get('otherClient', '/ledger/escrow/t1').expect(403);
      await get('client', '/ledger/escrow/t1').expect(200);
      await get('compliance', '/ledger/escrow/t1').expect(200);
    });

    it('returns only proposals you are party to', async () => {
      const rows = (await get('worker', '/proposals').expect(200)).body.data;
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((p: any) => p.workerId === 'u2')).toBe(true);
    });
  });

  describe('D04: record ownership on mutations', () => {
    it("refuses edits to another client's project and status writes by its owner", async () => {
      await patch('otherClient', '/tasks/t3', { title: 'Mine now' }).expect(
        403,
      );
      await patch('client', '/tasks/t3', { status: 'completed' }).expect(400);
      await patch('client', '/tasks/t3', { workerId: 'u2' }).expect(400);
      const res = await patch('client', '/tasks/t3', {
        title: 'API Integration Project',
        status: 'open',
      }).expect(200);
      expect(res.body.data.status).toBe('open');
    });

    it('creates projects for the signed-in client only', async () => {
      await post('client', '/tasks', {
        title: 'Forged',
        description: 'x',
        category: 'Web Development',
        budget: 100,
        clientId: 'u8',
      }).expect(400);
      const res = await post('client', '/tasks', {
        title: 'Own project',
        description: 'x',
        category: 'Web Development',
        budget: 100,
      }).expect(201);
      expect(res.body.data).toMatchObject({
        clientId: 'u1',
        currency: 'INR',
        status: 'open',
      });
    });

    it('takes proposal authorship from the token and lets only the owner hire', async () => {
      await post('worker', '/proposals', {
        taskId: 't3',
        workerId: 'u5',
        bidPrice: '₹900',
      }).expect(400);
      const created = await post('worker', '/proposals', {
        taskId: 't3',
        bidPrice: '₹900',
        rating: 5,
      }).expect(201);
      const proposal = created.body.data;
      expect(proposal).toMatchObject({
        workerId: 'u2',
        workerName: 'Alex Worker',
        status: 'pending',
      });
      expect(proposal.rating).not.toBe(5); // taken from the worker's account, not the body

      await post('worker', '/proposals', { taskId: 't3' }).expect(409); // duplicate
      await post('otherClient', `/proposals/${proposal.id}/hire`).expect(403);
      await patch('otherClient', `/proposals/${proposal.id}`, {
        status: 'rejected',
      }).expect(403);
      await patch('worker', '/proposals/p1', { status: 'withdrawn' }).expect(
        403,
      ); // Sarah's
      await patch('worker', `/proposals/${proposal.id}`, {
        status: 'withdrawn',
      }).expect(200);
    });

    it('refuses milestone edits from outsiders and workflow writes from the worker', async () => {
      await patch('otherClient', '/milestones/m3', { title: 'x' }).expect(403);
      await patch('sarah', '/milestones/m3', { budget: 1 }).expect(400);
      // A worker may only *start* work; finishing goes through submit/approve.
      await patch('sarah', '/milestones/m3', { status: 'completed' }).expect(
        409,
      );
      await patch('sarah', '/milestones/m3', { progress: 70 }).expect(200);
      await post('otherClient', '/milestones', {
        taskId: 't3',
        title: 'x',
        budget: 10,
      }).expect(403);
    });

    it('lets only project parties dispute, message, or fund audits', async () => {
      await post('otherClient', '/disputes', {
        taskId: 't1',
        milestoneId: 'm4',
        reason: 'x',
      }).expect(403);
      await post('otherClient', '/messages', {
        taskId: 't1',
        receiverId: 'u5',
        content: 'hi',
      }).expect(403);
      await post('client', '/messages', {
        taskId: 't1',
        senderId: 'u5',
        receiverId: 'u5',
        content: 'forged',
      }).expect(400);
      const sent = await post('client', '/messages', {
        taskId: 't1',
        receiverId: 'u5',
        content: 'hello',
      }).expect(201);
      expect(sent.body.data).toMatchObject({
        senderId: 'u1',
        senderName: 'James Client',
      });

      const before = await balanceOf('client', 'u1');
      await post('otherClient', '/audit-requests/ar1/fund').expect(403);
      await post('expert', '/audit-requests/ar1/offers', {
        amount: 10,
        offeredBy: 'client',
      }).expect(400);
      await post('superuser', '/audit-requests/ar1/accept').expect(403);
      expect(await balanceOf('client', 'u1')).toBe(before);
    });
  });

  describe('D06: deleting projects never refunds a budget', () => {
    it('deletes an unfunded open project without moving money', async () => {
      const created = await post('client', '/tasks', {
        title: 'Throwaway',
        description: 'x',
        category: 'Web Development',
        budget: 5000,
      }).expect(201);
      const before = await balanceOf('client', 'u1');
      const res = await del('client', `/tasks/${created.body.data.id}`).expect(
        200,
      );
      expect(res.body.data).toMatchObject({ deleted: true, refunded: 0 });
      expect(await balanceOf('client', 'u1')).toBe(before);
    });

    it("refuses to delete started or funded work, or another client's project", async () => {
      await del('client', '/tasks/t1').expect(409);
      await del('otherClient', '/tasks/t3').expect(403);
    });
  });

  describe('D16: INR only', () => {
    it('rejects other currencies and sub-paisa amounts', async () => {
      const base = {
        title: 'x',
        description: 'x',
        category: 'Web Development',
      };
      await post('client', '/tasks', {
        ...base,
        budget: 100,
        currency: 'USD',
      }).expect(400);
      await post('client', '/tasks', { ...base, budget: 100.005 }).expect(400);
    });
  });
});
