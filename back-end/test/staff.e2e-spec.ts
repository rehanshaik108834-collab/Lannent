import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApi } from '../src/configure-api';
import { TasksRepository } from '../src/modules/tasks/tasks.repository';
import { MilestonesRepository } from '../src/modules/milestones/milestones.repository';
import { AuditRequestsRepository } from '../src/modules/audit-requests/audit-requests.repository';
import { RevenueService } from '../src/modules/revenue/revenue.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { resetFeeConfig } from '../src/modules/ledger/fee-config';

describe('Staff duties and operations (W5)', () => {
  let app: INestApplication;
  const tokens: Record<string, string> = {};
  const accounts = [
    ['client', 'Password@123'],
    ['worker', 'Password@123'],
    ['expert', 'Password@123'],
    ['super', 'Superadmin@123'],
    ['admin', 'Admin@123'],
    ['intake', 'Intake@123'],
    ['compliance', 'Compliance@123'],
  ];
  const project = {
    clientId: 'u1',
    title: 'Operations project',
    description: 'Created for an actual client',
    category: 'Web Development',
    budget: 300,
    currency: 'INR',
    milestones: [{ title: 'Complete work', budget: 300 }],
  };
  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = fixture.createNestApplication();
    configureApi(app);
    await app.init();
    for (const [name, password] of accounts) {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: `${name}@gmail.com`, password })
        .expect(201);
      tokens[name] = response.body.data.token;
    }
  });
  afterAll(async () => {
    resetFeeConfig();
    await app?.close();
  });
  for (const [actor] of accounts)
    it(`${actor} has only its staff read permissions`, async () => {
      await request(app.getHttpServer())
        .get('/api/revenue/summary')
        .set('Authorization', `Bearer ${tokens[actor]}`)
        .expect(['admin', 'compliance'].includes(actor) ? 200 : 403);
      await request(app.getHttpServer())
        .get('/api/audit-log')
        .set('Authorization', `Bearer ${tokens[actor]}`)
        .expect(actor === 'compliance' ? 200 : 403);
      if (actor !== 'super') {
        await request(app.getHttpServer())
          .post('/api/operations/projects')
          .set('Authorization', `Bearer ${tokens[actor]}`)
          .send(project)
          .expect(403);
        await request(app.getHttpServer())
          .patch('/api/operations/disputes/d1/reviewer')
          .set('Authorization', `Bearer ${tokens[actor]}`)
          .send({ expertId: 'u3' })
          .expect(403);
      }
    });
  it('retains funded and referenced accounts instead of erasing money', async () => {
    const before = await request(app.getHttpServer())
      .get('/api/users/u1')
      .set('Authorization', `Bearer ${tokens.super}`)
      .expect(200);
    await request(app.getHttpServer())
      .delete('/api/users/u1')
      .set('Authorization', `Bearer ${tokens.super}`)
      .expect(409);
    const after = await request(app.getHttpServer())
      .get('/api/users/u1')
      .set('Authorization', `Bearer ${tokens.super}`)
      .expect(200);
    expect(after.body.data.walletBalance).toBe(before.body.data.walletBalance);
  });
  it('creates atomic projects for an explicit client while recording the real operator', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/operations/projects')
      .set('Authorization', `Bearer ${tokens.super}`)
      .send(project)
      .expect(201);
    expect(created.body.data.clientId).toBe('u1');
    expect(created.body.data.milestones).toHaveLength(1);
    const events = app
      .get(AuditService)
      .findAll({ kind: 'operations.project.create' }).events;
    expect(events[0]).toMatchObject({
      actorId: 'u4',
      actorRole: 'superuser',
      detail: { clientId: 'u1', taskId: created.body.data.id },
    });
  });
  it('rejects a non-client target and incorrect allocations without creating records', async () => {
    const before = app.get(TasksRepository).findAll().length;
    for (const body of [
      { ...project, clientId: 'u2' },
      { ...project, milestones: [{ title: 'Wrong sum', budget: 299 }] },
    ])
      await request(app.getHttpServer())
        .post('/api/operations/projects')
        .set('Authorization', `Bearer ${tokens.super}`)
        .send(body)
        .expect(400);
    expect(app.get(TasksRepository).findAll()).toHaveLength(before);
  });
  it('rolls back project creation if inserting a milestone fails', async () => {
    const tasks = app.get(TasksRepository);
    const milestones = app.get(MilestonesRepository);
    const before = structuredClone({
      tasks: tasks.findAll(),
      milestones: milestones.findAll(),
    });
    const spy = jest
      .spyOn(MilestonesRepository.prototype, 'insert')
      .mockImplementationOnce(() => {
        throw new Error('injected milestone failure');
      });
    try {
      await request(app.getHttpServer())
        .post('/api/operations/projects')
        .set('Authorization', `Bearer ${tokens.super}`)
        .send(project)
        .expect(500);
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
    expect({
      tasks: tasks.findAll(),
      milestones: milestones.findAll(),
    }).toEqual(before);
  });
  it('assigns an eligible reviewer without granting operations verdict authority', async () => {
    await request(app.getHttpServer())
      .patch('/api/operations/disputes/d1/reviewer')
      .set('Authorization', `Bearer ${tokens.super}`)
      .send({ expertId: 'u3' })
      .expect(200);
    const audit = app
      .get(AuditRequestsRepository)
      .findAll({ kind: 'dispute-audit' })
      .find((row) => row.disputeId === 'd1');
    expect(audit?.expertId).toBe('u3');
    await request(app.getHttpServer())
      .post('/api/disputes/d1/resolve')
      .set('Authorization', `Bearer ${tokens.super}`)
      .send({ verdict: 'worker-favour', resolution: 'Operator may not decide' })
      .expect(403);
    if (!audit) throw new Error('Missing engagement');
    app
      .get(AuditRequestsRepository)
      .update(audit.id, { status: 'escrow-funded' });
    await request(app.getHttpServer())
      .patch('/api/operations/disputes/d1/reviewer')
      .set('Authorization', `Bearer ${tokens.super}`)
      .send({ expertId: 'u9' })
      .expect(409);
  });
  it('rejects fee writes outside revenue and retains all rates on rejected array input', async () => {
    const service = app.get(RevenueService);
    const before = structuredClone(service.getFeeConfig());
    await request(app.getHttpServer())
      .patch('/api/revenue/fee-config')
      .set('Authorization', `Bearer ${tokens.compliance}`)
      .send({ depositPercent: 10 })
      .expect(403);
    await request(app.getHttpServer())
      .patch('/api/revenue/fee-config')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ depositPercent: 50, workerServicePercents: [20, 101, 5] })
      .expect(400);
    expect(service.getFeeConfig()).toEqual(before);
    await request(app.getHttpServer())
      .patch('/api/revenue/fee-config')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ depositPercent: 3 })
      .expect(200);
    expect(
      app.get(AuditService).findAll({ kind: 'fee.change' }).events[0],
    ).toMatchObject({ actorId: 'u11', actorRole: 'revenue-admin' });
  });
});
