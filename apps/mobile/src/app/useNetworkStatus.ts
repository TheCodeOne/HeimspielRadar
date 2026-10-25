import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export interface NetworkStatus {
  isOnline: boolean;
  isInternetReachable: boolean | null;
  connectionType: string;
}

function getInitialWebStatus(): NetworkStatus {
  if (typeof navigator !== 'undefined') {
    const isOnline = navigator.onLine !== false;

    return {
      isOnline,
      isInternetReachable: isOnline,
      connectionType: 'web',
    };
  }

  return {
    isOnline: true,
    isInternetReachable: true,
    connectionType: 'unknown',
  };
}

/**
 * Universal hook for monitoring network connectivity with cross-platform and web fallbacks.
 */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(() => {
    if (Platform.OS === 'web') {
      return getInitialWebStatus();
    }

    return {
      isOnline: true,
      isInternetReachable: true,
      connectionType: 'unknown',
    };
  });

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleOnline = () => {
        setStatus({
          isOnline: true,
          isInternetReachable: true,
          connectionType: 'web',
        });
      };

      const handleOffline = () => {
        setStatus({
          isOnline: false,
          isInternetReachable: false,
          connectionType: 'web',
        });
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const isOnline = state.isConnected ?? true;

      setStatus({
        isOnline,
        isInternetReachable: state.isInternetReachable,
        connectionType: state.type,
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return status;
}
