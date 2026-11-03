import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Match, VenueSubmission } from '@sundayleague/shared-types';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

describe('MatchesController', () => {
  let controller: MatchesController;
  let findByIdMock: jest.Mock;
  let createKioskSubmissionMock: jest.Mock;

  const mockMatch: Match = {
    id: 12345,
    leagueId: 99,
    league: {
      id: 99,
      dbbId: 99,
      name: 'Bezirksliga Herren',
    },
    matchDay: 4,
    matchNo: 401,
    kickoffDate: '2026-11-20',
    kickoffTime: '19:00',
    homeTeam: { id: 1, dbbId: 10, name: 'TSG Stuttgart' },
    guestTeam: { id: 2, dbbId: 20, name: 'MTV Ludwigsburg' },
    venue: {
      id: 50,
      name: 'Sporthalle Mitte',
      street: 'Hauptstr. 1',
      postalCode: '70173',
      city: 'Stuttgart',
      latitude: 48.7758,
      longitude: 9.1829,
    },
    result: null,
    confirmed: true,
  };

  beforeEach(async () => {
    findByIdMock = jest.fn();
    createKioskSubmissionMock = jest.fn();

    const matchesService = {
      findMatches: jest.fn().mockResolvedValue([mockMatch]),
      findById: findByIdMock,
      findTeamSuggestions: jest.fn().mockResolvedValue([]),
      createKioskSubmission: createKioskSubmissionMock,
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MatchesController],
      providers: [
        {
          provide: MatchesService,
          useValue: matchesService,
        },
      ],
    }).compile();

    controller = module.get<MatchesController>(MatchesController);
  });

  describe('getMatchById', () => {
    it('returns match when found by ID', async () => {
      findByIdMock.mockResolvedValueOnce(mockMatch);

      const result = await controller.getMatchById(12345);

      expect(findByIdMock).toHaveBeenCalledWith(12345);
      expect(result).toEqual(mockMatch);
    });

    it('throws NotFoundException when match does not exist', async () => {
      findByIdMock.mockResolvedValueOnce(null);

      await expect(controller.getMatchById(99999)).rejects.toThrow(
        NotFoundException
      );
      expect(findByIdMock).toHaveBeenCalledWith(99999);
    });
  });

  describe('submitKioskInfo', () => {
    it('delegates valid kiosk submission to matchesService.createKioskSubmission', async () => {
      const mockSubmission: VenueSubmission = {
        id: 7,
        matchId: 12345,
        venueId: 50,
        submitterName: 'Max',
        submitterRole: 'Trainer',
        submittedData: {
          admissionFee: 'Eintritt frei',
          kioskDescription: 'Waffeln & Kaffee',
          parkingNotes: 'Parkplatz hinter der Halle',
          matchNotes: null,
        },
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      createKioskSubmissionMock.mockResolvedValueOnce(mockSubmission);

      const dto = {
        admissionFee: 'Eintritt frei',
        kioskDescription: 'Waffeln & Kaffee',
        parkingNotes: 'Parkplatz hinter der Halle',
        submitterName: 'Max',
        submitterRole: 'Trainer',
      };

      const result = await controller.submitKioskInfo(12345, dto);

      expect(createKioskSubmissionMock).toHaveBeenCalledWith(12345, dto);
      expect(result).toEqual(mockSubmission);
    });

    it('throws BadRequestException when no content field is provided', async () => {
      await expect(
        controller.submitKioskInfo(12345, {
          submitterName: 'Max',
          submitterRole: 'Fan',
        })
      ).rejects.toThrow(BadRequestException);

      expect(createKioskSubmissionMock).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when field exceeds max length', async () => {
      await expect(
        controller.submitKioskInfo(12345, {
          admissionFee: 'x'.repeat(51),
        })
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.submitKioskInfo(12345, {
          kioskDescription: 'x'.repeat(201),
        })
      ).rejects.toThrow(BadRequestException);
    });
  });
});
