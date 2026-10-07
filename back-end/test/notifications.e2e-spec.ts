import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApi } from '../src/configure-api';

/**
 * Notifications are written by the server when an action commits; clients
 * cannot write them (POST /notifications stays retired). Each test performs an
 * action through the real HTTP contract and checks who was told, and who was
 * not.
 */
describe('Server-side notifications', () => {
  let app: INestApplication;
  const tokens: Record<string, string> = {};

  const accounts = {
    client: ['client@gmail.com', 'Password@123'], // u1, owns t1–t4
    otherClient: ['bob@gmail.com', 'Password@123'], // u8, owns t5–t6
    worker: ['worker@gmail.com', 'Password@123'], // u2, hired on t6
    emily: ['emily@gmail.com', 'Password@123'], // u7, hired on t4
    expert: ['expert@gmail.com', 'Password@123'], // u3, reviews Web Development
    priya: ['priya@gmail.com', 'Password@123'], // u9, another reviewer
  } as const;
  type Who = keyof typeof accounts;

  const api = () => request(app.getHttpServer());
  const as = (who: Who) => ({ Authorization: `Bearer ${tokens[who]}` });
  const post = (who: Who, path: string, body: object = {}) =>
    api().post(`/api${path}`).set(as(who)).send(body);
  const inbox = async (who: Who) =>
    (await api().get('/api/notifications').set(as(who)).expect(200)).body
      .data as Array<{ type: string; text: string; subtext: string }>;
  const latest = async (who: Who, type: string) =>
    (await inbox(who)).filter((n) => n.type === type).pop();

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

  it('tells the client about a new proposal', async () => {
    await post('worker', '/proposals', {
      taskId: 't3',
      bidPrice: '$1,500',
      timeline: '2 weeks',
      coverLetter: 'I can build this.',
    }).expect(201);
    expect(await latest('client', 'proposal')).toMatchObject({
      text: 'New proposal from Alex Worker',
      subtext: expect.stringContaining('Bid: $1,500, Timeline: 2 weeks'),
    });
  });

  it('tells a worker they were invited', async () => {
    await post('client', '/proposals', {
      taskId: 't3',
      workerId: 'u7',
      type: 'invitation',
    }).expect(201);
    const note = await latest('emily', 'invitation');
    expect(note?.text).toBe('You have been invited to a project');
  });

  it('tells the receiver about a message', async () => {
    const content =
      'Here is the first draft of the design system, ready for review today.';
    await post('worker', '/messages', {
      taskId: 't6',
      receiverId: 'u8',
      content,
    }).expect(201);
    expect(await latest('otherClient', 'message')).toMatchObject({
      text: 'New message from Alex Worker',
      subtext: content.substring(0, 50) + '...',
    });
  });

  it('tells the client a deliverable was submitted', async () => {
    await post('worker', '/milestones/m20/submit', {
      deliverable: { notes: 'Done', files: [] },
    }).expect(201);
    expect((await latest('otherClient', 'milestone-submitted'))?.text).toBe(
      'New deliverable submitted',
    );
  });

  it('tells the chosen reviewer and the other party about a dispute, and both parties about the verdict', async () => {
    const before = (await inbox('priya')).length;
    const dispute = (
      await post('client', '/disputes', {
        taskId: 't4',
        milestoneId: 'm10',
        reason: 'Work does not match the brief',
        expertId: 'u3',
      }).expect(201)
    ).body.data;

    expect((await latest('expert', 'dispute'))?.text).toMatch(
      /^New dispute raised: /,
    );
    expect((await latest('emily', 'dispute'))?.text).toBe(
      'A dispute has been raised against you',
    );
    // A reviewer who was not chosen cannot open the case and is not told.
    expect((await inbox('priya')).length).toBe(before);

    await post('expert', `/disputes/${dispute.id}/resolve`, {
      verdict: 'client-favour',
      resolution: 'The milestone is reworked.',
    }).expect(201);
    for (const party of ['client', 'emily'] as const) {
      expect((await latest(party, 'dispute-resolved'))?.subtext).toMatch(
        /^Expert verdict in favour of the Client/,
      );
    }
  });

  it('still refuses notifications written by a client', async () => {
    await post('client', '/notifications', {
      userId: 'u2',
      type: 'message',
      text: 'forged event',
    }).expect(404);
    expect((await inbox('worker')).some((n) => n.text === 'forged event')).toBe(
      false,
    );
  });
});
