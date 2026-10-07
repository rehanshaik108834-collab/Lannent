import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApi } from '../src/configure-api';

/**
 * W4 through the real HTTP contract: an audited project (negotiate, fund,
 * accept, exact-milestone reports gating approval, fee paid once on full
 * coverage), disputes, and termination with every kind of blocker
 * (acceptance A10, A12, A21 audited, A22).
 */
describe('Expert flow and termination (W4)', () => {
  let app: INestApplication;
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  const stamp = Date.now();

  const api = () => request(app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const get = (who: string, path: string) => api().get(`/api${path}`).set(as(who));
  const post = (who: string, path: string, body: object = {}) =>
    api().post(`/api${path}`).set(as(who)).send(body);
  const patch = (who: string, path: string, body: object = {}) =>
    api().patch(`/api${path}`).set(as(who)).send(body);
  const data = (res: request.Response) => res.body.data;
  const balance = async (who: string) => data(await get(who, `/users/${ids[who]}`).expect(200)).walletBalance;
  const escrow = async (taskId: string) => data(await get('client', `/ledger/escrow/${taskId}`).expect(200));

  async function signIn(who: string, email: string, password: string) {
    const login = await api().post('/api/auth/login').send({ email, password }).expect(201);
    tokens[who] = login.body.data.token;
    ids[who] = login.body.data.user.id;
  }

  /** A funded, in-progress project with the given milestone budgets, worker u2 hired. */
  async function hiredProject(budgets: number[], extra: object = {}) {
    const budget = budgets.reduce((a, b) => a + b, 0);
    const created = data(
      await post('client', '/tasks', {
        title: `W4 project ${stamp}-${Math.random()}`,
        description: 'A project used by the W4 suite.',
        category: 'Web Development',
        budget,
        milestones: budgets.map((b, i) => ({ title: `M${i + 1}`, budget: b })),
        ...extra,
      }).expect(201),
    );
    const proposal = data(
      await post('worker', '/proposals', {
        taskId: created.id, bidPrice: `₹${budget}`, timeline: '1 week', coverLetter: 'Ready to start.',
      }).expect(201),
    );
    await post('client', `/proposals/${proposal.id}/hire`).expect(201);
    return { taskId: created.id as string, milestoneIds: created.milestones.map((m: any) => m.id) as string[] };
  }

  async function deliver(milestoneId: string) {
    await patch('worker', `/milestones/${milestoneId}`, { status: 'in-progress' }).expect(200);
    await post('worker', `/milestones/${milestoneId}/submit`, { deliverable: { description: 'Delivered as agreed.' } }).expect(201);
  }

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = fixture.createNestApplication();
    configureApi(app);
    await app.init();
    const email = `w4-client-${stamp}@example.test`;
    await api().post('/api/users').send({ name: 'W4 Client', email, password: 'Client!2026', role: 'client' }).expect(201);
    await signIn('client', email, 'Client!2026');
    await signIn('worker', 'worker@gmail.com', 'Password@123'); // u2
    await signIn('expert', 'expert@gmail.com', 'Password@123'); // u3, reviews Web Development
    await signIn('otherClient', 'bob@gmail.com', 'Password@123'); // u8
    await post('client', `/users/${ids.client}/wallet/add`, { amount: 30000 }).expect(201);
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('audited project', () => {
    it('stays a draft until the assigned reviewer is funded and accepts', async () => {
      const created = data(
        await post('client', '/tasks', {
          title: `Audited ${stamp}`,
          description: 'Payments service with an expert review.',
          category: 'Web Development',
          budget: 1000,
          auditEnabled: true,
          auditExpertId: ids.expert,
          auditFee: 300,
          milestones: [
            { title: 'API', budget: 600 },
            { title: 'Tests', budget: 400 },
          ],
        }).expect(201),
      );
      ids.audited = created.id;
      [ids.a1, ids.a2] = created.milestones.map((m: any) => m.id);
      expect(created.status).toBe('draft');
      await get('worker', `/tasks/${ids.audited}`).expect(403);

      const engagement = data(await get('expert', `/audit-requests?taskId=${ids.audited}`).expect(200))[0];
      ids.engagement = engagement.id;
      expect(engagement).toMatchObject({ status: 'negotiating', expertId: ids.expert });

      const countered = data(await post('expert', `/audit-requests/${ids.engagement}/offers`, { amount: 350, note: 'Two milestones.' }).expect(201));
      const offer = countered.offers.find((o: any) => o.status === 'pending');
      await post('expert', `/audit-requests/${ids.engagement}/offers/${offer.id}/accept`).expect(400); // own offer
      await post('client', `/audit-requests/${ids.engagement}/offers/${offer.id}/accept`).expect(201);

      const before = await balance('client');
      await post('otherClient', `/audit-requests/${ids.engagement}/fund`).expect(403);
      await post('client', `/audit-requests/${ids.engagement}/fund`).expect(201);
      expect(await balance('client')).toBeCloseTo(before - 350, 2);
      expect((await escrow(ids.audited)).auditHeld).toBe(350);

      await post('expert', `/audit-requests/${ids.engagement}/accept`).expect(201);
      expect(data(await get('client', `/tasks/${ids.audited}`).expect(200)).status).toBe('open');
    });

    it('requires the exact milestone report before approval and pays the reviewer once, on full coverage', async () => {
      const proposal = data(
        await post('worker', '/proposals', { taskId: ids.audited, bidPrice: '₹1000', timeline: '2 weeks', coverLetter: 'Ready.' }).expect(201),
      );
      await post('client', `/proposals/${proposal.id}/hire`).expect(201);

      await deliver(ids.a1);
      await post('client', `/milestones/${ids.a1}/approve`).expect(409);

      const report = (milestoneId: string) =>
        post('expert', '/audit-reports', {
          auditRequestId: ids.engagement, taskId: ids.audited, milestoneId, verdict: 'pass', overall: 'Solid work.',
          codequality: 4, security: 4, performance: 4, documentation: 4,
        });
      const first = data(await report(ids.a1).expect(201));
      expect(first.payout).toMatchObject({ pending: true, audited: 1, total: 2 });
      await post('client', `/milestones/${ids.a1}/approve`).expect(201);

      await deliver(ids.a2);
      const expertBefore = await balance('expert');
      const second = data(await report(ids.a2).expect(201));
      expect(second.payout).toMatchObject({ alreadyPaid: false, amount: 350, fee: 35, net: 315 });
      expect(await balance('expert')).toBeCloseTo(expertBefore + 315, 2);
      const refiled = data(await report(ids.a2).expect(201));
      expect(refiled.payout.alreadyPaid).toBe(true);
      expect(await balance('expert')).toBeCloseTo(expertBefore + 315, 2);

      await post('client', `/milestones/${ids.a2}/approve`).expect(201);
      expect(data(await get('client', `/tasks/${ids.audited}`).expect(200)).status).toBe('completed');
    });
  });

  describe('termination', () => {
    it('only a party to a hired project can ask to end it', async () => {
      const { taskId } = await hiredProject([100]);
      await post('otherClient', `/tasks/${taskId}/termination`, { reason: 'Not my project at all.' }).expect(403);
      const open = data(await post('client', '/tasks', {
        title: `Unhired ${stamp}`, description: 'Nobody hired here yet.', category: 'Web Development',
        budget: 100, milestones: [{ title: 'Only', budget: 100 }],
      }).expect(201));
      await post('client', `/tasks/${open.id}/termination`, { reason: 'Changed our plans.' }).expect(409);
    });

    it('waits for submitted work, blocks new work, then refunds only what is unused (A12)', async () => {
      const { taskId, milestoneIds: [m1, m2, m3] } = await hiredProject([300, 300, 300]);
      await deliver(m1);
      await post('client', `/milestones/${m1}/approve`).expect(201);
      await deliver(m2);

      const pending = data(await post('worker', `/tasks/${taskId}/termination`, { reason: 'I can no longer continue.' }).expect(201));
      expect(pending).toMatchObject({ state: 'pending', blockingMilestoneIds: [m2], activeDisputeIds: [] });
      await patch('worker', `/milestones/${m3}`, { status: 'in-progress' }).expect(409);
      await post('client', `/milestones/${m2}/request-revision`, { reason: 'Please fix the layout.' }).expect(409);

      const clientBefore = await balance('client');
      await post('client', `/milestones/${m2}/approve`).expect(201); // last blocker → finalizes
      const task = data(await get('client', `/tasks/${taskId}`).expect(200));
      expect(task.status).toBe('cancelled');
      expect(task.termination).toMatchObject({ projectRefunded: 300, auditRefunded: 0, cancelledMilestoneIds: [m3] });
      expect(await balance('client')).toBeCloseTo(clientBefore + 300, 2);
      expect((await escrow(taskId)).projectHeld).toBe(0);
      const milestones = data(await get('client', `/milestones?taskId=${taskId}`).expect(200));
      expect(milestones.map((m: any) => m.status)).toEqual(['completed', 'completed', 'cancelled']);

      const again = data(await post('client', `/tasks/${taskId}/termination`, { reason: 'Asking a second time.' }).expect(201));
      expect(again).toMatchObject({ state: 'finalized', termination: task.termination });
      expect(await balance('client')).toBeCloseTo(clientBefore + 300, 2);
    });

    it('waits for an open dispute; a client-favour verdict then refunds the disputed work (A10)', async () => {
      const { taskId, milestoneIds: [m1] } = await hiredProject([500]);
      await deliver(m1);
      const dispute = data(
        await post('client', '/disputes', { taskId, milestoneId: m1, reason: 'Delivery is incomplete.', expertId: ids.expert }).expect(201),
      );
      const pending = data(await post('client', `/tasks/${taskId}/termination`, { reason: 'We want to stop here.' }).expect(201));
      expect(pending).toMatchObject({ state: 'pending', activeDisputeIds: [dispute.id] });

      const clientBefore = await balance('client');
      await post('expert', `/disputes/${dispute.id}/resolve`, { verdict: 'client-favour', resolution: 'Incomplete work.' }).expect(201);
      const task = data(await get('client', `/tasks/${taskId}`).expect(200));
      expect(task).toMatchObject({ status: 'cancelled', termination: { projectRefunded: 500, cancelledMilestoneIds: [m1] } });
      // The arbitration fee was never agreed or funded, so the engagement is closed with the verdict.
      const engagement = data(await get('client', `/audit-requests/${dispute.auditRequestId}`).expect(200));
      expect(engagement.status).toBe('cancelled');
      expect(await balance('client')).toBeCloseTo(clientBefore + 500, 2);
    });

    it('refunds an unpaid audit fee when an audited project ends before its last report (A22)', async () => {
      const created = data(
        await post('client', '/tasks', {
          title: `Audited early end ${stamp}`, description: 'Audited project ended early.', category: 'Web Development',
          budget: 400, auditEnabled: true, auditExpertId: ids.expert, auditFee: 200,
          milestones: [{ title: 'One', budget: 200 }, { title: 'Two', budget: 200 }],
        }).expect(201),
      );
      const engagement = data(await get('client', `/audit-requests?taskId=${created.id}`).expect(200))[0];
      const offer = engagement.offers.find((o: any) => o.status === 'pending');
      await post('expert', `/audit-requests/${engagement.id}/offers/${offer.id}/accept`).expect(201);
      await post('client', `/audit-requests/${engagement.id}/fund`).expect(201);
      await post('expert', `/audit-requests/${engagement.id}/accept`).expect(201);
      const proposal = data(await post('worker', '/proposals', { taskId: created.id, bidPrice: '₹400', timeline: '1 week', coverLetter: 'Ready.' }).expect(201));
      await post('client', `/proposals/${proposal.id}/hire`).expect(201);

      const [m1] = created.milestones.map((m: any) => m.id);
      await deliver(m1);
      await post('expert', '/audit-reports', { auditRequestId: engagement.id, taskId: created.id, milestoneId: m1, verdict: 'pass' }).expect(201);
      await post('client', `/milestones/${m1}/approve`).expect(201);

      const expertBefore = await balance('expert');
      const clientBefore = await balance('client');
      const finalized = data(await post('client', `/tasks/${created.id}/termination`, { reason: 'Second milestone not needed.' }).expect(201));
      expect(finalized.termination).toMatchObject({ projectRefunded: 200, auditRefunded: 200, closedEngagementIds: [engagement.id] });
      expect(await balance('client')).toBeCloseTo(clientBefore + 400, 2);
      expect(await balance('expert')).toBe(expertBefore);
      expect(data(await get('client', `/audit-requests/${engagement.id}`).expect(200)).status).toBe('cancelled');
    });
  });
});
