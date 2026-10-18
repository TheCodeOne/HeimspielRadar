/**
 * Curated list of major Baden-Württemberg & German cities for instant autocomplete,
 * with postal codes and geographic coordinates.
 */

export interface CitySuggestion {
  name: string;
  lat: number;
  lng: number;
  postalCodes: string[];
  state?: string;
  isOnlineResult?: boolean;
}

export const CURATED_CITIES: CitySuggestion[] = [
  {
    name: 'Stuttgart',
    lat: 48.7758,
    lng: 9.1829,
    postalCodes: [
      '70173',
      '70174',
      '70176',
      '70178',
      '70180',
      '70182',
      '70184',
      '70186',
      '70188',
      '70190',
      '70191',
      '70192',
      '70193',
      '70195',
      '70197',
      '70199',
      '70327',
      '70329',
      '70372',
      '70374',
      '70435',
      '70469',
      '70499',
      '70563',
      '70565',
      '70567',
      '70569',
      '70597',
      '70599',
    ],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Karlsruhe',
    lat: 49.0069,
    lng: 8.4037,
    postalCodes: [
      '76131',
      '76133',
      '76135',
      '76137',
      '76139',
      '76149',
      '76185',
      '76187',
      '76189',
      '76199',
      '76227',
      '76228',
      '76229',
    ],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Mannheim',
    lat: 49.4875,
    lng: 8.466,
    postalCodes: [
      '68159',
      '68161',
      '68163',
      '68165',
      '68167',
      '68169',
      '68199',
      '68219',
      '68229',
      '68239',
      '68259',
      '68305',
      '68307',
      '68309',
    ],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Freiburg im Breisgau',
    lat: 47.999,
    lng: 7.8421,
    postalCodes: [
      '79098',
      '79100',
      '79102',
      '79104',
      '79106',
      '79108',
      '79110',
      '79111',
      '79112',
      '79114',
      '79115',
      '79117',
    ],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Heidelberg',
    lat: 49.3988,
    lng: 8.6724,
    postalCodes: [
      '69115',
      '69117',
      '69118',
      '69120',
      '69121',
      '69123',
      '69124',
      '69126',
    ],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Ulm',
    lat: 48.4011,
    lng: 9.9876,
    postalCodes: ['89073', '89075', '89077', '89079', '89081'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Heilbronn',
    lat: 49.1427,
    lng: 9.2109,
    postalCodes: ['74072', '74074', '74076', '74078', '74080', '74081'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Pforzheim',
    lat: 48.8922,
    lng: 8.6946,
    postalCodes: [
      '75172',
      '75173',
      '75175',
      '75177',
      '75179',
      '75180',
      '75181',
    ],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Reutlingen',
    lat: 48.4914,
    lng: 9.2043,
    postalCodes: ['72760', '72762', '72764', '72766', '72768', '72770'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Tübingen',
    lat: 48.5216,
    lng: 9.0576,
    postalCodes: ['72070', '72072', '72074', '72076'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Ludwigsburg',
    lat: 48.8974,
    lng: 9.1919,
    postalCodes: ['71634', '71636', '71638', '71640', '71642'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Esslingen am Neckar',
    lat: 48.7428,
    lng: 9.3072,
    postalCodes: ['73728', '73730', '73732', '73733', '73734'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Konstanz',
    lat: 47.6779,
    lng: 9.1732,
    postalCodes: ['78462', '78464', '78465', '78467'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Göppingen',
    lat: 48.7047,
    lng: 9.6525,
    postalCodes: ['73033', '73035', '73037'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Waiblingen',
    lat: 48.8317,
    lng: 9.3168,
    postalCodes: ['71332', '71334', '71336'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Offenburg',
    lat: 48.4737,
    lng: 7.9446,
    postalCodes: ['77652', '77654', '77656'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Ravensburg',
    lat: 47.7818,
    lng: 9.6108,
    postalCodes: ['88212', '88213', '88214'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Crailsheim',
    lat: 49.1347,
    lng: 10.0705,
    postalCodes: ['74564'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Bietigheim-Bissingen',
    lat: 48.9614,
    lng: 9.1278,
    postalCodes: ['74321'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Aalen',
    lat: 48.8378,
    lng: 10.0928,
    postalCodes: ['73430', '73431', '73432', '73433', '73434'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Schwäbisch Gmünd',
    lat: 48.7997,
    lng: 9.7984,
    postalCodes: ['73525', '73527', '73529'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Baden-Baden',
    lat: 48.7606,
    lng: 8.2398,
    postalCodes: ['76530', '76532', '76534'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Sindelfingen',
    lat: 48.7086,
    lng: 9.0039,
    postalCodes: ['71063', '71065', '71067', '71069'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Böblingen',
    lat: 48.6866,
    lng: 9.0125,
    postalCodes: ['71032', '71034'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Villingen-Schwenningen',
    lat: 48.0601,
    lng: 8.4587,
    postalCodes: ['78048', '78050', '78052', '78054', '78056'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Friedrichshafen',
    lat: 47.6542,
    lng: 9.4792,
    postalCodes: ['88045', '88046', '88048'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Schwäbisch Hall',
    lat: 49.1123,
    lng: 9.7375,
    postalCodes: ['74523'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Rottweil',
    lat: 48.1672,
    lng: 8.6272,
    postalCodes: ['78628'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Nürtingen',
    lat: 48.6256,
    lng: 9.3361,
    postalCodes: ['72622'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Kirchheim unter Teck',
    lat: 48.6481,
    lng: 9.4514,
    postalCodes: ['73230'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Filderstadt',
    lat: 48.6797,
    lng: 9.2189,
    postalCodes: ['70794'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Fellbach',
    lat: 48.8087,
    lng: 9.2758,
    postalCodes: ['70734', '70736'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Schorndorf',
    lat: 48.8058,
    lng: 9.5278,
    postalCodes: ['73614'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Lörrach',
    lat: 47.6156,
    lng: 7.6625,
    postalCodes: ['79539', '79540', '79541'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Singen',
    lat: 47.7631,
    lng: 8.8415,
    postalCodes: ['78224'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Heidenheim an der Brenz',
    lat: 48.6783,
    lng: 10.1517,
    postalCodes: ['89518', '89520', '89522'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Rottenburg am Neckar',
    lat: 48.4776,
    lng: 8.9344,
    postalCodes: ['72108'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Balingen',
    lat: 48.2736,
    lng: 8.8517,
    postalCodes: ['72336'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Calw',
    lat: 48.7153,
    lng: 8.7397,
    postalCodes: ['75365'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Freudenstadt',
    lat: 48.4636,
    lng: 8.4144,
    postalCodes: ['72250'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Weinheim',
    lat: 49.5539,
    lng: 8.6697,
    postalCodes: ['69469'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Sinsheim',
    lat: 49.2536,
    lng: 8.8772,
    postalCodes: ['74889'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Bruchsal',
    lat: 49.1242,
    lng: 8.5986,
    postalCodes: ['76646'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Rastatt',
    lat: 48.8572,
    lng: 8.2031,
    postalCodes: ['76437'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Mosbach',
    lat: 49.3528,
    lng: 9.1461,
    postalCodes: ['74821'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Tauberbischofsheim',
    lat: 49.6225,
    lng: 9.6628,
    postalCodes: ['97941'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Wertheim',
    lat: 49.7583,
    lng: 9.5167,
    postalCodes: ['97877'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Tuttlingen',
    lat: 47.9847,
    lng: 8.8178,
    postalCodes: ['78532'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Biberach an der Riß',
    lat: 48.0983,
    lng: 9.7917,
    postalCodes: ['88400'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Überlingen',
    lat: 47.7664,
    lng: 9.1605,
    postalCodes: ['88662'],
    state: 'Baden-Württemberg',
  },
  {
    name: 'Frankfurt am Main',
    lat: 50.1109,
    lng: 8.6821,
    postalCodes: ['60311', '60313'],
    state: 'Hessen',
  },
  {
    name: 'München',
    lat: 48.1351,
    lng: 11.582,
    postalCodes: ['80331', '80333'],
    state: 'Bayern',
  },
  {
    name: 'Nürnberg',
    lat: 49.4521,
    lng: 11.0767,
    postalCodes: ['90403'],
    state: 'Bayern',
  },
  {
    name: 'Würzburg',
    lat: 49.7916,
    lng: 9.9536,
    postalCodes: ['97070'],
    state: 'Bayern',
  },
  {
    name: 'Augsburg',
    lat: 48.3705,
    lng: 10.8978,
    postalCodes: ['86150'],
    state: 'Bayern',
  },
  {
    name: 'Berlin',
    lat: 52.52,
    lng: 13.405,
    postalCodes: ['10115'],
    state: 'Berlin',
  },
  {
    name: 'Köln',
    lat: 50.9375,
    lng: 6.9603,
    postalCodes: ['50667'],
    state: 'Nordrhein-Westfalen',
  },
  {
    name: 'Hamburg',
    lat: 53.5511,
    lng: 9.9937,
    postalCodes: ['20095'],
    state: 'Hamburg',
  },
];

/**
 * Searches the curated cities list instantaneously without any network request.
 * Scores matches based on exact city name, name prefix, exact PLZ, and PLZ prefix.
 */
export function searchCuratedCities(
  query: string,
  limit = 5,
): CitySuggestion[] {
  const q = query.trim().toLowerCase();

  if (!q) {
    return [];
  }

  const results: { city: CitySuggestion; score: number }[] = [];

  for (const city of CURATED_CITIES) {
    const cityNameLower = city.name.toLowerCase();
    let score = 0;

    if (cityNameLower === q) {
      score = 100;
    } else if (city.postalCodes.some((plz) => plz === q)) {
      score = 95;
    } else if (cityNameLower.startsWith(q)) {
      score = 80;
    } else if (city.postalCodes.some((plz) => plz.startsWith(q))) {
      score = 75;
    } else if (cityNameLower.includes(q)) {
      score = 50;
    } else if (city.postalCodes.some((plz) => plz.includes(q))) {
      score = 40;
    }

    if (score > 0) {
      results.push({ city, score });
    }
  }

  results.sort(
    (a, b) => b.score - a.score || a.city.name.localeCompare(b.city.name),
  );

  return results.slice(0, limit).map((r) => r.city);
}

interface PhotonGeoJsonResponse {
  type: string;
  features?: Array<{
    properties?: {
      name?: string;
      city?: string;
      postcode?: string;
      state?: string;
      country?: string;
      district?: string;
    };
    geometry?: {
      type: string;
      coordinates: [number, number]; // [lng, lat]
    };
  }>;
}

/**
 * Fetches geocoded location suggestions from Photon (Komoot OpenStreetMap geocoder).
 * Used as fallback for arbitrary postal codes or towns not in the curated list.
 */
export async function fetchPhotonGeocode(
  query: string,
  referenceCoords?: { lat: number; lng: number },
  signal?: AbortSignal,
): Promise<CitySuggestion[]> {
  const trimmed = query.trim();

  if (!trimmed) {
    return [];
  }

  let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=3`;

  if (referenceCoords) {
    url += `&lat=${referenceCoords.lat}&lon=${referenceCoords.lng}`;
  }

  try {
    const res = await fetch(url, { signal });

    if (!res.ok) {
      return [];
    }

    // SAFETY: Photon API returns a GeoJSON FeatureCollection with features array
    const data = (await res.json()) as PhotonGeoJsonResponse;

    if (!data.features || !Array.isArray(data.features)) {
      return [];
    }

    const suggestions: CitySuggestion[] = [];

    for (const feat of data.features) {
      if (!feat.geometry?.coordinates || feat.geometry.coordinates.length < 2) {
        continue;
      }

      const [lng, lat] = feat.geometry.coordinates;

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        continue;
      }

      const props = feat.properties ?? {};
      const rawName = props.name ?? '';
      const rawCity = props.city ?? '';
      const isPlzName = /^\d{5}$/.test(rawName);
      const postcode = props.postcode ?? (isPlzName ? rawName : '');

      let displayName = '';

      if (postcode && rawCity) {
        displayName = `${postcode} ${rawCity}`;
      } else if (rawCity) {
        displayName = rawCity;
      } else if (rawName) {
        displayName = rawName;
      } else {
        displayName = trimmed;
      }

      if (
        props.district &&
        props.district !== rawCity &&
        props.district !== rawName
      ) {
        displayName += ` (${props.district})`;
      }

      suggestions.push({
        name: displayName,
        lat: Math.round(lat * 10000) / 10000,
        lng: Math.round(lng * 10000) / 10000,
        postalCodes: postcode ? [postcode] : [],
        state: props.state || props.country,
        isOnlineResult: true,
      });
    }

    return suggestions;
  } catch {
    return [];
  }
}
