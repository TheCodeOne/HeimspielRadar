import * as React from 'react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

export type PrototypeVariant = 'A' | 'B' | 'C';

export interface VariantInfo {
  id: PrototypeVariant;
  name: string;
  tagline: string;
}

export const VARIANTS: VariantInfo[] = [
  {
    id: 'A',
    name: 'Quick-Filter Bar (Airbnb/Maps)',
    tagline: 'Floating Pills auf der Karte für 1-Click-Filter + kompakter Drawer',
  },
  {
    id: 'B',
    name: 'Akkordeon-Drawer (Clean Map)',
    tagline: '100% freie Karte; aufgeräumter Drawer mit Segmenten & Akkordeons',
  },
  {
    id: 'C',
    name: 'Split-Sidebar & Bottom-Sheet',
    tagline: 'Desktop: Permanente Seitenleiste ohne Overlay; Mobile: Sheet',
  },
];

interface PrototypeSwitcherProps {
  currentVariant: PrototypeVariant;
  onSelectVariant: (variant: PrototypeVariant) => void;
}

export function PrototypeSwitcher({
  currentVariant,
  onSelectVariant,
}: PrototypeSwitcherProps) {
  const currentIndex = VARIANTS.findIndex((v) => v.id === currentVariant);

  const handlePrev = React.useCallback(() => {
    const nextIndex = (currentIndex - 1 + VARIANTS.length) % VARIANTS.length;
    const nextVariant = VARIANTS[nextIndex];

    if (nextVariant) {
      onSelectVariant(nextVariant.id);
    }
  }, [currentIndex, onSelectVariant]);

  const handleNext = React.useCallback(() => {
    const nextIndex = (currentIndex + 1) % VARIANTS.length;
    const nextVariant = VARIANTS[nextIndex];

    if (nextVariant) {
      onSelectVariant(nextVariant.id);
    }
  }, [currentIndex, onSelectVariant]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      const target = e.target instanceof HTMLElement ? e.target : null;

      if (!target) {
        return;
      }

      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrev, handleNext]);

  const active = VARIANTS[currentIndex] ?? VARIANTS[0];

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 px-3 w-full max-w-xl pointer-events-none">
      <div className="pointer-events-auto flex flex-col items-center gap-1.5 rounded-2xl border border-primary/30 bg-background/90 p-2 shadow-2xl backdrop-blur-xl ring-1 ring-primary/20">
        <div className="flex w-full items-center justify-between gap-2">
          {/* Previous Button */}
          <button
            type="button"
            onClick={handlePrev}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/80 bg-muted/60 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            title="Vorherige Variante (Pfeil links)"
            aria-label="Vorherige Variante"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* Variants Segmented Pills */}
          <div className="flex flex-1 items-center justify-center gap-1">
            {VARIANTS.map((v) => {
              const isSelected = v.id === currentVariant;

              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onSelectVariant(v.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <span className="font-mono text-[11px] font-bold">
                    {v.id}
                  </span>
                  <span className="hidden sm:inline truncate max-w-[120px]">
                    {v.name.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Next Button */}
          <button
            type="button"
            onClick={handleNext}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/80 bg-muted/60 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            title="Nächste Variante (Pfeil rechts)"
            aria-label="Nächste Variante"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Tagline / Explainer */}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Sparkles className="h-3 w-3 text-amber-500 shrink-0" />
          <span className="font-semibold text-foreground">
            Variante {active.id}: {active.name}
          </span>
          <span className="hidden md:inline text-muted-foreground/80">
            — {active.tagline}
          </span>
        </div>
      </div>
    </div>
  );
}
