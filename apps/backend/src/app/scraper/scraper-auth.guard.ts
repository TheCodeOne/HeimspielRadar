import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class ScraperAuthGuard implements CanActivate {
  private readonly logger = new Logger(ScraperAuthGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const scraperSecret =
      this.configService.get<string>('SCRAPER_SECRET') || process.env.SCRAPER_SECRET;

    if (!scraperSecret) {
      const nodeEnv =
        this.configService.get<string>('NODE_ENV') || process.env.NODE_ENV || 'development';

      if (nodeEnv === 'production') {
        throw new UnauthorizedException('Scraper secret is not configured on the server');
      }

      this.logger.warn(
        'SCRAPER_SECRET is not configured in local environment. Allowing request in development mode.'
      );

      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers?.['authorization'] || request.headers?.['Authorization'];
    const authString = Array.isArray(authHeader) ? authHeader[0] : authHeader;

    if (!authString) {
      throw new UnauthorizedException('Invalid or missing scraper secret token');
    }

    const [scheme, ...tokenParts] = authString.split(' ');
    const token = tokenParts.join(' ').trim();

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid or missing scraper secret token');
    }

    if (token !== scraperSecret) {
      throw new UnauthorizedException('Invalid or missing scraper secret token');
    }

    return true;
  }
}
