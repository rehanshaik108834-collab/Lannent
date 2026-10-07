import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApi } from '../src/configure-api';

/**
 * A PATCH changes only the fields it sends. Validated DTOs carry every
 * declared property as `undefined` when it is not sent, and that `undefined`
 * used to overwrite the stored value: renaming a project erased its status and
 * progress, and the client's "Edit project" modal broke every project it saved.
 */
describe('Partial updates keep fields that were not sent', () => {
  let app: INestApplication;
  const tokens: Record<string, string> = {};
  const accounts = {
    client: ['client@gmail.com', 'Password@123'], // u1, owns t1–t4
    sarah: ['sarah@gmail.com', 'Password@123'], // u5, hired on t1
    worker: ['worker@gmail.com', 'Password@123'], // u2, no proposal on t3
  } as const;
  type Who = keyof typeof accounts;

  const api = () => request(app.getHttpServer());
  const as = (who: Who) => ({ Authorization: `Bearer ${tokens[who]}` });
  const get = async (who: Who, path: string) =>
    (await api().get(`/api${path}`).set(as(who)).expect(200)).body.data;
  const patch = (who: Who, path: string, body: object) =>
    api().patch(`/api${path}`).set(as(who)).send(body).expect(200);

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

  it('renaming a project keeps its status, progress and worker', async () => {
    const before = await get('client', '/tasks/t1');
    await patch('client', '/tasks/t1', { title: 'Renamed project' });
    const after = await get('client', '/tasks/t1');
    expect(after.title).toBe('Renamed project');
    for (const field of [
      'status',
      'progress',
      'workerId',
      'budget',
      'description',
      'category',
    ]) {
      expect(after[field]).toEqual(before[field]);
    }
  });

  it('saving a profile field keeps the balance, status and other fields', async () => {
    const before = await get('sarah', '/users/u5');
    await patch('sarah', '/users/u5', { bio: 'Updated bio' });
    const after = await get('sarah', '/users/u5');
    expect(after.bio).toBe('Updated bio');
    for (const field of [
      'walletBalance',
      'status',
      'role',
      'name',
      'email',
      'rating',
    ]) {
      expect(after[field]).toEqual(before[field]);
    }
  });

  it('editing a milestone keeps its status and amounts', async () => {
    const before = await get('client', '/milestones/m4');
    await patch('client', '/milestones/m4', { title: 'Renamed milestone' });
    const after = await get('client', '/milestones/m4');
    expect(after.title).toBe('Renamed milestone');
    for (const field of ['status', 'budget', 'taskId', 'workerId', 'dueDate']) {
      expect(after[field]).toEqual(before[field]);
    }
  });

  it('creating a record without optional fields keeps the server defaults', async () => {
    const created = (
      await api()
        .post('/api/proposals')
        .set(as('worker'))
        .send({ taskId: 't3', coverLetter: 'Happy to help.' })
        .expect(201)
    ).body.data;
    expect(created.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Array.isArray(created.skills)).toBe(true);
    expect(created.status).toBe('pending');
  });
});
