import { Test, type TestingModule } from '@nestjs/testing';
import { PushController } from './push.controller';
import { PushService } from './push.service';

interface MockPushService {
  getVapidPublicKey: jest.Mock;
  registerReminder: jest.Mock;
  deleteReminder: jest.Mock;
}

describe('PushController', () => {
  let controller: PushController;

  let mockPushService: MockPushService;

  beforeEach(async () => {
    mockPushService = {
      getVapidPublicKey: jest.fn().mockReturnValue({ publicKey: 'mock-public-key' }),
      registerReminder: jest.fn().mockResolvedValue({ success: true, matchId: 10, leadTime: '2h' }),
      deleteReminder: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PushController],
      providers: [
        {
          provide: PushService,
          useValue: mockPushService,
        },
      ],
    }).compile();

    controller = module.get<PushController>(PushController);
  });

  describe('getVapidPublicKey', () => {
    it('returns public VAPID key object', () => {
      const res = controller.getVapidPublicKey();

      expect(res).toEqual({ publicKey: 'mock-public-key' });
      expect(mockPushService.getVapidPublicKey).toHaveBeenCalled();
    });
  });

  describe('registerReminder', () => {
    it('delegates registration to push service', async () => {
      const dto = {
        matchId: 10,
        leadTime: '2h' as const,
        subscription: {
          endpoint: 'https://push',
          keys: { p256dh: 'k', auth: 'a' },
        },
      };

      const res = await controller.registerReminder(dto);

      expect(res).toEqual({ success: true, matchId: 10, leadTime: '2h' });
      expect(mockPushService.registerReminder).toHaveBeenCalledWith(dto);
    });
  });

  describe('deleteReminder', () => {
    it('delegates deletion to push service with query or body endpoint', async () => {
      const res = await controller.deleteReminder(10, 'https://push-query', undefined);

      expect(res).toEqual({ success: true });
      expect(mockPushService.deleteReminder).toHaveBeenCalledWith(10, 'https://push-query');
    });
  });
});
