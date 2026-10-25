import { TelegramNotifierService, formatGermanDate, formatDuration } from './telegram-notifier.service';

function getFetchMock(): jest.Mock {
  // SAFETY: global.fetch is mocked as a jest.Mock in test suite
  return global.fetch as jest.Mock;
}

describe('TelegramNotifierService', () => {
  const originalEnv = process.env;
  let mockDb: any;
  let settingsMap: Map<string, string>;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    settingsMap = new Map();

    mockDb = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockImplementation((condition) => ({
            limit: jest.fn().mockImplementation(() => {
              // Extract key from queryChunks
              const paramChunk = condition?.queryChunks?.find(
                (chunk: { encoder?: unknown; value?: string }) =>
                  Boolean(chunk && 'encoder' in chunk && chunk.value)
              );

              const key = paramChunk?.value ?? 'mock_key';
              const val = settingsMap.get(key);

              return Promise.resolve(val ? [{ key, value: val }] : []);
            }),
          })),
        }),
      }),
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockImplementation((val) => ({
          onConflictDoUpdate: jest.fn().mockImplementation(({ set }) => {
            settingsMap.set(val.key, set.value);

            return Promise.resolve();
          }),
        })),
      }),
    };

    // SAFETY: global.fetch is mocked as a jest.Mock in test suite
    global.fetch = jest.fn() as any;
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('format helpers', () => {
    it('formats duration correctly', () => {
      expect(formatDuration(45000)).toBe('45s');
      expect(formatDuration(75000)).toBe('1m 15s');
      expect(formatDuration(120000)).toBe('2m 0s');
    });

    it('formats German date in Europe/Berlin timezone', () => {
      const summerDate = new Date('2026-06-15T16:02:00.000Z'); // CEST (UTC+2)
      const formatted = formatGermanDate(summerDate);
      expect(formatted).toContain('15.06.2026');
      expect(formatted).toContain('18:02 Uhr');
    });
  });

  describe('configuration', () => {
    it('returns false for isConfigured when tokens are missing', () => {
      delete process.env['TELEGRAM_BOT_TOKEN'];
      delete process.env['TELEGRAM_CHAT_ID'];

      const service = new TelegramNotifierService(mockDb);
      expect(service.isConfigured()).toBe(false);
    });

    it('returns true for isConfigured when tokens are set', () => {
      process.env['TELEGRAM_BOT_TOKEN'] = 'test-token';
      process.env['TELEGRAM_CHAT_ID'] = '123456';

      const service = new TelegramNotifierService(mockDb);
      expect(service.isConfigured()).toBe(true);
    });
  });

  describe('sendTestMessage', () => {
    it('returns failure when not configured', async () => {
      delete process.env['TELEGRAM_BOT_TOKEN'];
      delete process.env['TELEGRAM_CHAT_ID'];

      const service = new TelegramNotifierService(mockDb);
      const res = await service.sendTestMessage();

      expect(res.success).toBe(false);
      expect(res.message).toContain('not configured');
    });

    it('sends test message when configured and API succeeds', async () => {
      process.env['TELEGRAM_BOT_TOKEN'] = 'test-token';
      process.env['TELEGRAM_CHAT_ID'] = '123456';

      getFetchMock().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 99 } }),
      });

      const service = new TelegramNotifierService(mockDb);
      const res = await service.sendTestMessage();

      expect(res.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-token/sendMessage',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('123456'),
        })
      );
    });
  });

  describe('updateLiveStatus', () => {
    beforeEach(() => {
      process.env['TELEGRAM_BOT_TOKEN'] = 'test-token';
      process.env['TELEGRAM_CHAT_ID'] = '123456';
    });

    it('creates new live message if no saved message id', async () => {
      getFetchMock().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 101 } }),
      });

      const service = new TelegramNotifierService(mockDb);
      await service.updateLiveStatus({
        status: 'success',
        startedAt: new Date('2026-10-25T16:00:00Z'),
        finishedAt: new Date('2026-10-25T16:01:15Z'),
        durationMs: 75000,
        syncedMatches: 540,
        failuresCount: 0,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-token/sendMessage',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Alles OK'),
        })
      );
      expect(settingsMap.get('telegram_status_message_id')).toBe('101');
    });

    it('edits existing live message if message id exists in system settings', async () => {
      settingsMap.set('telegram_status_message_id', '202');

      getFetchMock().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 202 } }),
      });

      const service = new TelegramNotifierService(mockDb);
      await service.updateLiveStatus({
        status: 'success',
        startedAt: new Date('2026-10-25T16:00:00Z'),
        finishedAt: new Date('2026-10-25T16:01:15Z'),
        durationMs: 75000,
        syncedMatches: 540,
        failuresCount: 0,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-token/editMessageText',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"message_id":202'),
        })
      );
    });

    it('sends push alert when transitioning from healthy to failing', async () => {
      settingsMap.set('telegram_status_message_id', '202');
      settingsMap.set('telegram_last_health_status', 'healthy');

      getFetchMock()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ok: true, result: { message_id: 202 } }),
        }) // editMessageText for live status
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ok: true, result: { message_id: 303 } }),
        }); // sendMessage for push alert

      const service = new TelegramNotifierService(mockDb);
      await service.updateLiveStatus({
        status: 'partial',
        startedAt: new Date('2026-10-25T16:00:00Z'),
        finishedAt: new Date('2026-10-25T16:01:15Z'),
        durationMs: 75000,
        syncedMatches: 200,
        failuresCount: 2,
        failedLeagues: ['Oberliga Herren', 'Landesliga Damen'],
      });

      // 2 calls: first editMessageText, second sendMessage for push alert
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(settingsMap.get('telegram_last_health_status')).toBe('failing');
    });

    it('sends recovery push alert when transitioning from failing to healthy', async () => {
      settingsMap.set('telegram_status_message_id', '202');
      settingsMap.set('telegram_last_health_status', 'failing');

      getFetchMock()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ok: true, result: { message_id: 202 } }),
        }) // editMessageText
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ok: true, result: { message_id: 304 } }),
        }); // recovery push alert

      const service = new TelegramNotifierService(mockDb);
      await service.updateLiveStatus({
        status: 'success',
        startedAt: new Date('2026-10-25T16:00:00Z'),
        finishedAt: new Date('2026-10-25T16:01:15Z'),
        durationMs: 75000,
        syncedMatches: 540,
        failuresCount: 0,
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(settingsMap.get('telegram_last_health_status')).toBe('healthy');
    });
  });
});
