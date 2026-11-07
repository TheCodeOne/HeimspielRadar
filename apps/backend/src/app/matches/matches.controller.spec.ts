import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Match } from '@sundayleague/shared-types';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

describe('MatchesController', () => {
  let controller: MatchesController;
  let findByIdMock: jest.Mock;

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

    const matchesService = {
      findMatches: jest.fn().mockResolvedValue([mockMatch]),
      findById: findByIdMock,
      findTeamSuggestions: jest.fn().mockResolvedValue([]),
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
});
