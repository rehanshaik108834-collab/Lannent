import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApi } from '../src/configure-api';

/**
 * A reviewer declining a funded audit (found in the page-verification pass):
 * the client's fee comes back, the project stays a draft, the client can pick
 * one other reviewer at a time, or cancel the draft.
 */
describe('Declined audit recovery', () => {
  let app: INestApplication;
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  const api = () => request(app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const get = (who: string, path: string) => api().get(`/api${path}`).set(as(who));
  const post = (who: string, path: string, body: object = {}) => api().post(`/api${path}`).set(as(who)).send(body);
  const data = (res: request.Response) => res.body.data;
  const balance = async () => data(await get('client', `/users/${ids.client}`).expect(200)).walletBalance;

  async function signIn(who: string, email: string, password: string) {
    const login = await api().post('/api/auth/login').send({ email, password }).expect(201);
    tokens[who] = login.body.data.token;
    ids[who] = login.body.data.user.id;
  }

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = fixture.createNestApplication();
    configureApi(app);
    await app.init();
    await signIn('client', 'client@gmail.com', 'Password@123');
    await signIn('expert', 'expert@gmail.com', 'Password@123'); // u3
    await signIn('otherExpert', 'priya@gmail.com', 'Password@123'); // u9, also reviews Web Development
  });

  afterAll(async () => {
    await app?.close();
  });

  it('returns the funded fee when the reviewer declines, and keeps the project a draft', async () => {
    const project = data(
      await post('client', '/tasks', {
        title: `Recovery ${Date.now()}`, description: 'Audited project for recovery.', category: 'Web Development',
        budget: 500, auditEnabled: true, auditExpertId: ids.expert, auditFee: 200,
        milestones: [{ title: 'All', budget: 500 }],
      }).expect(201),
    );
    ids.project = project.id;
    const engagement = data(await get('client', `/audit-requests?taskId=${project.id}`).expect(200))[0];
    const offer = engagement.offers.find((o: any) => o.status === 'pending');
    await post('expert', `/audit-requests/${engagement.id}/offers/${offer.id}/accept`).expect(201);
    const before = await balance();
    await post('client', `/audit-requests/${engagement.id}/fund`).expect(201);
    expect(await balance()).toBeCloseTo(before - 200, 2);

    await post('expert', `/audit-requests/${engagement.id}/decline`, { reason: 'Fully booked this month.' }).expect(201);
    expect(await balance()).toBeCloseTo(before, 2);
    expect(data(await get('client', `/ledger/escrow/${project.id}`).expect(200)).auditHeld).toBe(0);
    expect(data(await get('client', `/audit-requests/${engagement.id}`).expect(200))).toMatchObject({ status: 'declined', expertId: null });
    expect(data(await get('client', `/tasks/${project.id}`).expect(200)).status).toBe('draft');
  });

  it('lets the client choose one other reviewer at a time', async () => {
    const second = data(
      await post('client', '/audit-requests', { taskId: ids.project, expertId: ids.otherExpert, openingOffer: 150 }).expect(201),
    );
    expect(second).toMatchObject({ expertId: ids.otherExpert, kind: 'project-audit' });
    await post('client', '/audit-requests', { taskId: ids.project, expertId: ids.expert, openingOffer: 150 }).expect(409);
  });

  it('cancels the draft, closing the open engagement', async () => {
    await post('client', `/tasks/${ids.project}/cancel-draft`).expect(201);
    expect(data(await get('client', `/tasks/${ids.project}`).expect(200)).status).toBe('cancelled');
    const engagements = data(await get('client', `/audit-requests?taskId=${ids.project}`).expect(200));
    expect(engagements.map((e: any) => e.status).sort()).toEqual(['cancelled', 'declined']);
  });
});
