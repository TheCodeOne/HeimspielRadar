import * as React from 'react';
import { Coffee, Eye, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ColdStartOverlayProps {
  isVisible: boolean;
  onDismiss: () => void;
  className?: string;
}

export function ColdStartOverlay({
  isVisible,
  onDismiss,
  className = '',
}: ColdStartOverlayProps) {
  const [shouldRender, setShouldRender] = React.useState<boolean>(isVisible);
  const [isFadingOut, setIsFadingOut] = React.useState<boolean>(false);

  React.useEffect(() => {
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;

    if (isVisible) {
      setShouldRender(true);
      setIsFadingOut(false);
    } else if (shouldRender) {
      setIsFadingOut(true);

      fadeTimer = setTimeout(() => {
        setShouldRender(false);
        setIsFadingOut(false);
      }, 400);
    }

    return () => {
      if (fadeTimer !== null) {
        clearTimeout(fadeTimer);
      }
    };
  }, [isVisible, shouldRender]);

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Server-Start Benachrichtigung"
      className={`absolute inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-opacity duration-400 ease-out ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      } ${className}`}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border/80 bg-slate-900/95 p-6 sm:p-7 shadow-2xl backdrop-blur-xl text-center flex flex-col items-center gap-4">
        {/* Ambient Top Glow */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-48 h-48 bg-primary/15 rounded-full blur-3xl pointer-events-none" />

        {/* Pulsing Coffee / Server Icon */}
        <div className="relative flex items-center justify-center pt-1">
          <div className="absolute h-16 w-16 rounded-full bg-primary/20 animate-ping" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-inner">
            <Coffee className="h-7 w-7 text-primary animate-pulse" />
          </div>
        </div>

        {/* Informative Header & Message */}
        <div className="space-y-1.5">
          <h3 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
            ☕ Kostenloser Server wacht auf...
          </h3>

          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-sm">
            Damit HeimspielRadar kostenlos bleibt, fahre ich kurz hoch (~30 Sek.). Vielen Dank für dein Verständnis!
          </p>
        </div>

        {/* Animated Progress Bar */}
        <div className="w-full space-y-2 pt-1">
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted/60">
            <div className="h-full w-full bg-gradient-to-r from-primary/30 via-primary to-primary/30 animate-[pulse_1.8s_ease-in-out_infinite]" />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Server className="h-3 w-3 text-primary animate-pulse" />
              <span>Render.com Free Tier</span>
            </span>
            <span>~30 Sek.</span>
          </div>
        </div>

        {/* User Manual Dismissal Button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onDismiss}
          className="mt-1 h-8 text-xs border-border/80 bg-background/50 hover:bg-background/80 hover:text-foreground cursor-pointer"
        >
          <Eye className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
          <span>Im Hintergrund warten</span>
        </Button>
      </div>
    </div>
  );
}
