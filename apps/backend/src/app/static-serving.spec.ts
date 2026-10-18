import { INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { resolveFrontendDistPath } from './static-path.util';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: resolveFrontendDistPath(),
      exclude: ['/api/{*path}'],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
class TestStaticAppModule {}

describe('Monolithic Static Serving', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    app = await NestFactory.create(TestStaticAppModule, { logger: false });
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
