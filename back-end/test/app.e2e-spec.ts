import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApi } from '../src/configure-api';
import { UsersService } from '../src/modules/users/users.service';

describe('Authentication HTTP contract', () => {
  let app: INestApplication;
  let token: string;
  let userId: string;
  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = fixture.createNestApplication();
    configureApi(app);
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  it('rejects anonymous session inspection', async () => {
    const result = await request(app.getHttpServer())
      .get('/api/auth/me')
      .expect(401);
    expect(result.body.success).toBe(false);
  });
  it('validates login input through the real global pipeline', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'invalid' })
      .expect(400);
  });
  it('issues a bearer token and restores a redacted account', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'client@gmail.com', password: 'Password@123' })
      .expect(201);
    token = login.body.data.token;
    userId = login.body.data.user.id;
    expect(typeof token).toBe('string');
    expect(login.body.data.user.password).toBeUndefined();
    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(me.body.data).toMatchObject({
      valid: true,
      user: { id: userId, role: 'client' },
    });
    expect(me.body.data.user.password).toBeUndefined();
  });
  it('does not trust forged role headers without a token', async () => {
    await request(app.getHttpServer())
      .delete(`/api/users/${userId}`)
      .set('role', 'superuser')
      .set('user-id', userId)
      .expect(401);
  });
  it('rejects an existing token immediately after suspension', async () => {
    const users = app.get(UsersService);
    users.update(userId, { status: 'suspended' });
    try {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
      await request(app.getHttpServer())
        .post(`/api/users/${userId}/wallet/add`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 10 })
        .expect(401);
    } finally {
      users.update(userId, { status: 'active' });
    }
  });
});
