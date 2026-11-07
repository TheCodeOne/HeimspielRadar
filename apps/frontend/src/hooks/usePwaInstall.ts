import * as React from 'react';

export const PWA_INSTALL_STORAGE_KEY = 'heimspielradar:pwa-install:v1';
export const PWA_SESSION_VISITED_KEY = 'heimspielradar:pwa-install:session-visited';

export interface PwaInstallStorageData {
  visitCount: number;
  dismissed: boolean;
  dismissedAt?: string | null;
}

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt: () => Promise<void>;
}

export function readPwaInstallStorage(storage?: Storage): PwaInstallStorageData {
  const targetStorage =
    storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);

  if (!targetStorage) {
    return { visitCount: 0, dismissed: false, dismissedAt: null };
  }

  try {
    const raw = targetStorage.getItem(PWA_INSTALL_STORAGE_KEY);

    if (!raw) {
      return { visitCount: 0, dismissed: false, dismissedAt: null };
    }

    // SAFETY: Parse stored JSON representing PwaInstallStorageData
    const parsed = JSON.parse(raw) as Partial<PwaInstallStorageData>;

    const rawCount = Number(parsed.visitCount);
    const visitCount = Number.isFinite(rawCount) ? Math.max(0, rawCount) : 0;

    const dismissed = parsed.dismissed === true;
    const dismissedAt = parsed.dismissedAt ? String(parsed.dismissedAt) : null;

    return {
      visitCount,
      dismissed,
      dismissedAt,
    };
  } catch {
    return { visitCount: 0, dismissed: false, dismissedAt: null };
  }
}

export function savePwaInstallStorage(
  data: PwaInstallStorageData,
  storage?: Storage,
): void {
  const targetStorage =
    storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);

  if (!targetStorage) {
    return;
  }

  try {
    targetStorage.setItem(PWA_INSTALL_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota or permission errors
  }
}

export function recordPwaVisit(
  storage?: Storage,
  sessionStore?: Storage,
): PwaInstallStorageData {
  const current = readPwaInstallStorage(storage);

  const targetSession =
    sessionStore ?? (typeof window !== 'undefined' ? window.sessionStorage : undefined);

  // If already counted in this browser session, avoid duplicate increment
  if (targetSession) {
    try {
      const alreadyCounted = targetSession.getItem(PWA_SESSION_VISITED_KEY);

      if (alreadyCounted === '1') {
        return current;
      }

      targetSession.setItem(PWA_SESSION_VISITED_KEY, '1');
    } catch {
      // Ignore session storage errors
    }
  }

  const updated: PwaInstallStorageData = {
    ...current,
    visitCount: current.visitCount + 1,
  };

  savePwaInstallStorage(updated, storage);

  return updated;
}

export function dismissPwaInstall(storage?: Storage): PwaInstallStorageData {
  const current = readPwaInstallStorage(storage);

  const updated: PwaInstallStorageData = {
    ...current,
    dismissed: true,
    dismissedAt: new Date().toISOString(),
  };

  savePwaInstallStorage(updated, storage);

  return updated;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

export function getIsStandalone(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const isDisplayStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ?? false;

  // SAFETY: Legacy iOS Safari standalone property on navigator
  const nav = navigator as NavigatorWithStandalone;
  const isNavigatorStandalone = Boolean(nav?.standalone);

  return isDisplayStandalone || isNavigatorStandalone;
}

export function getIsIosSafari(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  if (getIsStandalone()) {
    return false;
  }

  const ua = navigator.userAgent;

  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if (!isIos) {
    return false;
  }

  // Not Chrome (CriOS), Firefox (FxiOS), Opera (OPiOS), Edge (EdgiOS)
  const isOtherBrowser = /CriOS|FxiOS|OPiOS|EdgiOS/i.test(ua);

  return !isOtherBrowser;
}

export interface UsePwaInstallOptions {
  storage?: Storage;
  sessionStore?: Storage;
}

export interface UsePwaInstallReturn {
  canPromptInstall: boolean;
  isStandalone: boolean;
  isIosSafari: boolean;
  shouldShowBanner: boolean;
  visitCount: number;
  dismissed: boolean;
  dismissedAt: string | null;
  triggerInstall: () => Promise<boolean>;
  dismissBanner: () => void;
}

export function usePwaInstall(options?: UsePwaInstallOptions): UsePwaInstallReturn {
  const [deferredPrompt, setDeferredPrompt] = React.useState<BeforeInstallPromptEvent | null>(
    null,
  );

  const [canPromptInstall, setCanPromptInstall] = React.useState(false);
  const [isStandalone, setIsStandalone] = React.useState(() => getIsStandalone());
  const [isIosSafari, setIsIosSafari] = React.useState(() => getIsIosSafari());

  const [installData, setInstallData] = React.useState<PwaInstallStorageData>(() =>
    readPwaInstallStorage(options?.storage),
  );

  // Record visit on initial mount
  React.useEffect(() => {
    const updated = recordPwaVisit(options?.storage, options?.sessionStore);

    setInstallData(updated);
    setIsStandalone(getIsStandalone());
    setIsIosSafari(getIsIosSafari());
  }, [options?.storage, options?.sessionStore]);

  // Listen for beforeinstallprompt event
  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // SAFETY: Cast event to BeforeInstallPromptEvent supported on Chromium
      const promptEvent = e as BeforeInstallPromptEvent;

      promptEvent.preventDefault();
      setDeferredPrompt(promptEvent);
      setCanPromptInstall(true);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setCanPromptInstall(false);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const triggerInstall = React.useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;

      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
        setCanPromptInstall(false);
        setIsStandalone(true);

        return true;
      }

      return false;
    } catch (err) {
      console.error('PWA install prompt error:', err);

      return false;
    }
  }, [deferredPrompt]);

  const dismissBanner = React.useCallback(() => {
    const updated = dismissPwaInstall(options?.storage);

    setInstallData(updated);
  }, [options?.storage]);

  const shouldShowBanner =
    !isStandalone &&
    !installData.dismissed &&
    installData.visitCount >= 2 &&
    (canPromptInstall || isIosSafari);

  return {
    canPromptInstall,
    isStandalone,
    isIosSafari,
    shouldShowBanner,
    visitCount: installData.visitCount,
    dismissed: installData.dismissed,
    dismissedAt: installData.dismissedAt ?? null,
    triggerInstall,
    dismissBanner,
  };
}
