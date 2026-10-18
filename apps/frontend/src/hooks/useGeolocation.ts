import * as React from 'react';

export interface GeolocationPositionCoords {
  lat: number;
  lng: number;
  accuracy?: number;
}

export type GeolocationPermissionState =
  | 'prompt'
  | 'granted'
  | 'denied'
  | 'unsupported';

export interface UseGeolocationReturn {
  location: GeolocationPositionCoords | null;
  error: string | null;
  loading: boolean;
  permissionState: GeolocationPermissionState;
  requestLocation: () => Promise<GeolocationPositionCoords | null>;
}

const STORAGE_KEY = 'heimspielradar_geolocation_coords';

function parseStoredCoords(data: string): GeolocationPositionCoords | null {
  try {
    // SAFETY: Parse string payload retrieved from localStorage
    const parsed = JSON.parse(data);

    if (!parsed) {
      return null;
    }

    const lat = Number(parsed.lat);
    const lng = Number(parsed.lng);
    const accuracy = Number(parsed.accuracy);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }

    return {
      lat,
      lng,
      accuracy: Number.isFinite(accuracy) ? accuracy : undefined,
    };
  } catch {
    return null;
  }
}

function loadStoredLocation(): GeolocationPositionCoords | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return null;
    }

    return parseStoredCoords(raw);
  } catch {
    return null;
  }
}

export function useGeolocation(): UseGeolocationReturn {
  const [location, setLocation] =
    React.useState<GeolocationPositionCoords | null>(loadStoredLocation);

  const [error, setError] = React.useState<string | null>(null);

  const [loading, setLoading] = React.useState<boolean>(false);

  const [permissionState, setPermissionState] =
    React.useState<GeolocationPermissionState>('prompt');

  // Monitor Geolocation permission query changes
  React.useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setPermissionState('unsupported');

      return;
    }

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((status) => {
          setPermissionState(status.state);

          const handleChange = () => {
            setPermissionState(status.state);
          };

          status.addEventListener('change', handleChange);

          return () => {
            status.removeEventListener('change', handleChange);
          };
        })
        .catch(() => {
          // Fallback if browser does not support querying 'geolocation' permission
        });
    }
  }, []);

  const requestLocation = React.useCallback((): Promise<GeolocationPositionCoords | null> => {
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        const errorMsg =
          'Geolocation wird von diesem Browser nicht unterstützt.';

        setError(errorMsg);
        setPermissionState('unsupported');
        setLoading(false);
        resolve(null);

        return;
      }

      setLoading(true);
      setError(null);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = Math.round(position.coords.latitude * 100000) / 100000;
          const lng = Math.round(position.coords.longitude * 100000) / 100000;

          const coords: GeolocationPositionCoords = {
            lat,
            lng,
            accuracy: position.coords.accuracy,
          };

          setLocation(coords);
          setError(null);
          setLoading(false);
          setPermissionState('granted');

          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(coords));
          } catch {
            // Storage quota or private browsing mode
          }

          resolve(coords);
        },
        (geoError) => {
          let errorMsg = 'Standort konnte nicht ermittelt werden.';

          switch (geoError.code) {
            case geoError.PERMISSION_DENIED:
              errorMsg =
                'Standortzugriff verweigert. Bitte erlaube den Standortzugriff in deinen Browsereinstellungen.';
              setPermissionState('denied');
              break;

            case geoError.POSITION_UNAVAILABLE:
              errorMsg =
                'Standortinformationen sind derzeit nicht verfügbar.';
              break;

            case geoError.TIMEOUT:
              errorMsg = 'Zeitüberschreitung bei der Standortabfrage.';
              break;

            default:
              errorMsg = geoError.message || errorMsg;
              break;
          }

          setError(errorMsg);
          setLoading(false);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        },
      );
    });
  }, []);

  return {
    location,
    error,
    loading,
    permissionState,
    requestLocation,
  };
}
