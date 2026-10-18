import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScraperAuthGuard } from './scraper-auth.guard';

type HttpArgumentsHost = ReturnType<ExecutionContext['switchToHttp']>;

function createMockContext(headers: Record<string, string | undefined>): ExecutionContext {
  const httpHost: HttpArgumentsHost = {
    // SAFETY: Generic HttpArgumentsHost mock returning fake express request with given headers
    getRequest: <T>() => ({ headers }) as T,
    // SAFETY: Mock empty response object
    getResponse: <T>() => ({}) as T,
    // SAFETY: Mock empty next function
    getNext: <T>() => (() => {}) as T,
  };

  return {
    switchToHttp: () => httpHost,
    getClass: jest.fn(),
    getHandler: jest.fn(),
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
    getType: jest.fn(),
  };
}

describe('ScraperAuthGuard', () => {
  let guard: ScraperAuthGuard;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'SCRAPER_SECRET') {
          return 'super-secret-token';
        }

        if (key === 'NODE_ENV') {
          return 'test';
        }

        return undefined;
      }),
    };

    // SAFETY: Partial ConfigService mock providing get method for ScraperAuthGuard unit tests
    guard = new ScraperAuthGuard(mockConfigService as ConfigService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('when SCRAPER_SECRET is configured', () => {
    it('should throw UnauthorizedException when authorization header is missing', () => {
      const context = createMockContext({});

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Invalid or missing scraper secret token');
    });

    it('should throw UnauthorizedException when authorization header does not use Bearer scheme', () => {
      const context = createMockContext({
        authorization: 'Basic dXNlcjpwYXNz',
      });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Invalid or missing scraper secret token');
    });

    it('should throw UnauthorizedException when Bearer token is empty', () => {
      const context = createMockContext({
        authorization: 'Bearer ',
      });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Invalid or missing scraper secret token');
    });

    it('should throw UnauthorizedException on invalid token mismatch', () => {
      const context = createMockContext({
        authorization: 'Bearer wrong-secret',
      });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Invalid or missing scraper secret token');
    });

    it('should return true on valid token', () => {
      const context = createMockContext({
        authorization: 'Bearer super-secret-token',
      });

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('when SCRAPER_SECRET is not configured', () => {
    it('should allow request in development mode', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'NODE_ENV') {
          return 'development';
        }

        return undefined;
      });

      const context = createMockContext({});

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should throw UnauthorizedException in production mode', () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'NODE_ENV') {
          return 'production';
        }

        return undefined;
      });

      const context = createMockContext({});

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow(
        'Scraper secret is not configured on the server'
      );
    });
  });
});
