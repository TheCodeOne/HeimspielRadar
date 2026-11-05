import * as React from 'react';

export interface TopLoadingBarProps {
  isLoading: boolean;
  className?: string;
}

export function TopLoadingBar({ isLoading, className = '' }: TopLoadingBarProps) {
  const [progress, setProgress] = React.useState<number>(0);
  const [visible, setVisible] = React.useState<boolean>(false);
  const [isFading, setIsFading] = React.useState<boolean>(false);

  React.useEffect(() => {
    let trickleTimer: ReturnType<typeof setInterval> | null = null;
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    let resetTimer: ReturnType<typeof setTimeout> | null = null;

    if (isLoading) {
      setIsFading(false);
      setVisible(true);
      // Start immediately with an initial progress step (0ms delay)
      setProgress((prev) => (prev > 0 && prev < 90 ? prev : 20));

      // Asymptotic trickle up to ~85%
      trickleTimer = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 85) {
            return prev;
          }

          const increment = Math.max(1, (85 - prev) * 0.15);

          return Math.min(85, prev + increment);
        });
      }, 150);
    } else {
      // Transition from loading to loaded
      setProgress((prev) => {
        if (prev > 0) {
          return 100;
        }

        return 0;
      });

      // Wait 200ms at 100% then fade out smoothly
      fadeTimer = setTimeout(() => {
        setIsFading(true);

        // Wait 300ms for fade out transition before resetting state
        resetTimer = setTimeout(() => {
          setVisible(false);
          setProgress(0);
          setIsFading(false);
        }, 300);
      }, 200);
    }

    return () => {
      if (trickleTimer) {
        clearInterval(trickleTimer);
      }

      if (fadeTimer) {
        clearTimeout(fadeTimer);
      }

      if (resetTimer) {
        clearTimeout(resetTimer);
      }
    };
  }, [isLoading]);

  if (!visible && progress === 0) {
    return null;
  }

  return (
    <div
      role="progressbar"
      aria-label="Matches werden geladen"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
      aria-busy={isLoading}
      data-testid="top-loading-bar"
      className={`fixed top-0 left-0 right-0 z-60 pointer-events-none h-[2.5px] overflow-hidden transition-opacity duration-300 ease-out ${
        isFading ? 'opacity-0' : 'opacity-100'
      } ${className}`}
    >
      <div
        className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 shadow-[0_0_8px_#f59e0b,0_0_4px_#fbbf24] transition-[width] duration-200 ease-out relative"
        style={{ width: `${progress}%` }}
      >
        {/* Glowing Head at right end */}
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-r from-transparent via-white/30 to-white/70 shadow-[0_0_8px_#fbbf24]" />
      </div>
    </div>
  );
}
