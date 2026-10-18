import { Injectable, Logger } from '@nestjs/common';

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

@Injectable()
export class GeocoderService {
  private readonly logger = new Logger(GeocoderService.name);
  private lastRequestTimestamp = 0;
  private readonly minDelayMs = 1100; // Respect OSM Nominatim 1 req/sec policy

  /**
   * Geocodes an address to latitude and longitude using OpenStreetMap Nominatim.
   */
  async geocodeAddress(
    street: string,
    postalCode: string,
    city: string
  ): Promise<GeocodeResult | null> {
    const query = [street, postalCode, city, 'Deutschland']
      .filter((part) => !!part && part.trim().length > 0)
      .join(', ');

    if (!query || (!street && !city)) {
      return null;
    }

    try {
      await this.enforceRateLimit();

      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        query
      )}&format=json&limit=1&addressdetails=1`;

      this.logger.debug(`Geocoding query: "${query}"`);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'SundayleagueApp/1.0 (dimi-sundayleague-basketball)',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        this.logger.warn(`Nominatim returned HTTP ${response.status} for "${query}"`);

        return null;
      }

      // SAFETY: Nominatim search API returns an array of Place objects
      const results = (await response.json()) as Array<{
        lat: string;
        lon: string;
        display_name: string;
      }>;

      if (results && results.length > 0) {
        const item = results[0];

        return {
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon),
          displayName: item.display_name,
        };
      }

      // Fallback: Try with just PLZ and City if street search returned 0 results
      if (street && (postalCode || city)) {
        await this.enforceRateLimit();

        const fallbackQuery = `${postalCode} ${city}, Deutschland`.trim();

        const fallbackUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          fallbackQuery
        )}&format=json&limit=1`;

        this.logger.debug(`Trying fallback query: "${fallbackQuery}"`);

        const fallbackRes = await fetch(fallbackUrl, {
          headers: {
            'User-Agent': 'SundayleagueApp/1.0 (dimi-sundayleague-basketball)',
            Accept: 'application/json',
          },
        });

        if (fallbackRes.ok) {
          // SAFETY: Nominatim search API returns an array of Place objects
          const fallbackResults = (await fallbackRes.json()) as Array<{
            lat: string;
            lon: string;
            display_name: string;
          }>;

          if (fallbackResults && fallbackResults.length > 0) {
            return {
              latitude: parseFloat(fallbackResults[0].lat),
              longitude: parseFloat(fallbackResults[0].lon),
              displayName: fallbackResults[0].display_name,
            };
          }
        }
      }

      this.logger.warn(`No geocoding results found for "${query}"`);

      return null;
    } catch (error) {
      this.logger.error(`Error geocoding address "${query}":`, error);

      return null;
    }
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTimestamp;

    if (elapsed < this.minDelayMs) {
      const waitTime = this.minDelayMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTimestamp = Date.now();
  }
}
