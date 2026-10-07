import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApi } from '../src/configure-api';

/**
 * W3 exit criterion: the unaudited marketplace flow through the real HTTP
 * contract — create → hire → submit → approve → payout — with ownership and
 * rollback checks. Fresh client accounts keep fee tiers and balances
 * deterministic (no seeded billing history between client and worker).
 */
describe('Marketplace vertical flow (W3)', () => {
  let app: INestApplication;
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  const stamp = Date.now();

  const api = () => request(app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const get = (who: string, path: string) =>
    api().get(`/api${path}`).set(as(who));
  const post = (who: string, path: string, body: object = {}) =>
    api().post(`/api${path}`).set(as(who)).send(body);
  const patch = (who: string, path: string, body: object = {}) =>
    api().patch(`/api${path}`).set(as(who)).send(body);
  const balance = async (who: string) =>
    (await get(who, `/users/${ids[who]}`).expect(200)).body.data.walletBalance;
  const escrow = async (who: string, taskId: string) =>
    (await get(who, `/ledger/escrow/${taskId}`).expect(200)).body.data
      .projectHeld;

  async function signIn(who: string, email: string, password: string) {
    const login = await api()
      .post('/api/auth/login')
      .send({ email, password })
      .expect(201);
    tokens[who] = login.body.data.token;
    ids[who] = login.body.data.user.id;
  }

  async function newClient(who: string) {
    const email = `${who}-${stamp}@example.test`;
    await api()
      .post('/api/users')
      .send({
        name: `W3 ${who}`,
        email,
        password: 'Client!2026',
        role: 'client',
      })
      .expect(201);
    await signIn(who, email, 'Client!2026');
  }

  const project = (overrides: object = {}) => ({
    title: 'Checkout redesign',
    description: 'Redesign the checkout flow end to end.',
    category: 'Web Development',
    budget: 1000,
    milestones: [
      { title: 'Design', budget: 600 },
      { title: 'Build', budget: 400 },
    ],
    ...overrides,
  });

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = fixture.createNestApplication();
    configureApi(app);
    await app.init();
    await newClient('client');
    await newClient('poorClient');
    await signIn('worker', 'worker@gmail.com', 'Password@123'); // u2
    await signIn('otherWorker', 'sarah@gmail.com', 'Password@123'); // u5
    await signIn('otherClient', 'bob@gmail.com', 'Password@123'); // u8
    await post('client', `/users/${ids.client}/wallet/add`, {
      amount: 5000,
    }).expect(201);
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('creating a project', () => {
    it('creates nothing when milestones do not add up to the budget', async () => {
      const res = await post(
        'client',
        '/tasks',
        project({ milestones: [{ title: 'Design', budget: 600 }] }),
      ).expect(400);
      expect(res.body.message).toContain('must match exactly');
      expect(
        (await get('client', `/tasks?clientId=${ids.client}`).expect(200)).body
          .data,
      ).toEqual([]);
    });

    it('creates nothing when an audit reviewer is invalid', async () => {
      await post(
        'client',
        '/tasks',
        project({ auditEnabled: true, auditExpertId: 'nobody' }),
      ).expect(400);
      expect(
        (await get('client', `/tasks?clientId=${ids.client}`).expect(200)).body
          .data,
      ).toEqual([]);
    });

    it('creates the project and its milestones together', async () => {
      const res = await post('client', '/tasks', project()).expect(201);
      ids.task = res.body.data.id;
      expect(res.body.data).toMatchObject({
        status: 'open',
        clientId: ids.client,
        currency: 'INR',
      });
      expect(
        res.body.data.milestones.map((m: any) => [m.title, m.budget, m.status]),
      ).toEqual([
        ['Design', 600, 'pending'],
        ['Build', 400, 'pending'],
      ]);
      [ids.m1, ids.m2] = res.body.data.milestones.map((m: any) => m.id);
    });
  });

  describe('hiring', () => {
    it('lets only the owner hire, then funds escrow and assigns the worker', async () => {
      const mine = await post('worker', '/proposals', {
        taskId: ids.task,
        bidPrice: '₹1000',
        timeline: '2 weeks',
        coverLetter: 'I build checkout flows.',
      }).expect(201);
      const theirs = await post('otherWorker', '/proposals', {
        taskId: ids.task,
        bidPrice: '₹950',
        timeline: '3 weeks',
        coverLetter: 'Happy to help with this.',
      }).expect(201);

      await post('otherClient', `/proposals/${mine.body.data.id}/hire`).expect(
        403,
      );

      const before = await balance('client');
      await post('client', `/proposals/${mine.body.data.id}/hire`).expect(201);
      // ₹1,000 budget + 5% marketplace (₹50) + ₹4.99 initiation for the ₹500–₹2,000 band.
      expect(await balance('client')).toBeCloseTo(before - 1054.99, 2);
      expect(await escrow('client', ids.task)).toBe(1000);

      const task = (await get('client', `/tasks/${ids.task}`).expect(200)).body
        .data;
      expect(task).toMatchObject({
        status: 'in-progress',
        workerId: ids.worker,
      });
      const others = (
        await get('otherWorker', `/proposals?taskId=${ids.task}`).expect(200)
      ).body.data;
      expect(others.find((p: any) => p.id === theirs.body.data.id).status).toBe(
        'rejected',
      );
      const milestones = (
        await get('worker', `/milestones?taskId=${ids.task}`).expect(200)
      ).body.data;
      expect(milestones.every((m: any) => m.workerId === ids.worker)).toBe(
        true,
      );
    });

    it('rolls back a hire the client cannot afford', async () => {
      const created = await post(
        'poorClient',
        '/tasks',
        project({ budget: 100, milestones: [{ title: 'All', budget: 100 }] }),
      ).expect(201);
      const taskId = created.body.data.id;
      const proposal = await post('worker', '/proposals', {
        taskId,
        bidPrice: '₹100',
        timeline: '1 week',
        coverLetter: 'Small and quick task.',
      }).expect(201);

      await post(
        'poorClient',
        `/proposals/${proposal.body.data.id}/hire`,
      ).expect(400);
      expect(await balance('poorClient')).toBe(0);
      expect(await escrow('poorClient', taskId)).toBe(0);
      expect(
        (await get('poorClient', `/tasks/${taskId}`).expect(200)).body.data,
      ).toMatchObject({ status: 'open', workerId: null });
      const after = (
        await get('worker', `/proposals?taskId=${taskId}`).expect(200)
      ).body.data;
      expect(after[0].status).toBe('pending');
    });
  });

  describe('delivery and payout', () => {
    it('refuses submissions from a worker who is not assigned', async () => {
      await post('otherWorker', `/milestones/${ids.m1}/submit`, {
        deliverable: { description: 'Not my work at all.' },
      }).expect(403);
    });

    it('pays the first milestone once, net of the worker fee', async () => {
      await patch('worker', `/milestones/${ids.m1}`, {
        status: 'in-progress',
      }).expect(200);
      await post('worker', `/milestones/${ids.m1}/submit`, {
        deliverable: {
          description: 'Figma file and design notes.',
          link: 'https://example.com/design',
        },
      }).expect(201);
      await post('otherClient', `/milestones/${ids.m1}/approve`).expect(403);

      const before = await balance('worker');
      const approved = await post(
        'client',
        `/milestones/${ids.m1}/approve`,
      ).expect(201);
      // First release between this pair: 20% tier.
      expect(approved.body.data.release).toMatchObject({
        alreadyReleased: false,
        amount: 600,
        fee: 120,
        net: 480,
      });
      expect(await balance('worker')).toBeCloseTo(before + 480, 2);
      expect(await escrow('client', ids.task)).toBe(400);
      expect(
        (await get('client', `/tasks/${ids.task}`).expect(200)).body.data
          .progress,
      ).toBe(50);
    });

    it('keeps money held through a revision, then completes the project', async () => {
      await patch('worker', `/milestones/${ids.m2}`, {
        status: 'in-progress',
      }).expect(200);
      await post('worker', `/milestones/${ids.m2}/submit`, {
        deliverable: { description: 'Implemented the checkout.' },
      }).expect(201);
      await post('client', `/milestones/${ids.m2}/request-revision`, {
        reason: 'Coupon codes are ignored.',
      }).expect(201);
      expect(await escrow('client', ids.task)).toBe(400);

      await patch('worker', `/milestones/${ids.m2}`, {
        status: 'in-progress',
      }).expect(200);
      await post('worker', `/milestones/${ids.m2}/submit`, {
        deliverable: { description: 'Coupons now apply at checkout.' },
      }).expect(201);
      const before = await balance('worker');
      const approved = await post(
        'client',
        `/milestones/${ids.m2}/approve`,
      ).expect(201);
      // Lifetime billings are now ₹600, so the 10% tier applies.
      expect(approved.body.data.release).toMatchObject({
        amount: 400,
        fee: 40,
        net: 360,
      });
      expect(await balance('worker')).toBeCloseTo(before + 360, 2);
      expect(await escrow('client', ids.task)).toBe(0);
      expect(
        (await get('client', `/tasks/${ids.task}`).expect(200)).body.data,
      ).toMatchObject({ status: 'completed', progress: 100 });

      const workerBalance = await balance('worker');
      const replay = await post(
        'client',
        `/milestones/${ids.m2}/approve`,
      ).expect(201);
      expect(replay.body.data.release.alreadyReleased).toBe(true);
      expect(await balance('worker')).toBe(workerBalance);
    });

    it("records the payouts in each party's own history", async () => {
      const workerRows = (await get('worker', '/transactions').expect(200)).body
        .data;
      const releases = workerRows.filter(
        (t: any) => t.taskId === ids.task && t.type === 'milestone-release',
      );
      expect(releases.map((t: any) => t.amount).sort()).toEqual([360, 480]);
      const clientRows = (await get('client', '/transactions').expect(200)).body
        .data;
      expect(
        clientRows.some(
          (t: any) => t.taskId === ids.task && t.type === 'escrow-lock',
        ),
      ).toBe(true);
      expect(
        clientRows.every(
          (t: any) => t.fromId === ids.client || t.toId === ids.client,
        ),
      ).toBe(true);
    });
  });
});
