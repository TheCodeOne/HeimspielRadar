import * as React from 'react';
import { RefreshCw, Wifi, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';

export function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error: Error) {
      console.error('Service Worker registration error:', error);
    },
  });

  const handleClose = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) {
    return null;
  }

  return (
    <aside
      aria-label="PWA Status-Benachrichtigung"
      className="fixed bottom-20 left-4 right-4 z-50 flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-background/95 p-3.5 shadow-2xl backdrop-blur-md sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-md"
    >
      <div className="flex-1 text-xs">
        {offlineReady ? (
          <div className="flex items-center gap-2 font-medium text-foreground">
            <Wifi className="h-4 w-4 shrink-0 text-emerald-500" />
            <span>App ist bereit für die Offline-Nutzung</span>
          </div>
        ) : (
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <RefreshCw className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span>Aktualisierung verfügbar</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Neue Inhalte oder Optimierungen verfügbar. Jetzt neu laden?
            </p>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {needRefresh && (
          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={() => updateServiceWorker(true)}
            className="h-7 px-2.5 text-xs font-medium"
          >
            Neu laden
          </Button>
        )}

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleClose}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          aria-label="Schließen"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </aside>
  );
}
