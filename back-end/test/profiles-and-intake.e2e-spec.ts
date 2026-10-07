import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApi } from '../src/configure-api';
import { ExpertApplicationsRepository } from '../src/modules/expert-applications/expert-applications.repository';
import { UsersService } from '../src/modules/users/users.service';
import { FilesService } from '../src/modules/files/files.service';

/**
 * D10–D12 through the real HTTP contract (acceptance A13–A15): profile fields
 * persist or are refused, intake reads exactly the application's documents,
 * and approval creates the expert account atomically with the applicant's
 * own password.
 */
describe('Profiles, intake files and expert approval (D10–D12)', () => {
  let app: INestApplication;
  const tokens: Record<string, string> = {};
  const accounts = {
    client: ['client@gmail.com', 'Password@123'], // u1
    otherClient: ['bob@gmail.com', 'Password@123'], // u8
    worker: ['worker@gmail.com', 'Password@123'], // u2
    expert: ['expert@gmail.com', 'Password@123'], // u3
    intake: ['intake@gmail.com', 'Intake@123'], // u12
    compliance: ['compliance@gmail.com', 'Compliance@123'], // u13
  } as const;
  type Who = keyof typeof accounts;

  const api = () => request(app.getHttpServer());
  const as = (who: Who) => ({ Authorization: `Bearer ${tokens[who]}` });
  const get = (who: Who, path: string) => api().get(`/api${path}`).set(as(who));
  const patch = (who: Who, path: string, body: object) =>
    api().patch(`/api${path}`).set(as(who)).send(body);
  const pdf = (name: string) =>
    [
      Buffer.from(`%PDF-1.4\n% ${name}\n`),
      { filename: name, contentType: 'application/pdf' },
    ] as const;
  /** Files this suite uploads, removed again in afterAll. */
  const uploaded: string[] = [];
  const publicUpload = async (name: string) => {
    const ref = (
      await api()
        .post('/api/files/application')
        .attach('file', ...pdf(name))
        .expect(201)
    ).body.data;
    uploaded.push(ref.id);
    return ref;
  };
  const apply = (body: object) =>
    api().post('/api/expert-applications').send(body);
  const applicant = (email: string, extra: object = {}) => ({
    name: 'Asha Rao',
    email,
    password: 'Reviewer!2026',
    expertise: 'Backend',
    ...extra,
  });

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
    // Delete only this suite's uploads; uploads/ may be shared with a dev server.
    const files = app?.get(FilesService);
    for (const id of uploaded) {
      try {
        files.remove(id, { id: 'test-cleanup', role: 'superuser' });
      } catch {
        /* already gone */
      }
    }
    await app?.close();
  });

  describe('D10: profile fields persist or are refused', () => {
    it('stores client contact and company details and returns them on reload', async () => {
      await patch('client', '/users/u1', {
        phone: '+91 98765 43210',
        phoneCountryCode: '+91',
        bio: 'We build checkout software.',
        companyDetails: {
          name: 'TechCorp India',
          industry: 'Retail',
          website: 'https://techcorp.example',
          size: '50-200',
          location: 'Pune',
        },
      }).expect(200);
      const reloaded = (await get('client', '/users/u1').expect(200)).body.data;
      expect(reloaded).toMatchObject({
        phone: '+91 98765 43210',
        bio: 'We build checkout software.',
        company: 'TechCorp India',
        companyDetails: {
          name: 'TechCorp India',
          industry: 'Retail',
          location: 'Pune',
        },
      });
    });

    it('stores worker professional details and portfolio', async () => {
      const portfolio = [
        {
          id: 'pf1',
          title: 'Payments SDK',
          description: 'Open source',
          url: 'https://example.com',
        },
      ];
      await patch('worker', '/users/u2', {
        jobTitle: 'Backend Engineer',
        experienceLevel: 'Senior',
        hourlyRate: 1800,
        availability: 'Part-time',
        languages: ['English', 'Hindi'],
        skills: ['Node.js'],
        portfolioProjects: portfolio,
      }).expect(200);
      const reloaded = (await get('worker', '/users/u2').expect(200)).body.data;
      expect(reloaded).toMatchObject({
        jobTitle: 'Backend Engineer',
        experienceLevel: 'Senior',
        hourlyRate: 1800,
        availability: 'Part-time',
        languages: ['English', 'Hindi'],
        skills: ['Node.js'],
        portfolioProjects: portfolio,
      });
    });

    it('stores expert preferences without changing reviewer matching domains', async () => {
      const before = (await get('expert', '/users/u3').expect(200)).body.data;
      const availability = {
        status: 'Unavailable',
        maxCases: '1',
        type: 'Technical Audits only',
      };
      await patch('expert', '/users/u3', {
        availability,
        auditDomains: ['security', 'backend'],
      }).expect(200);
      const reloaded = (await get('expert', '/users/u3').expect(200)).body.data;
      expect(reloaded).toMatchObject({
        availability,
        auditDomains: ['security', 'backend'],
      });
      expect(reloaded.domains).toEqual(before.domains);
    });

    it("refuses fields that are not part of the role's profile, saving nothing", async () => {
      const before = (await get('client', '/users/u1').expect(200)).body.data;
      const res = await patch('client', '/users/u1', {
        bio: 'changed',
        jobTitle: 'CTO',
      }).expect(400);
      expect(res.body.message).toContain('jobTitle');
      expect((await get('client', '/users/u1').expect(200)).body.data.bio).toBe(
        before.bio,
      );
    });

    it.each([
      ['worker', '/users/u2', { availability: { status: 'x' } }],
      ['expert', '/users/u3', { availability: 'Full-time' }],
      ['expert', '/users/u3', { auditDomains: ['astrology'] }],
      ['worker', '/users/u2', { hourlyRate: -5 }],
      ['client', '/users/u1', { phone: 'call me' }],
    ] as const)(
      'rejects a malformed %s profile value',
      async (who, path, body) => {
        await patch(who, path, body).expect(400);
      },
    );

    it('shows profile details to others but keeps phone and email private', async () => {
      const seen = (await get('otherClient', '/users/u2').expect(200)).body
        .data;
      expect(seen.jobTitle).toBe('Backend Engineer');
      expect(seen.phone).toBeUndefined();
      expect(seen.email).toBeUndefined();
    });
  });

  describe('D11: intake reads application documents and nothing else', () => {
    it('opens a résumé referenced by an application to intake, not to others', async () => {
      const resume = await publicUpload('cv.pdf');
      await apply(
        applicant('cv-reader@example.com', { resumeFile: resume }),
      ).expect(201);
      await get('intake', `/files/${resume.id}`).expect(200);
      await get('compliance', `/files/${resume.id}`).expect(200);
      await get('worker', `/files/${resume.id}`).expect(403);
    });

    it('does not open an unreferenced public upload or any project file to intake', async () => {
      const stray = await publicUpload('stray.pdf');
      await get('intake', `/files/${stray.id}`).expect(403);

      const projectFile = (
        await api()
          .post('/api/files')
          .set(as('client'))
          .field('taskId', 't1')
          .attach('file', ...pdf('spec.pdf'))
          .expect(201)
      ).body.data;
      uploaded.push(projectFile.id);
      await get('intake', `/files/${projectFile.id}`).expect(403);
      // Naming a project file in an application does not change that.
      await apply(
        applicant('smuggler@example.com', { resumeFile: projectFile }),
      ).expect(400);
      await get('intake', `/files/${projectFile.id}`).expect(403);
    });

    it("refuses attaching files to someone else's project", async () => {
      await api()
        .post('/api/files')
        .set(as('otherClient'))
        .field('taskId', 't1')
        .attach('file', ...pdf('planted.pdf'))
        .expect(403);
    });
  });

  describe("D12: expert approval is atomic and uses the applicant's password", () => {
    it('requires a strong password and refuses duplicate or taken emails', async () => {
      await apply({
        name: 'No Password',
        email: 'nopass@example.com',
        expertise: 'Backend',
      }).expect(400);
      await apply(
        applicant('weak@example.com', { password: 'password' }),
      ).expect(400);
      await apply(applicant('client@gmail.com')).expect(409); // has an account
      await apply(applicant('twice@example.com')).expect(201);
      await apply(applicant('twice@example.com')).expect(409);
    });

    it('creates the account with the chosen password, once', async () => {
      const created = (
        await apply(applicant('approve-me@example.com')).expect(201)
      ).body.data;
      expect(created.password).toBeUndefined();
      await patch('compliance', `/expert-applications/${created.id}/status`, {
        status: 'approved',
      }).expect(403);

      const approved = (
        await patch('intake', `/expert-applications/${created.id}/status`, {
          status: 'approved',
        }).expect(200)
      ).body.data;
      expect(approved).toMatchObject({
        status: 'approved',
        reviewedBy: 'u12',
        accountId: expect.any(String),
      });
      expect(approved.password).toBeUndefined();

      const login = await api()
        .post('/api/auth/login')
        .send({ email: 'approve-me@example.com', password: 'Reviewer!2026' })
        .expect(201);
      expect(login.body.data.user).toMatchObject({
        id: approved.accountId,
        role: 'expert',
      });
      await api()
        .post('/api/auth/login')
        .send({ email: 'approve-me@example.com', password: 'Expert@123' })
        .expect(400);

      // Same decision replays; reversing it is refused.
      await patch('intake', `/expert-applications/${created.id}/status`, {
        status: 'approved',
      }).expect(200);
      await patch('intake', `/expert-applications/${created.id}/status`, {
        status: 'rejected',
      }).expect(409);
    });

    it('leaves the application pending when the email was taken in the meantime', async () => {
      const created = (await apply(applicant('race@example.com')).expect(201))
        .body.data;
      await api()
        .post('/api/users')
        .send({
          name: 'Race Client',
          email: 'race@example.com',
          password: 'Client!2026',
          role: 'client',
        })
        .expect(201);
      await patch('intake', `/expert-applications/${created.id}/status`, {
        status: 'approved',
      }).expect(409);
      const stored = (
        await get('intake', `/expert-applications/${created.id}`).expect(200)
      ).body.data;
      expect(stored.status).toBe('pending');
    });

    it('rolls back the account when recording the approval fails', async () => {
      const created = (
        await apply(applicant('rollback@example.com')).expect(201)
      ).body.data;
      const spy = jest
        .spyOn(ExpertApplicationsRepository.prototype, 'update')
        .mockImplementationOnce(() => {
          expect(
            app.get(UsersService).findByEmail('rollback@example.com'),
          ).toBeTruthy();
          throw new Error('injected failure');
        });
      await patch('intake', `/expert-applications/${created.id}/status`, {
        status: 'approved',
      }).expect(500);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();

      expect(
        app.get(UsersService).findByEmail('rollback@example.com'),
      ).toBeFalsy();
      const stored = (
        await get('intake', `/expert-applications/${created.id}`).expect(200)
      ).body.data;
      expect(stored.status).toBe('pending');
      // And it can still be approved properly afterwards.
      await patch('intake', `/expert-applications/${created.id}/status`, {
        status: 'approved',
      }).expect(200);
    });
  });
});
