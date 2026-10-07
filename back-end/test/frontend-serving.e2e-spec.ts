import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApi } from '../src/configure-api';
import { configureReactFrontend } from '../src/http/static-frontend';

describe('React app serving boundaries', () => {
  let app: NestExpressApplication;
  let root: string;
  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'lannent-react-serving-'));
    mkdirSync(join(root, 'assets'));
    writeFileSync(
      join(root, 'index.html'),
      '<!doctype html><title>React shell fixture</title>',
    );
    writeFileSync(join(root, 'assets', 'example.js'), 'console.log("fixture")');
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = fixture.createNestApplication<NestExpressApplication>();
    configureApi(app);
    configureReactFrontend(app, root);
    SwaggerModule.setup(
      'api-docs',
      app,
      SwaggerModule.createDocument(
        app,
        new DocumentBuilder().setTitle('Lannent test').addBearerAuth().build(),
      ),
    );
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
    rmSync(root, { recursive: true, force: true });
  });
  it('serves the app shell at the original page URLs, never cached', async () => {
    for (const path of [
      '/',
      '/index.html',
      '/pages/client-dashboard.html',
      '/pages/review-deliverable.html?id=m6',
      '/pages/client-dashboard',
    ]) {
      const result = await request(app.getHttpServer())
        .get(path)
        .accept('html')
        .expect(200);
      expect(result.text).toContain('React shell fixture');
      expect(result.headers['cache-control']).toContain('no-store');
    }
  });
  it('serves hashed assets with immutable caching but never converts missing assets into HTML', async () => {
    const asset = await request(app.getHttpServer())
      .get('/assets/example.js')
      .expect(200);
    expect(asset.headers['cache-control']).toContain('immutable');
    for (const path of [
      '/assets/missing.js',
      '/assets/missing',
      '/favicon-missing.svg',
      '/old.css',
    ]) {
      const result = await request(app.getHttpServer())
        .get(path)
        .accept('html')
        .expect(404);
      expect(result.text).not.toContain('React shell fixture');
    }
  });
  it('does not swallow API, file, Swagger or non-document requests', async () => {
    const api = await request(app.getHttpServer())
      .get('/api/no-such-endpoint')
      .accept('html')
      .expect(404);
    expect(api.headers['content-type']).toContain('application/json');
    const file = await request(app.getHttpServer())
      .get('/api/files/missing')
      .accept('html');
    expect(file.status).toBe(401);
    expect(file.text).not.toContain('React shell fixture');
    const docs = await request(app.getHttpServer())
      .get('/api-docs')
      .expect(200);
    expect(docs.text).toContain('Swagger');
    await request(app.getHttpServer())
      .post('/pages/client-dashboard.html')
      .accept('html')
      .expect(404);
    await request(app.getHttpServer())
      .get('/client/projects')
      .accept('html')
      .expect(404);
    await request(app.getHttpServer())
      .get('/unknown-json-path')
      .accept('json')
      .expect(404);
  });
  it('reports a missing build so the server can fall back to the original HTML', () => {
    expect(configureReactFrontend(app, join(root, 'absent'))).toBe(false);
  });
  it('retires legacy-only writes and refuses forged header identity', async () => {
    await request(app.getHttpServer())
      .post('/api/users/login')
      .send({ email: 'client@gmail.com', password: 'Password@123' })
      .expect(404);
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'client@gmail.com', password: 'Password@123' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/notifications')
      .set('Authorization', `Bearer ${login.body.data.token}`)
      .send({ userId: 'u2', text: 'forged event', type: 'message' })
      .expect(404);
    await request(app.getHttpServer())
      .get('/api/tasks')
      .set('role', 'superuser')
      .set('user-id', 'u4')
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', login.body.data.token)
      .expect(401);
  });
});
