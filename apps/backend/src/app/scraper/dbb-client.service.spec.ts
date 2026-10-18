import { Test, TestingModule } from '@nestjs/testing';
import { DbbClientService, DbbLigaData, DbbWamLigaResponse } from './dbb-client.service';

describe('DbbClientService', () => {
  let service: DbbClientService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DbbClientService],
    }).compile();

    service = module.get<DbbClientService>(DbbClientService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fetchAllWamLeagues', () => {
    it('should paginate through multiple pages until hasMoreData is false', async () => {
      const page1Leagues: DbbLigaData[] = [
        { ligaId: 101, liganame: 'Oberliga 1' },
        { ligaId: 102, liganame: 'Oberliga 2' },
      ];

      const page2Leagues: DbbLigaData[] = [
        { ligaId: 103, liganame: 'Landesliga 1' },
      ];

      const fetchWamSpy = jest
        .spyOn(service, 'fetchWamLeagues')
        .mockImplementation(async (_verbandId: number, startAtIndex: number): Promise<DbbWamLigaResponse> => {
          if (startAtIndex === 0) {
            return {
              data: {
                startAtIndex: 0,
                hasMoreData: true,
                size: 2,
                ligen: page1Leagues,
              },
            };
          }

          return {
            data: {
              startAtIndex: 2,
              hasMoreData: false,
              size: 1,
              ligen: page2Leagues,
            },
          };
        });

      const result = await service.fetchAllWamLeagues(1);

      expect(fetchWamSpy).toHaveBeenCalledTimes(2);
      expect(fetchWamSpy).toHaveBeenNthCalledWith(1, 1, 0);
      expect(fetchWamSpy).toHaveBeenNthCalledWith(2, 1, 2);
      expect(result).toHaveLength(3);
      expect(result[0].ligaId).toBe(101);
      expect(result[1].ligaId).toBe(102);
      expect(result[2].ligaId).toBe(103);
    });

    it('should stop immediately if a page returns empty ligen', async () => {
      jest
        .spyOn(service, 'fetchWamLeagues')
        .mockImplementation(async (): Promise<DbbWamLigaResponse> => ({
          data: {
            startAtIndex: 0,
            hasMoreData: true,
            size: 0,
            ligen: [],
          },
        }));

      const result = await service.fetchAllWamLeagues(1);

      expect(result).toHaveLength(0);
    });
  });
});
