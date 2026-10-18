import { Injectable, Logger } from '@nestjs/common';

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

export interface RateLimitConfig {
  minDelayMs?: number;
  baseBackoffMs?: number;
  maxRetries?: number;
}

interface NominatimPlace {
  lat: string;
  lon: string;
  display_name: string;
}

interface PhotonFeature {
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: {
    name?: string;
    street?: string;
    postcode?: string;
    city?: string;
    country?: string;
  };
}

interface PhotonResponse {
  features?: PhotonFeature[];
}

interface CentroidEntry {
  latitude: number;
  longitude: number;
  label: string;
}

const BAWUE_CITY_CENTROIDS: ReadonlyMap<string, CentroidEntry> = new Map([
  ['stuttgart', { latitude: 48.7758, longitude: 9.1829, label: 'Stuttgart' }],
  ['karlsruhe', { latitude: 49.0069, longitude: 8.4037, label: 'Karlsruhe' }],
  ['mannheim', { latitude: 49.4875, longitude: 8.466, label: 'Mannheim' }],
  ['freiburg', { latitude: 47.999, longitude: 7.8421, label: 'Freiburg im Breisgau' }],
  ['heidelberg', { latitude: 49.3988, longitude: 8.6724, label: 'Heidelberg' }],
  ['ulm', { latitude: 48.4011, longitude: 9.9876, label: 'Ulm' }],
  ['heilbronn', { latitude: 49.1427, longitude: 9.2109, label: 'Heilbronn' }],
  ['pforzheim', { latitude: 48.8922, longitude: 8.6946, label: 'Pforzheim' }],
  ['reutlingen', { latitude: 48.4914, longitude: 9.2043, label: 'Reutlingen' }],
  ['tübingen', { latitude: 48.5216, longitude: 9.0576, label: 'Tübingen' }],
  ['tuebingen', { latitude: 48.5216, longitude: 9.0576, label: 'Tübingen' }],
  ['ludwigsburg', { latitude: 48.8973, longitude: 9.1916, label: 'Ludwigsburg' }],
  ['esslingen', { latitude: 48.7406, longitude: 9.3108, label: 'Esslingen am Neckar' }],
  ['konstanz', { latitude: 47.6779, longitude: 9.1732, label: 'Konstanz' }],
  ['waiblingen', { latitude: 48.8302, longitude: 9.3168, label: 'Waiblingen' }],
  ['bietigheim-bissingen', { latitude: 48.9597, longitude: 9.1274, label: 'Bietigheim-Bissingen' }],
  ['bad mergentheim', { latitude: 49.4922, longitude: 9.7732, label: 'Bad Mergentheim' }],
  ['isny', { latitude: 47.6919, longitude: 10.0394, label: 'Isny im Allgäu' }],
  ['bad boll', { latitude: 48.6392, longitude: 9.6152, label: 'Bad Boll' }],
  ['göppingen', { latitude: 48.7035, longitude: 9.6521, label: 'Göppingen' }],
  ['sindelfingen', { latitude: 48.7093, longitude: 9.0029, label: 'Sindelfingen' }],
  ['böblingen', { latitude: 48.6856, longitude: 9.0153, label: 'Böblingen' }],
  ['offenburg', { latitude: 48.473, longitude: 7.9447, label: 'Offenburg' }],
  ['villingen-schwenningen', { latitude: 48.0623, longitude: 8.4586, label: 'Villingen-Schwenningen' }],
  ['ravensburg', { latitude: 47.7819, longitude: 9.6136, label: 'Ravensburg' }],
  ['heidenheim', { latitude: 48.6761, longitude: 10.1546, label: 'Heidenheim an der Brenz' }],
  ['schwäbisch hall', { latitude: 49.1124, longitude: 9.7375, label: 'Schwäbisch Hall' }],
  ['schwäbisch gmünd', { latitude: 48.7995, longitude: 9.7981, label: 'Schwäbisch Gmünd' }],
  ['aalen', { latitude: 48.8378, longitude: 10.0933, label: 'Aalen' }],
  ['crailsheim', { latitude: 49.1347, longitude: 10.0706, label: 'Crailsheim' }],
  ['kirchheim', { latitude: 48.6484, longitude: 9.451, label: 'Kirchheim unter Teck' }],
  ['nürtingen', { latitude: 48.6267, longitude: 9.3352, label: 'Nürtingen' }],
  ['lörrach', { latitude: 47.6156, longitude: 7.6615, label: 'Lörrach' }],
  ['kehl', { latitude: 48.5721, longitude: 7.809, label: 'Kehl' }],
]);

const BAWUE_PLZ_PREFIX_CENTROIDS: ReadonlyMap<string, CentroidEntry> = new Map([
  ['68', { latitude: 49.4875, longitude: 8.466, label: 'Region Mannheim (PLZ 68xxx)' }],
  ['69', { latitude: 49.3988, longitude: 8.6724, label: 'Region Heidelberg (PLZ 69xxx)' }],
  ['70', { latitude: 48.7758, longitude: 9.1829, label: 'Region Stuttgart (PLZ 70xxx)' }],
  ['71', { latitude: 48.8302, longitude: 9.15, label: 'Region Böblingen / Ludwigsburg / Waiblingen (PLZ 71xxx)' }],
  ['72', { latitude: 48.4914, longitude: 9.13, label: 'Region Tübingen / Reutlingen (PLZ 72xxx)' }],
  ['73', { latitude: 48.7406, longitude: 9.65, label: 'Region Esslingen / Göppingen / Ostalb (PLZ 73xxx)' }],
  ['74', { latitude: 49.1427, longitude: 9.45, label: 'Region Heilbronn / Hohenlohe (PLZ 74xxx)' }],
  ['75', { latitude: 48.8922, longitude: 8.6946, label: 'Region Pforzheim / Nordschwarzwald (PLZ 75xxx)' }],
  ['76', { latitude: 49.0069, longitude: 8.4037, label: 'Region Karlsruhe / Baden (PLZ 76xxx)' }],
  ['77', { latitude: 48.473, longitude: 7.9447, label: 'Region Offenburg / Ortenau (PLZ 77xxx)' }],
  ['78', { latitude: 47.9, longitude: 8.8, label: 'Region Konstanz / Schwarzwald-Baar (PLZ 78xxx)' }],
  ['79', { latitude: 47.999, longitude: 7.8421, label: 'Region Freiburg / Südbaden (PLZ 79xxx)' }],
  ['88', { latitude: 47.7819, longitude: 9.6136, label: 'Region Friedrichshafen / Ravensburg / Allgäu (PLZ 88xxx)' }],
  ['89', { latitude: 48.4011, longitude: 9.9876, label: 'Region Ulm / Heidenheim (PLZ 89xxx)' }],
]);

const USER_AGENT = 'SundayleagueApp/1.0 (dimi-sundayleague-basketball)';

@Injectable()
export class GeocoderService {
  private readonly logger = new Logger(GeocoderService.name);
  private readonly cache = new Map<string, GeocodeResult>();
  private readonly inFlightMap = new Map<string, Promise<GeocodeResult | null>>();
  private queue: Promise<void> = Promise.resolve();
  private lastRequestTimestamp = 0;
  private minDelayMs = 1100; // Respect OSM Nominatim 1 req/sec policy
  private baseBackoffMs = 1500;
  private maxRetries = 3;

  /**
   * Allows overriding rate limit and backoff parameters (e.g., in unit tests).
   */
  configureRateLimit(config: RateLimitConfig): void {
    if (config.minDelayMs !== undefined) {
      this.minDelayMs = config.minDelayMs;
    }

    if (config.baseBackoffMs !== undefined) {
      this.baseBackoffMs = config.baseBackoffMs;
    }

    if (config.maxRetries !== undefined) {
      this.maxRetries = config.maxRetries;
    }
  }

  /**
   * Clears the in-memory address deduplication cache.
   */
  clearCache(): void {
    this.cache.clear();
    this.inFlightMap.clear();
  }

  /**
   * Geocodes an address to latitude and longitude using:
   * 1. In-memory normalized address deduplication cache & in-flight map
   * 2. Global serial FIFO promise queue (concurrency = 1)
   * 3. Primary provider: OpenStreetMap Nominatim with HTTP 429/503 exponential backoff
   * 4. Secondary provider: Photon Komoot OSM API
   * 5. Offline Baden-Württemberg PLZ/city centroid fallback
   */
  async geocodeAddress(
    street: string,
    postalCode: string,
    city: string
  ): Promise<GeocodeResult | null> {
    const cleanStreet = this.normalizeText(street);
    const cleanPostalCode = this.normalizeText(postalCode);
    const cleanCity = this.normalizeText(city);

    if (!cleanStreet && !cleanCity && !cleanPostalCode) {
      return null;
    }

    const cacheKey = this.buildCacheKey(cleanStreet, cleanPostalCode, cleanCity);
    const cachedResult = this.cache.get(cacheKey);

    if (cachedResult) {
      return cachedResult;
    }

    const existingInFlight = this.inFlightMap.get(cacheKey);

    if (existingInFlight) {
      return existingInFlight;
    }

    const taskPromise = this.enqueue(() =>
      this.resolveAddress(cleanStreet, cleanPostalCode, cleanCity)
    )
      .then((result) => {
        if (result) {
          this.cache.set(cacheKey, result);
        }

        return result;
      })
      .finally(() => {
        this.inFlightMap.delete(cacheKey);
      });

    this.inFlightMap.set(cacheKey, taskPromise);

    return taskPromise;
  }

  private normalizeText(value: string): string {
    if (!value) {
      return '';
    }

    return value.trim().replace(/\s+/g, ' ');
  }

  private buildCacheKey(street: string, postalCode: string, city: string): string {
    return `${street}|${postalCode}|${city}`.toLowerCase().replace(/ß/g, 'ss');
  }

  /**
   * Enqueues a task onto the global serial FIFO promise chain (concurrency = 1).
   */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const resultPromise = this.queue.then(task, task);

    this.queue = resultPromise.then(
      () => undefined,
      () => undefined
    );

    return resultPromise;
  }

  private async resolveAddress(
    street: string,
    postalCode: string,
    city: string
  ): Promise<GeocodeResult | null> {
    const query = [street, postalCode, city, 'Deutschland']
      .filter((part) => part.length > 0)
      .join(', ');

    // 1. Primary Provider: Nominatim full street query
    const primaryOutcome = await this.queryNominatim(query, true);

    if (primaryOutcome.result) {
      return primaryOutcome.result;
    }

    // 2. Nominatim PLZ + City fallback query (only if street search returned 0 results without persistent error)
    if (!primaryOutcome.failed && street && (postalCode || city)) {
      const fallbackQuery = `${[postalCode, city].filter((part) => part.length > 0).join(' ')}, Deutschland`;
      const fallbackOutcome = await this.queryNominatim(fallbackQuery, false);

      if (fallbackOutcome.result) {
        return fallbackOutcome.result;
      }
    }

    // 3. Secondary Provider: Photon Komoot OSM API
    const photonResult = await this.queryPhoton(query, postalCode, city);

    if (photonResult) {
      return photonResult;
    }

    // 4. Offline Baden-Württemberg PLZ/City Centroid Fallback
    const centroidFallback = this.lookupOfflineCentroid(postalCode, city);

    if (centroidFallback) {
      this.logger.warn(
        `Using offline centroid fallback for "${query}" -> ${centroidFallback.displayName}`
      );

      return centroidFallback;
    }

    this.logger.warn(`No geocoding results found for "${query}"`);

    return null;
  }

  private async queryNominatim(
    query: string,
    includeAddressDetails: boolean
  ): Promise<{ result: GeocodeResult | null; failed: boolean }> {
    const detailsParam = includeAddressDetails ? '&addressdetails=1' : '';

    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query
    )}&format=json&limit=1${detailsParam}`;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt === 0) {
          await this.waitForRateLimitSlot();
        }

        this.logger.debug(`Geocoding query (Nominatim, attempt ${attempt + 1}): "${query}"`);

        const response = await fetch(url, {
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'application/json',
          },
        });

        if (response.status === 429 || response.status === 503) {
          if (attempt < this.maxRetries) {
            const backoffMs = this.computeBackoffMs(response, attempt);

            this.logger.warn(
              `Nominatim returned HTTP ${response.status} for "${query}". Backing off for ${backoffMs}ms (retry ${
                attempt + 1
              }/${this.maxRetries})`
            );

            await this.sleep(backoffMs);
            this.lastRequestTimestamp = Date.now();
            continue;
          }

          this.logger.warn(
            `Nominatim returned HTTP ${response.status} for "${query}" after ${this.maxRetries} retries`
          );

          return { result: null, failed: true };
        }

        if (!response.ok) {
          this.logger.warn(`Nominatim returned HTTP ${response.status} for "${query}"`);

          return { result: null, failed: true };
        }

        // SAFETY: Nominatim search API returns an array of NominatimPlace objects
        const results = (await response.json()) as NominatimPlace[];

        if (results && results.length > 0) {
          const item = results[0];
          const latitude = parseFloat(item.lat);
          const longitude = parseFloat(item.lon);

          if (!Number.isNaN(latitude) && !Number.isNaN(longitude)) {
            return {
              result: {
                latitude,
                longitude,
                displayName: item.display_name,
              },
              failed: false,
            };
          }
        }

        return { result: null, failed: false };
      } catch (error) {
        this.logger.error(`Error querying Nominatim for "${query}":`, error);

        return { result: null, failed: true };
      }
    }

    return { result: null, failed: true };
  }

  private async queryPhoton(
    fullQuery: string,
    postalCode: string,
    city: string
  ): Promise<GeocodeResult | null> {
    const queries = [fullQuery];

    const cityFallbackQuery = [postalCode, city, 'Deutschland']
      .filter((part) => part.length > 0)
      .join(' ');

    if (cityFallbackQuery && cityFallbackQuery !== fullQuery) {
      queries.push(cityFallbackQuery);
    }

    for (const q of queries) {
      try {
        await this.waitForRateLimitSlot();

        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1`;

        this.logger.debug(`Trying secondary Photon geocoder for "${q}"`);

        const response = await fetch(url, {
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          this.logger.warn(`Photon returned HTTP ${response.status} for "${q}"`);
          continue;
        }

        // SAFETY: Photon API returns a GeoJSON FeatureCollection matching PhotonResponse
        const data = (await response.json()) as PhotonResponse;

        if (data?.features && data.features.length > 0) {
          const feature = data.features[0];
          const coords = feature.geometry?.coordinates;

          if (coords && coords.length >= 2) {
            const longitude = Number(coords[0]);
            const latitude = Number(coords[1]);

            if (!Number.isNaN(latitude) && !Number.isNaN(longitude)) {
              const displayName =
                feature.properties?.name ||
                [
                  feature.properties?.street,
                  feature.properties?.postcode,
                  feature.properties?.city,
                ]
                  .filter(Boolean)
                  .join(', ') ||
                q;

              return {
                latitude,
                longitude,
                displayName,
              };
            }
          }
        }
      } catch (error) {
        this.logger.error(`Error querying Photon for "${q}":`, error);
      }
    }

    return null;
  }

  private lookupOfflineCentroid(postalCode: string, city: string): GeocodeResult | null {
    const normalizedCity = city.toLowerCase();

    if (normalizedCity) {
      const exactMatch = BAWUE_CITY_CENTROIDS.get(normalizedCity);

      if (exactMatch) {
        return {
          latitude: exactMatch.latitude,
          longitude: exactMatch.longitude,
          displayName: `${[postalCode, exactMatch.label].filter(Boolean).join(' ')}, Deutschland (Centroid)`,
        };
      }

      for (const [key, entry] of BAWUE_CITY_CENTROIDS.entries()) {
        if (normalizedCity.includes(key) || key.includes(normalizedCity)) {
          return {
            latitude: entry.latitude,
            longitude: entry.longitude,
            displayName: `${[postalCode, entry.label].filter(Boolean).join(' ')}, Deutschland (Centroid)`,
          };
        }
      }
    }

    const digitsOnly = postalCode.replace(/\D/g, '');

    if (digitsOnly.length >= 2) {
      const prefix = digitsOnly.slice(0, 2);
      const prefixMatch = BAWUE_PLZ_PREFIX_CENTROIDS.get(prefix);

      if (prefixMatch) {
        const locationLabel = [postalCode, city].filter(Boolean).join(' ') || prefixMatch.label;

        return {
          latitude: prefixMatch.latitude,
          longitude: prefixMatch.longitude,
          displayName: `${locationLabel}, Deutschland (Centroid)`,
        };
      }
    }

    return null;
  }

  private computeBackoffMs(response: Response, attempt: number): number {
    const retryAfterHeader = response.headers?.get?.('Retry-After');

    if (retryAfterHeader) {
      const retryAfterSeconds = Number(retryAfterHeader);

      if (!Number.isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
        return retryAfterSeconds * 1000;
      }
    }

    return this.baseBackoffMs * Math.pow(2, attempt);
  }

  private async waitForRateLimitSlot(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTimestamp;

    if (elapsed < this.minDelayMs) {
      const waitTime = this.minDelayMs - elapsed;
      await this.sleep(waitTime);
    }

    this.lastRequestTimestamp = Date.now();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
