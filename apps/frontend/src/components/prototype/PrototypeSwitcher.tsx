import * as React from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FlaskConical,
  Sparkles,
} from 'lucide-react';

export type PrototypeVariant = 'A' | 'B' | 'C' | 'D';

export interface VariantInfo {
  id: PrototypeVariant;
  name: string;
  tagline: string;
}

export const VARIANTS: VariantInfo[] = [
  {
    id: 'D',
    name: 'Favorit (Hybrid A + C)',
    tagline: 'Bottom Quick-Bar für Daumenbedienung, Gear-Icon & Bottom-Sheet',
  },
  {
    id: 'A',
    name: 'Quick-Filter Bar (Oben)',
    tagline: 'Floating Pills unter dem Header für 1-Click-Filter',
  },
  {
    id: 'B',
    name: 'Akkordeon-Drawer',
    tagline: '100% freie Karte; aufgeräumter Drawer mit Segmenten',
  },
  {
    id: 'C',
    name: 'Split-Sidebar & Sheet',
    tagline: 'Desktop: Permanente Seitenleiste; Mobile: Bottom-Sheet',
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
  const [isMinimized, setIsMinimized] = React.useState(false);

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
    <div className="fixed top-16 right-3 md:top-auto md:bottom-4 md:right-4 z-40 max-w-sm pointer-events-none">
      <div className="pointer-events-auto flex flex-col items-center rounded-2xl border border-primary/30 bg-background/95 p-2 shadow-2xl backdrop-blur-xl ring-1 ring-primary/20">
        {isMinimized ? (
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-foreground hover:text-primary transition"
            title="Prototyp-Auswahl vergrößern"
          >
            <FlaskConical className="h-3.5 w-3.5 text-primary" />
            <span>Prototyp: Variante {active.id}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
        ) : (
          <div className="flex flex-col gap-1.5 w-full">
            <div className="flex w-full items-center justify-between gap-1.5">
              {/* Previous Button */}
              <button
                type="button"
                onClick={handlePrev}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/80 bg-muted/60 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                title="Vorherige Variante (Pfeil links)"
                aria-label="Vorherige Variante"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
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
                      className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition-all ${
                        isSelected
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <span className="font-mono text-[11px] font-bold">
                        {v.id}
                      </span>
                      {v.id === 'D' && (
                        <span className="text-[10px] bg-amber-400 text-slate-950 font-bold px-1 rounded-xs">
                          Neu
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Next Button */}
              <button
                type="button"
                onClick={handleNext}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/80 bg-muted/60 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                title="Nächste Variante (Pfeil rechts)"
                aria-label="Nächste Variante"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>

              {/* Minimize Button */}
              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition ml-0.5"
                title="Minimieren"
                aria-label="Minimieren"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Tagline / Explainer */}
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground px-1">
              <Sparkles className="h-3 w-3 text-amber-500 shrink-0" />
              <span className="font-semibold text-foreground truncate max-w-[200px]">
                {active.name}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
