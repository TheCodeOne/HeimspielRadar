import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type {
  CreateKioskSubmissionDto,
  UpdateSubmissionDto,
  VenueSubmission,
} from '@sundayleague/shared-types';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';

interface MockSubmissionsService {
  createSubmission: jest.Mock;
  getSubmissions: jest.Mock;
  getSubmissionById: jest.Mock;
  approveSubmission: jest.Mock;
  rejectSubmission: jest.Mock;
  updateSubmission: jest.Mock;
  deleteSubmission: jest.Mock;
}

describe('SubmissionsController', () => {
  let controller: SubmissionsController;

  let serviceMock: MockSubmissionsService;

  const sampleSubmission: VenueSubmission = {
    id: 42,
    matchId: 101,
    venueId: 901,
    submitterName: 'Lukas',
    submitterRole: 'Trainer',
    submittedData: {
      admissionFee: '2 EUR',
      kioskDescription: 'Kaffee & Kuchen',
      parkingNotes: 'Parkplatz P1',
      matchNotes: null,
    },
    scope: 'matchday',
    status: 'pending',
    createdAt: new Date('2026-11-01T12:00:00Z').toISOString(),
    updatedAt: new Date('2026-11-01T12:00:00Z').toISOString(),
  };

  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = {
      ...originalEnv,
      ENABLE_ADMIN_API: 'true',
      ADMIN_API_SECRET: 'test-secret',
    };

    serviceMock = {
      createSubmission: jest.fn().mockResolvedValue(sampleSubmission),
      getSubmissions: jest.fn().mockResolvedValue([sampleSubmission]),
      getSubmissionById: jest.fn().mockResolvedValue(sampleSubmission),
      approveSubmission: jest
        .fn()
        .mockResolvedValue({ ...sampleSubmission, status: 'approved' }),
      rejectSubmission: jest
        .fn()
        .mockResolvedValue({ ...sampleSubmission, status: 'rejected' }),
      updateSubmission: jest.fn().mockResolvedValue({
        ...sampleSubmission,
        submittedData: { ...sampleSubmission.submittedData, admissionFee: '3 EUR' },
      }),
      deleteSubmission: jest.fn().mockResolvedValue({ id: 42, deleted: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubmissionsController],
      providers: [
        {
          provide: SubmissionsService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<SubmissionsController>(SubmissionsController);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createSubmission (POST /api/submissions)', () => {
    it('delegates creation to submissionsService.createSubmission', async () => {
      const dto: CreateKioskSubmissionDto = {
        matchId: 101,
        admissionFee: '2 EUR',
        kioskDescription: 'Kaffee & Kuchen',
      };

      const result = await controller.createSubmission(dto);

      expect(serviceMock.createSubmission).toHaveBeenCalledWith(dto);
      expect(result).toEqual(sampleSubmission);
    });
  });

  describe('getSubmissions (GET /api/submissions)', () => {
    it('delegates to submissionsService.getSubmissions with optional status filter', async () => {
      const result = await controller.getSubmissions('pending');

      expect(serviceMock.getSubmissions).toHaveBeenCalledWith('pending');
      expect(result).toEqual([sampleSubmission]);
    });
  });

  describe('getSubmissionById (GET /api/submissions/:id)', () => {
    it('delegates to submissionsService.getSubmissionById', async () => {
      const result = await controller.getSubmissionById(42);

      expect(serviceMock.getSubmissionById).toHaveBeenCalledWith(42);
      expect(result).toEqual(sampleSubmission);
    });
  });

  describe('approveSubmission (POST /api/submissions/:id/approve)', () => {
    it('delegates to submissionsService.approveSubmission', async () => {
      const result = await controller.approveSubmission(42);

      expect(serviceMock.approveSubmission).toHaveBeenCalledWith(42);
      expect(result.status).toBe('approved');
    });
  });

  describe('approveSubmissionGet (GET /api/submissions/:id/approve)', () => {
    it('verifies token and delegates approval', async () => {
      const result = await controller.approveSubmissionGet(
        42,
        'test-secret',
        undefined
      );

      expect(serviceMock.approveSubmission).toHaveBeenCalledWith(42);
      expect(result.status).toBe('approved');
    });

    it('throws UnauthorizedException when token is invalid', async () => {
      await expect(
        controller.approveSubmissionGet(42, 'wrong-token', undefined)
      ).rejects.toThrow(UnauthorizedException);

      expect(serviceMock.approveSubmission).not.toHaveBeenCalled();
    });
  });

  describe('rejectSubmission (POST /api/submissions/:id/reject)', () => {
    it('delegates to submissionsService.rejectSubmission', async () => {
      const result = await controller.rejectSubmission(42);

      expect(serviceMock.rejectSubmission).toHaveBeenCalledWith(42);
      expect(result.status).toBe('rejected');
    });
  });

  describe('rejectSubmissionGet (GET /api/submissions/:id/reject)', () => {
    it('verifies token and delegates rejection', async () => {
      const result = await controller.rejectSubmissionGet(
        42,
        undefined,
        'Bearer test-secret'
      );

      expect(serviceMock.rejectSubmission).toHaveBeenCalledWith(42);
      expect(result.status).toBe('rejected');
    });

    it('throws UnauthorizedException when token is invalid', async () => {
      await expect(
        controller.rejectSubmissionGet(42, 'wrong-token', undefined)
      ).rejects.toThrow(UnauthorizedException);

      expect(serviceMock.rejectSubmission).not.toHaveBeenCalled();
    });
  });

  describe('updateSubmission (PATCH /api/submissions/:id)', () => {
    it('delegates update to submissionsService.updateSubmission', async () => {
      const dto: UpdateSubmissionDto = {
        admissionFee: '3 EUR',
      };

      const result = await controller.updateSubmission(42, dto);

      expect(serviceMock.updateSubmission).toHaveBeenCalledWith(42, dto);
      expect(result.submittedData.admissionFee).toBe('3 EUR');
    });
  });

  describe('deleteSubmission (DELETE /api/submissions/:id)', () => {
    it('delegates deletion to submissionsService.deleteSubmission', async () => {
      const result = await controller.deleteSubmission(42);

      expect(serviceMock.deleteSubmission).toHaveBeenCalledWith(42);
      expect(result).toEqual({ id: 42, deleted: true });
    });
  });
});
