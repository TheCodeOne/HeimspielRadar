import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class AdminApiGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    const isEnabled = process.env['ENABLE_ADMIN_API'] === 'true';

    if (!isEnabled) {
      throw new NotFoundException('Admin API is not enabled');
    }

    return true;
  }
}
