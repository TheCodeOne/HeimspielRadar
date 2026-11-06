import { Reflector } from '@nestjs/core';
import { ThrottlerStorageService } from '@nestjs/throttler';
import {
  CloudflareThrottlerGuard,
  ThrottlerRequestRecord,
} from './cloudflare-throttler.guard';

class TestableCloudflareThrottlerGuard extends CloudflareThrottlerGuard {
  public async testTracker(req: ThrottlerRequestRecord): Promise<string> {
    return this.getTracker(req);
  }
}

describe('CloudflareThrottlerGuard', () => {
  let guard: TestableCloudflareThrottlerGuard;

  beforeEach(() => {
    const storageService = new ThrottlerStorageService();
    const reflector = new Reflector();

    guard = new TestableCloudflareThrottlerGuard(
      [{ name: 'default', ttl: 60000, limit: 60 }],
      storageService,
      reflector
    );
  });

  it('should extract client IP from cf-connecting-ip header string', async () => {
    const tracker = await guard.testTracker({
      headers: {
        'cf-connecting-ip': '203.0.113.195',
      },
    });

    expect(tracker).toBe('203.0.113.195');
  });

  it('should extract client IP from cf-connecting-ip header array', async () => {
    const tracker = await guard.testTracker({
      headers: {
        'cf-connecting-ip': ['198.51.100.42', '198.51.100.43'],
      },
    });

    expect(tracker).toBe('198.51.100.42');
  });

  it('should extract first IP when cf-connecting-ip has comma-separated values', async () => {
    const tracker = await guard.testTracker({
      headers: {
        'cf-connecting-ip': '203.0.113.195, 192.0.2.1',
      },
    });

    expect(tracker).toBe('203.0.113.195');
  });

  it('should prioritize cf-connecting-ip over x-forwarded-for and req.ip', async () => {
    const tracker = await guard.testTracker({
      headers: {
        'cf-connecting-ip': '203.0.113.1',
        'x-forwarded-for': '198.51.100.1',
      },
      ips: ['192.0.2.1'],
      ip: '10.0.0.1',
    });

    expect(tracker).toBe('203.0.113.1');
  });

  it('should fallback to x-forwarded-for when cf-connecting-ip is missing', async () => {
    const tracker = await guard.testTracker({
      headers: {
        'x-forwarded-for': '198.51.100.15, 10.0.0.2',
      },
      ip: '10.0.0.2',
    });

    expect(tracker).toBe('198.51.100.15');
  });

  it('should fallback to req.ips when proxy headers are absent', async () => {
    const tracker = await guard.testTracker({
      ips: ['192.0.2.88'],
      ip: '127.0.0.1',
    });

    expect(tracker).toBe('192.0.2.88');
  });

  it('should fallback to req.ip when req.ips is empty and proxy headers are absent', async () => {
    const tracker = await guard.testTracker({
      ip: '192.0.2.99',
    });

    expect(tracker).toBe('192.0.2.99');
  });

  it('should fallback to 127.0.0.1 when no ip information is present', async () => {
    const tracker = await guard.testTracker({});

    expect(tracker).toBe('127.0.0.1');
  });
});
