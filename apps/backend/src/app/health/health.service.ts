import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Injectable } from '@nestjs/common';
import { HealthCheckResponse } from '@sundayleague/shared-types';
import { ScraperService } from '../scraper/scraper.service';

function resolveDefaultBackendVersion(): string {
  try {
    const localPkgPath = path.resolve(process.cwd(), 'apps/backend/package.json');

    if (fs.existsSync(localPkgPath)) {
      // SAFETY: package.json follows standard npm package manifest schema
      const pkg = JSON.parse(fs.readFileSync(localPkgPath, 'utf8')) as { version?: string };

      if (pkg.version) {
        return pkg.version;
      }
    }

    const rootPkgPath = path.resolve(process.cwd(), 'package.json');

    if (fs.existsSync(rootPkgPath)) {
      // SAFETY: package.json follows standard npm package manifest schema
      const pkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8')) as {
        version?: string;
        name?: string;
      };

      if (pkg.version && pkg.name === 'backend') {
        return pkg.version;
      }
    }
  } catch {
    // Graceful fallback if filesystem access fails
  }

  return '0.1.0';
}

function resolveDefaultCommitSha(): string {
  try {
    const sha = execSync('git rev-parse --short=7 HEAD', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();

    if (sha) {
      return sha.slice(0, 7);
    }
  } catch {
    // Git is not available in production container or repo not present
  }

  return 'dev';
}

const DEFAULT_BACKEND_VERSION = resolveDefaultBackendVersion();
const DEFAULT_COMMIT_SHA = resolveDefaultCommitSha();

@Injectable()
export class HealthService {
  constructor(private readonly scraperService: ScraperService) {}

  async check(): Promise<HealthCheckResponse> {
    const lastSyncedAt = await this.scraperService.getLastSyncedAt();
    const version = process.env.BACKEND_VERSION || DEFAULT_BACKEND_VERSION;
    const rawCommitSha = process.env.GIT_COMMIT_SHA || DEFAULT_COMMIT_SHA;
    const commitSha = rawCommitSha.slice(0, 7);
    const builtAt = process.env.BUILD_TIMESTAMP || null;

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      lastSyncedAt,
      version,
      commitSha,
      uptimeSeconds: Math.floor(process.uptime()),
      builtAt,
    };
  }
}
