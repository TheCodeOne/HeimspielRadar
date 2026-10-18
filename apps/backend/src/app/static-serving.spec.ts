import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { resolveFrontendDistPath } from './static-path.util';

function createTestStaticAppModule(frontendDistPath: string) {
  @Module({
    imports: [
      ServeStaticModule.forRoot({
        rootPath: frontendDistPath,
        exclude: ['/api/{*path}'],
      }),
    ],
    controllers: [AppController],
    providers: [AppService],
  })
  class TestStaticAppModule {}

  return TestStaticAppModule;
}

describe('Monolithic Static Serving', () => {
  let app: INestApplication;
  let baseUrl: string;
  let tempDir: string;
  let previousDistPath: string | undefined;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sundayleague-static-spec-'));
    await writeFile(
      join(tempDir, 'index.html'),
      '<!doctype html><html><body><div id="root"></div></body></html>',
    );
    previousDistPath = process.env.FRONTEND_DIST_PATH;
    process.env.FRONTEND_DIST_PATH = tempDir;

    app = await NestFactory.create(createTestStaticAppModule(resolveFrontendDistPath()), {
      logger: false,
    });
    app.setGlobalPrefix('api');
    await app.listen(0);

    const address = app.getHttpServer().address();

    // SAFETY: NestJS HttpServer.address() returns AddressInfo object when listening on TCP port
    const port = (address as { port: number }).port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }

    if (previousDistPath === undefined) {
      delete process.env.FRONTEND_DIST_PATH;
    } else {
      process.env.FRONTEND_DIST_PATH = previousDistPath;
    }

    await rm(tempDir, { recursive: true, force: true });
  });

  it('should serve frontend SPA index.html on root /', async () => {
    const res = await fetch(`${baseUrl}/`);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain('id="root"');
  });

  it('should fallback to frontend SPA index.html on client-side routes like /matches', async () => {
    const res = await fetch(`${baseUrl}/matches`);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain('id="root"');
  });

  it('should serve API routes under /api', async () => {
    const res = await fetch(`${baseUrl}/api`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ message: 'Hello from Sunday League API' });
  });

  it('should return 404 JSON for non-existent API routes without falling back to index.html', async () => {
    const res = await fetch(`${baseUrl}/api/does-not-exist`);
    const body = await res.text();

    expect(res.status).toBe(404);
    expect(body).toContain('Cannot GET /api/does-not-exist');
    expect(body).not.toContain('id="root"');
  });
});
