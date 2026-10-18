import { createHash } from 'crypto';
import { existsSync, symlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

export function resolveFrontendDistPath(): string {
  const candidates = [
    process.env.FRONTEND_DIST_PATH,
    join(__dirname, '..', 'frontend'),
    join(process.cwd(), 'dist/apps/frontend'),
    join(process.cwd(), '..', '..', 'dist/apps/frontend'),
  ];

  let resolvedPath = join(process.cwd(), 'dist/apps/frontend');

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      resolvedPath = candidate;
      break;
    }
  }

  // Express sendFile blocks paths containing dot-segments (e.g. .worktrees).
  // A temporary symlink ensures seamless SPA serving in isolated git worktrees.
  if (resolvedPath.includes('/.')) {
    const hash = createHash('md5').update(resolvedPath).digest('hex').slice(0, 8);
    const symlinkPath = join(tmpdir(), `sundayleague-frontend-${hash}`);

    if (!existsSync(symlinkPath)) {
      try {
        symlinkSync(resolvedPath, symlinkPath);
      } catch {

        return resolvedPath;
      }
    }

    return symlinkPath;
  }

  return resolvedPath;
}
