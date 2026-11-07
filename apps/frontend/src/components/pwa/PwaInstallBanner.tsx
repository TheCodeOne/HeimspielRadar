import { Download, Share, Smartphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePwaInstall, type UsePwaInstallReturn } from '@/hooks/usePwaInstall';

export interface PwaInstallBannerProps {
  installHook?: UsePwaInstallReturn;
  onDismiss?: () => void;
}

export function PwaInstallBanner({
  installHook,
  onDismiss,
}: PwaInstallBannerProps) {
  const hookResult = usePwaInstall();
  const install = installHook ?? hookResult;

  const {
    canPromptInstall,
    isIosSafari,
    shouldShowBanner,
    triggerInstall,
    dismissBanner,
  } = install;

  if (!shouldShowBanner) {
    return null;
  }

  const handleDismiss = () => {
    dismissBanner();
    onDismiss?.();
  };

  return (
    <aside
      aria-label="PWA Installation"
      data-testid="pwa-install-banner"
      className="fixed bottom-20 left-4 right-4 z-40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-card/95 p-3.5 shadow-2xl backdrop-blur-md sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-md animate-in fade-in slide-in-from-bottom-3 duration-200"
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
          <Smartphone className="h-4.5 w-4.5" />
        </div>

        <div className="min-w-0 flex-1 space-y-0.5">
          <h3 className="text-xs font-bold text-foreground leading-tight">
            HeimspielRadar als App nutzen
          </h3>

          <p className="text-[11px] text-muted-foreground leading-tight">
            {isIosSafari
              ? 'Tippe auf Teilen ➔ Zum Home-Bildschirm für Offline-Zugriff und Push-Erinnerungen.'
              : 'Installiere HeimspielRadar für schnellen Zugriff & Offline-Heimspiele.'}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-1.5 self-end sm:self-center">
        {canPromptInstall && (
          <Button
            type="button"
            size="sm"
            data-testid="pwa-install-trigger"
            onClick={() => triggerInstall()}
            className="h-7 px-2.5 text-xs font-semibold gap-1.5 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Installieren</span>
          </Button>
        )}

        {isIosSafari && !canPromptInstall && (
          <div className="inline-flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
            <Share className="h-3 w-3 shrink-0" />
            <span>Teilen ➔ Home-Bildschirm</span>
          </div>
        )}

        <Button
          type="button"
          size="sm"
          variant="ghost"
          data-testid="pwa-install-dismiss"
          onClick={handleDismiss}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
          aria-label="Installationshinweis schließen"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </aside>
  );
}
