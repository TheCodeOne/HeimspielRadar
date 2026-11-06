import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';

export interface ThrottlerRequestRecord {
  headers?: Record<string, string | string[] | undefined>;
  ips?: string[];
  ip?: string;
}

function parseHeaderIp(rawHeader: string | string[] | undefined): string | null {
  if (!rawHeader) {
    return null;
  }

  const candidate = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

  if (!candidate) {
    return null;
  }

  const trimmed = candidate.split(',')[0]?.trim();

  if (!trimmed || trimmed.length === 0) {
    return null;
  }

  return trimmed;
}

@Injectable()
export class CloudflareThrottlerGuard extends ThrottlerGuard {
  protected override errorMessage = 'Too Many Requests. Please slow down.';

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector
  ) {
    super(options, storageService, reflector);
  }

  protected override async getTracker(req: ThrottlerRequestRecord): Promise<string> {
    const cfIp = parseHeaderIp(req.headers?.['cf-connecting-ip']);

    if (cfIp) {
      return cfIp;
    }

    const forwardedIp = parseHeaderIp(req.headers?.['x-forwarded-for']);

    if (forwardedIp) {
      return forwardedIp;
    }

    const firstClientIp = req.ips?.[0]?.trim();

    if (firstClientIp && firstClientIp.length > 0) {
      return firstClientIp;
    }

    const directIp = req.ip?.trim();

    if (directIp && directIp.length > 0) {
      return directIp;
    }

    return '127.0.0.1';
  }
}
