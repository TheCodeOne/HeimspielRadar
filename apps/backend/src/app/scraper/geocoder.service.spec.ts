import { Test, TestingModule } from '@nestjs/testing';
import { GeocoderService } from './geocoder.service';

describe('GeocoderService', () => {
  let service: GeocoderService;
  let fetchSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GeocoderService],
    }).compile();

    service = module.get<GeocoderService>(GeocoderService);
    service.configureRateLimit({
      minDelayMs: 25,
      baseBackoffMs: 20,
      maxRetries: 3,
    });

    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return null immediately when street, postalCode, and city are all empty', async () => {
    const result = await service.geocodeAddress('   ', '', '  ');

    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  describe('Normalized Address Deduplication Cache & In-Flight Map', () => {
    it('should cache resolved addresses and make 0 HTTP requests on subsequent normalized matches', async () => {
      fetchSpy.mockImplementation(
        async () =>
          new Response(
            JSON.stringify([
              {
                lat: '48.7758',
                lon: '9.1829',
                display_name: 'Mercedesstraße 100, 70372 Stuttgart, Deutschland',
              },
            ]),
            { status: 200 }
          )
      );

      const first = await service.geocodeAddress('Mercedesstraße 100', '70372', 'Stuttgart');

      const second = await service.geocodeAddress(
        '  MERCEDESSTRAßE   100 ',
        ' 70372 ',
        '  stuttgart '
      );

      expect(first).toEqual({
        latitude: 48.7758,
        longitude: 9.1829,
        displayName: 'Mercedesstraße 100, 70372 Stuttgart, Deutschland',
      });
      expect(second).toEqual(first);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('should deduplicate concurrent in-flight requests for the same normalized address', async () => {
      fetchSpy.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));

        return new Response(
          JSON.stringify([
            {
              lat: '49.0069',
              lon: '8.4037',
              display_name: 'Hermann-Veit-Straße 7, 76135 Karlsruhe, Deutschland',
            },
          ]),
          { status: 200 }
        );
      });

      const [res1, res2, res3] = await Promise.all([
        service.geocodeAddress('Hermann-Veit-Straße 7', '76135', 'Karlsruhe'),
        service.geocodeAddress('  hermann-veit-straße   7 ', '76135', 'KARLSRUHE'),
        service.geocodeAddress('Hermann-Veit-Straße 7', ' 76135 ', 'karlsruhe'),
      ]);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(res1).toEqual(res2);
      expect(res2).toEqual(res3);
      expect(res1?.latitude).toBeCloseTo(49.0069, 4);
    });
  });

  describe('Global Serial FIFO Promise Queue (Concurrency = 1)', () => {
    it('should strictly serialize concurrent geocoding calls with concurrency = 1 and minimum delay', async () => {
      service.configureRateLimit({ minDelayMs: 30, baseBackoffMs: 20, maxRetries: 2 });

      let activeRequests = 0;
      let maxObservedConcurrency = 0;
      const callOrder: string[] = [];
      const callTimestamps: number[] = [];

      fetchSpy.mockImplementation(async (input: string | URL | Request) => {
        const urlStr = String(input);
        activeRequests++;

        if (activeRequests > maxObservedConcurrency) {
          maxObservedConcurrency = activeRequests;
        }

        callTimestamps.push(Date.now());
        callOrder.push(urlStr);

        await new Promise((resolve) => setTimeout(resolve, 10));
        activeRequests--;

        return new Response(
          JSON.stringify([
            {
              lat: '48.5',
              lon: '9.1',
              display_name: urlStr,
            },
          ]),
          { status: 200 }
        );
      });

      const results = await Promise.all([
        service.geocodeAddress('Street 1', '70173', 'Stuttgart'),
        service.geocodeAddress('Street 2', '76133', 'Karlsruhe'),
        service.geocodeAddress('Street 3', '68159', 'Mannheim'),
      ]);

      expect(results).toHaveLength(3);
      expect(maxObservedConcurrency).toBe(1);
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(callOrder[0]).toContain(encodeURIComponent('Street 1'));
      expect(callOrder[1]).toContain(encodeURIComponent('Street 2'));
      expect(callOrder[2]).toContain(encodeURIComponent('Street 3'));

      const firstToSecondGap = callTimestamps[1] - callTimestamps[0];
      const secondToThirdGap = callTimestamps[2] - callTimestamps[1];

      expect(firstToSecondGap).toBeGreaterThanOrEqual(25);
      expect(secondToThirdGap).toBeGreaterThanOrEqual(25);
    });
  });

  describe('HTTP 429 Exponential Backoff & Retry-After', () => {
    it('should retry with exponential backoff on HTTP 429 and succeed when Nominatim recovers', async () => {
      service.configureRateLimit({ minDelayMs: 10, baseBackoffMs: 20, maxRetries: 3 });

      let attempts = 0;

      fetchSpy.mockImplementation(async () => {
        attempts++;

        if (attempts <= 2) {
          return new Response('Too Many Requests', { status: 429 });
        }

        return new Response(
          JSON.stringify([
            {
              lat: '48.6392',
              lon: '9.6152',
              display_name: 'Schulweg 1, 73087 Bad Boll, Deutschland',
            },
          ]),
          { status: 200 }
        );
      });

      const result = await service.geocodeAddress('Schulweg 1', '73087', 'Bad Boll');

      expect(attempts).toBe(3);
      expect(result).toEqual({
        latitude: 48.6392,
        longitude: 9.6152,
        displayName: 'Schulweg 1, 73087 Bad Boll, Deutschland',
      });
    });

    it('should honor numeric Retry-After header when present on HTTP 429', async () => {
      service.configureRateLimit({ minDelayMs: 5, baseBackoffMs: 500, maxRetries: 2 });

      let attempts = 0;

      fetchSpy.mockImplementation(async () => {
        attempts++;

        if (attempts === 1) {
          return new Response('Too Many Requests', {
            status: 429,
            headers: { 'Retry-After': '0.02' },
          });
        }

        return new Response(
          JSON.stringify([
            {
              lat: '48.4011',
              lon: '9.9876',
              display_name: 'Olgastraße 1, 89073 Ulm, Deutschland',
            },
          ]),
          { status: 200 }
        );
      });

      const start = Date.now();
      const result = await service.geocodeAddress('Olgastraße 1', '89073', 'Ulm');
      const elapsed = Date.now() - start;

      expect(attempts).toBe(2);
      expect(elapsed).toBeLessThan(300);
      expect(result?.latitude).toBeCloseTo(48.4011, 4);
    });
  });

  describe('Secondary Provider (Photon Komoot API) & Offline BaWü Centroid Fallbacks', () => {
    it('should fall back to Photon Komoot API when Nominatim returns empty results', async () => {
      fetchSpy.mockImplementation(async (input: string | URL | Request) => {
        const urlStr = String(input);

        if (urlStr.includes('nominatim.openstreetmap.org')) {
          return new Response(JSON.stringify([]), { status: 200 });
        }

        if (urlStr.includes('photon.komoot.io')) {
          return new Response(
            JSON.stringify({
              features: [
                {
                  geometry: {
                    coordinates: [9.2109, 49.1427],
                  },
                  properties: {
                    name: 'Mönchseehalle Heilbronn',
                    city: 'Heilbronn',
                  },
                },
              ],
            }),
            { status: 200 }
          );
        }

        return new Response('Not Found', { status: 404 });
      });

      const result = await service.geocodeAddress('Karlstraße 44', '74072', 'Heilbronn');

      expect(result).toEqual({
        latitude: 49.1427,
        longitude: 9.2109,
        displayName: 'Mönchseehalle Heilbronn',
      });
    });

    it('should fall back to Photon after Nominatim exhausts all 429 retries', async () => {
      service.configureRateLimit({ minDelayMs: 5, baseBackoffMs: 10, maxRetries: 2 });

      let nominatimCalls = 0;
      let photonCalls = 0;

      fetchSpy.mockImplementation(async (input: string | URL | Request) => {
        const urlStr = String(input);

        if (urlStr.includes('nominatim.openstreetmap.org')) {
          nominatimCalls++;

          return new Response('Too Many Requests', { status: 429 });
        }

        if (urlStr.includes('photon.komoot.io')) {
          photonCalls++;

          return new Response(
            JSON.stringify({
              features: [
                {
                  geometry: {
                    coordinates: [9.0576, 48.5216],
                  },
                  properties: {
                    name: 'Paul Horn-Arena Tübingen',
                  },
                },
              ],
            }),
            { status: 200 }
          );
        }

        return new Response('Not Found', { status: 404 });
      });

      const result = await service.geocodeAddress('Europaplatz 3', '72072', 'Tübingen');

      expect(nominatimCalls).toBe(3); // 1 initial + 2 retries
      expect(photonCalls).toBe(1);
      expect(result).toEqual({
        latitude: 48.5216,
        longitude: 9.0576,
        displayName: 'Paul Horn-Arena Tübingen',
      });
    });

    it('should fall back to offline BaWü city/PLZ centroid when both Nominatim and Photon fail', async () => {
      service.configureRateLimit({ minDelayMs: 5, baseBackoffMs: 5, maxRetries: 1 });

      fetchSpy.mockImplementation(
        async () => new Response('Service Unavailable', { status: 500 })
      );

      const cityResult = await service.geocodeAddress(
        'Unbekannte Halle 99',
        '71638',
        'Ludwigsburg'
      );

      expect(cityResult).not.toBeNull();
      expect(cityResult?.latitude).toBeCloseTo(48.8973, 3);
      expect(cityResult?.longitude).toBeCloseTo(9.1916, 3);
      expect(cityResult?.displayName).toContain('Ludwigsburg');

      const plzPrefixResult = await service.geocodeAddress(
        'Dorfstraße 1',
        '88499',
        'Riedlingen'
      );

      expect(plzPrefixResult).not.toBeNull();
      expect(plzPrefixResult?.latitude).toBeCloseTo(47.7819, 3);
      expect(plzPrefixResult?.longitude).toBeCloseTo(9.6136, 3);
      expect(plzPrefixResult?.displayName).toContain('88499 Riedlingen');
    });

    it('should return null when all live providers fail and address is outside BaWü centroid table', async () => {
      service.configureRateLimit({ minDelayMs: 5, baseBackoffMs: 5, maxRetries: 1 });

      fetchSpy.mockImplementation(
        async () => new Response(JSON.stringify([]), { status: 200 })
      );

      const result = await service.geocodeAddress('Alexanderplatz 1', '10178', 'Berlin');

      expect(result).toBeNull();
    });
  });
});
