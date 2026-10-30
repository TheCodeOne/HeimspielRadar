import * as React from 'react';
import {
  Check,
  Copy,
  Share2,
  Sparkles,
  X,
} from 'lucide-react';
import type { Match } from '@sundayleague/shared-types';
import { Button } from '@/components/ui/button';
import { formatDisplayDate, formatKickoffTime } from '@/lib/date-utils';
import { getMatchShareUrl, shareMatchStory } from '@/lib/share-utils';
import {
  generateStoryImageBlob,
  isHalloweenSeason,
  type StoryTheme,
} from '@/lib/story-image-generator';

export interface StoryPreviewModalProps {
  match: Match | null;
  isOpen: boolean;
  onClose: () => void;
  onShareFeedback?: (message: string) => void;
}

const QUICK_CHIPS = [
  '🎟️ Eintritt frei',
  '☕ Kaffee & Kuchen',
  '🚪 Einlass 45 Min vor Tip-Off',
  '🍻 Kühle Getränke',
  '🔴 Alle in Rot',
  '🥁 Lautstarke Unterstützung gesucht!',
];

export function StoryPreviewModal({
  match,
  isOpen,
  onClose,
  onShareFeedback,
}: StoryPreviewModalProps) {
  const [theme, setTheme] = React.useState<StoryTheme>(() => {
    return isHalloweenSeason() ? 'halloween' : 'classic';
  });

  const [customNote, setCustomNote] = React.useState<string>('');
  const [previewBlobUrl, setPreviewBlobUrl] = React.useState<string | null>(null);
  const [isRendering, setIsRendering] = React.useState<boolean>(false);
  const [isSharing, setIsSharing] = React.useState<boolean>(false);
  const [isCopiedLink, setIsCopiedLink] = React.useState<boolean>(false);

  // Close on Escape key
  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const matchUrl = React.useMemo(() => {
    return match ? getMatchShareUrl(match.id) : '';
  }, [match]);

  // Live preview generator
  React.useEffect(() => {
    if (!isOpen || !match) {
      return;
    }

    let isCancelled = false;
    let currentUrl: string | null = null;

    setIsRendering(true);

    const debounceTimer = setTimeout(async () => {
      try {
        const origin =
          typeof window !== 'undefined' && window.location?.origin
            ? window.location.origin
            : 'https://heimspielradar.app';

        const blob = await generateStoryImageBlob(match, {
          theme,
          customNote: customNote.trim() || undefined,
          origin,
        });

        if (!isCancelled) {
          currentUrl = URL.createObjectURL(blob);
          setPreviewBlobUrl((prev) => {
            if (prev) {
              URL.revokeObjectURL(prev);
            }

            return currentUrl;
          });
          setIsRendering(false);
        }
      } catch {
        if (!isCancelled) {
          setIsRendering(false);
        }
      }
    }, 120);

    return () => {
      isCancelled = true;
      clearTimeout(debounceTimer);
    };
  }, [isOpen, match, theme, customNote]);

  // Clean up preview URL
  React.useEffect(() => {
    return () => {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [previewBlobUrl]);

  if (!isOpen || !match) {
    return null;
  }

  const handleChipClick = (chipText: string) => {
    if (customNote === chipText) {
      setCustomNote('');

      return;
    }

    if (!customNote.trim()) {
      setCustomNote(chipText);
    } else {
      const combined = `${customNote} • ${chipText}`;

      if (combined.length <= 70) {
        setCustomNote(combined);
      } else {
        setCustomNote(chipText);
      }
    }
  };

  const handleCopyLink = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(matchUrl);
        setIsCopiedLink(true);
        onShareFeedback?.('Link kopiert! In Instagram als Link-Sticker einfügen');
        setTimeout(() => setIsCopiedLink(false), 2500);
      }
    } catch {
      onShareFeedback?.('Kopieren fehlgeschlagen');
    }
  };

  const handleShareStory = async () => {
    if (isSharing) {
      return;
    }

    setIsSharing(true);
    onShareFeedback?.('Story-Bild wird vorbereitet...');

    await shareMatchStory(match, {
      theme,
      customNote: customNote.trim() || undefined,
      onSuccess: (type) => {
        setIsSharing(false);

        if (type === 'shared') {
          onShareFeedback?.('📸 Story geöffnet & Link-Sticker kopiert!');
        } else {
          onShareFeedback?.('📸 Story gespeichert & Link-Sticker kopiert!');
        }
      },
      onError: () => {
        setIsSharing(false);
        onShareFeedback?.('Erstellung der Story fehlgeschlagen');
      },
    });
  };

  const dateStr = formatDisplayDate(match.kickoffDate);
  const timeStr = formatKickoffTime(match.kickoffTime);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="story-preview-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] bg-card border border-border/70 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col md:flex-row overflow-hidden text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Column: 9:16 Live Preview */}
        <div className="flex-1 bg-slate-950 p-4 sm:p-6 flex flex-col items-center justify-center relative min-h-[260px] md:min-h-[500px]">
          <div className="w-full max-w-[260px] sm:max-w-[300px] aspect-[9/16] max-h-[50vh] md:max-h-[70vh] rounded-xl shadow-2xl overflow-hidden border border-border/40 relative flex items-center justify-center bg-slate-900">
            {previewBlobUrl ? (
              <img
                src={previewBlobUrl}
                alt={`Instagram Story Preview für ${match.homeTeam.name} vs ${match.guestTeam.name}`}
                className="w-full h-full object-contain select-none"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
                <div className="h-7 w-7 border-2 border-primary border-t-transparent animate-spin rounded-full mb-2" />
                <span className="text-xs font-semibold">Generiere Vorschau...</span>
              </div>
            )}

            <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-full text-[9px] font-semibold text-white/90 border border-white/10">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isRendering ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
                }`}
              />
              <span>{isRendering ? 'Render...' : '9:16 Live Preview'}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Customization & Actions */}
        <div className="w-full md:w-[380px] lg:w-[420px] flex flex-col justify-between border-t md:border-t-0 md:border-l border-border/50 bg-card overflow-y-auto max-h-[50vh] md:max-h-[92vh]">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-border/40 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2
                id="story-preview-modal-title"
                className="text-base font-bold text-foreground"
              >
                Matchday Story anpassen
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              title="Schließen"
              aria-label="Modal schließen"
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body Form */}
          <div className="p-4 sm:p-5 flex-1 flex flex-col gap-4">
            {/* Match summary */}
            <div className="rounded-lg bg-muted/40 p-2.5 border border-border/40 text-xs">
              <div className="font-bold text-foreground truncate">
                {match.homeTeam.name} vs {match.guestTeam.name}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {dateStr} • {timeStr} Uhr
              </div>
            </div>

            {/* Theme Toggle */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Design & Style
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTheme('classic')}
                  className={`py-2 px-2.5 rounded-lg border text-xs font-semibold text-center transition flex items-center justify-center gap-1.5 ${
                    theme === 'classic'
                      ? 'bg-primary/10 border-primary text-foreground ring-1 ring-primary'
                      : 'border-border/60 text-muted-foreground hover:bg-muted/40'
                  }`}
                >
                  <span>🏀 Classic Court</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('halloween')}
                  className={`py-2 px-2.5 rounded-lg border text-xs font-semibold text-center transition flex items-center justify-center gap-1.5 ${
                    theme === 'halloween'
                      ? 'bg-orange-500/15 border-orange-500 text-orange-400 ring-1 ring-orange-500'
                      : 'border-border/60 text-muted-foreground hover:bg-muted/40'
                  }`}
                >
                  <span>🎃 Halloween</span>
                </button>
              </div>
            </div>

            {/* Custom Note Input */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="modal-custom-note"
                  className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                >
                  Zusatz-Hinweis (optional)
                </label>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {customNote.length}/70
                </span>
              </div>

              <div className="relative">
                <input
                  id="modal-custom-note"
                  type="text"
                  maxLength={70}
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="z.B. Eintritt frei! Kaffee & Kuchen"
                  className="w-full rounded-lg bg-background border border-border/80 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary pr-8"
                />
                {customNote && (
                  <button
                    type="button"
                    onClick={() => setCustomNote('')}
                    title="Löschen"
                    aria-label="Text löschen"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Quick Chips */}
              <div className="flex flex-wrap gap-1 pt-1">
                {QUICK_CHIPS.map((chip) => {
                  const isSelected = customNote.includes(chip);

                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleChipClick(chip)}
                      className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                        isSelected
                          ? 'bg-primary/20 border-primary text-primary font-semibold'
                          : 'bg-muted/40 border-border/60 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {chip}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Link Copy */}
            <div className="rounded-lg border border-dashed border-border/70 p-2.5 bg-muted/20 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1 text-[11px]">
                <div className="font-semibold text-foreground">
                  🔗 Link für Instagram Sticker
                </div>
                <div className="text-[10px] text-muted-foreground truncate font-mono">
                  {matchUrl}
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="h-7 px-2 text-xs font-semibold shrink-0 gap-1"
              >
                {isCopiedLink ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-500" />
                    <span>Kopiert</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Kopieren</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:p-5 border-t border-border/50 bg-background/50 flex flex-col gap-2 shrink-0">
            <Button
              type="button"
              disabled={isSharing}
              onClick={handleShareStory}
              className={`w-full h-10 text-xs sm:text-sm font-bold gap-2 ${
                theme === 'halloween'
                  ? 'bg-orange-600 hover:bg-orange-500 text-white'
                  : 'bg-primary hover:bg-primary/90 text-primary-foreground'
              }`}
            >
              {isSharing ? (
                <div className="h-4 w-4 border-2 border-current border-t-transparent animate-spin rounded-full" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
              <span>📸 Story teilen / Bild speichern</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
