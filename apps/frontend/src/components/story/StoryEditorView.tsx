import * as React from 'react';
import {
  ArrowLeft,
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

export interface StoryEditorViewProps {
  match: Match;
  onBack: () => void;
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

export function StoryEditorView({
  match,
  onBack,
  onShareFeedback,
}: StoryEditorViewProps) {
  const [theme, setTheme] = React.useState<StoryTheme>(() => {
    return isHalloweenSeason() ? 'halloween' : 'classic';
  });

  const [customNote, setCustomNote] = React.useState<string>('');
  const [previewBlobUrl, setPreviewBlobUrl] = React.useState<string | null>(null);
  const [isRendering, setIsRendering] = React.useState<boolean>(false);
  const [isSharing, setIsSharing] = React.useState<boolean>(false);
  const [isCopiedLink, setIsCopiedLink] = React.useState<boolean>(false);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  const matchUrl = React.useMemo(() => getMatchShareUrl(match.id), [match.id]);

  const showToast = React.useCallback(
    (msg: string) => {
      setToastMessage(msg);
      onShareFeedback?.(msg);
      const timer = setTimeout(() => setToastMessage(null), 3000);

      return () => clearTimeout(timer);
    },
    [onShareFeedback]
  );

  // Debounced Reactive Live Preview Generation
  React.useEffect(() => {
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
  }, [match, theme, customNote]);

  // Clean up object URL on unmount
  React.useEffect(() => {
    return () => {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [previewBlobUrl]);

  const handleChipClick = (chipText: string) => {
    if (customNote === chipText) {
      setCustomNote('');

      return;
    }

    if (!customNote.trim()) {
      setCustomNote(chipText);
    } else {
      // Append if within max 70 chars, otherwise replace
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
        showToast('Link kopiert! In Instagram als Link-Sticker einfügen');
        setTimeout(() => setIsCopiedLink(false), 2500);
      }
    } catch {
      showToast('Kopieren fehlgeschlagen');
    }
  };

  const handleShareStory = async () => {
    if (isSharing) {
      return;
    }

    setIsSharing(true);
    showToast('Story-Bild wird vorbereitet...');

    await shareMatchStory(match, {
      theme,
      customNote: customNote.trim() || undefined,
      onSuccess: (type) => {
        setIsSharing(false);

        if (type === 'shared') {
          showToast('📸 Story geöffnet & Link-Sticker kopiert!');
        } else {
          showToast('📸 Story gespeichert & Link-Sticker kopiert!');
        }
      },
      onError: () => {
        setIsSharing(false);
        showToast('Erstellung der Story fehlgeschlagen');
      },
    });
  };

  const dateStr = formatDisplayDate(match.kickoffDate);
  const timeStr = formatKickoffTime(match.kickoffTime);

  return (
    <div className="fixed inset-0 h-dvh w-full flex flex-col bg-background text-foreground overflow-hidden z-50">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-full bg-slate-900/95 text-white px-5 py-2.5 text-xs sm:text-sm font-semibold shadow-2xl backdrop-blur border border-slate-700/80 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {toastMessage}
        </div>
      )}

      {/* Header Bar */}
      <header className="shrink-0 flex items-center justify-between border-b border-border/50 px-4 py-3 sm:px-6 bg-card/80 backdrop-blur-md z-20">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-xs sm:text-sm font-semibold -ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Zurück</span>
        </Button>

        <div className="flex items-center gap-2">
          <div className="hidden xs:flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
            <span className="font-semibold text-foreground truncate max-w-[160px] sm:max-w-[260px]">
              {match.homeTeam.name}
            </span>
            <span>vs</span>
            <span className="font-semibold text-foreground truncate max-w-[160px] sm:max-w-[260px]">
              {match.guestTeam.name}
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-semibold">
            <Sparkles className="h-3 w-3" />
            <span className="hidden sm:inline">Story Studio</span>
            <span className="sm:hidden">Studio</span>
          </div>
        </div>
      </header>

      {/* Main Content: Split layout on Desktop, Stack on Mobile */}
      <main className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* Left / Top Column: Live 9:16 Preview */}
        <section className="flex-1 bg-slate-950/60 p-4 sm:p-6 flex flex-col items-center justify-center overflow-y-auto relative min-h-[340px] md:min-h-0">
          <div className="w-full max-w-[340px] sm:max-w-[380px] aspect-[9/16] max-h-[72vh] md:max-h-[82vh] rounded-2xl shadow-2xl overflow-hidden border border-border/40 relative flex items-center justify-center bg-slate-900">
            {previewBlobUrl ? (
              <img
                src={previewBlobUrl}
                alt={`Instagram Story Preview für ${match.homeTeam.name} gegen ${match.guestTeam.name}`}
                className="w-full h-full object-contain select-none"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
                <div className="h-8 w-8 border-2 border-primary border-t-transparent animate-spin rounded-full mb-3" />
                <span className="text-xs font-semibold">Generiere 1080×1920 Story...</span>
              </div>
            )}

            {/* Subtle Live Preview Status Indicator */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-semibold text-white/90 border border-white/10">
              <span
                className={`h-2 w-2 rounded-full ${
                  isRendering ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
                }`}
              />
              <span>{isRendering ? 'Aktualisiert...' : 'Live 9:16 Preview'}</span>
            </div>
          </div>
        </section>

        {/* Right / Bottom Column: Customization Controls */}
        <section className="w-full md:w-[420px] lg:w-[460px] shrink-0 border-t md:border-t-0 md:border-l border-border/50 bg-card/60 backdrop-blur-md flex flex-col min-h-0 overflow-y-auto">
          <div className="p-4 sm:p-6 flex-1 flex flex-col gap-6">
            {/* Match info summary */}
            <div className="rounded-xl bg-muted/40 p-3.5 border border-border/50">
              <div className="text-[11px] font-bold uppercase tracking-wider text-primary mb-1 truncate">
                {match.league?.name || 'Amateur-Basketball'}
              </div>
              <div className="text-sm font-bold text-foreground truncate">
                {match.homeTeam.name} vs {match.guestTeam.name}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {dateStr} • {timeStr} Uhr • {match.venue?.name || 'Sporthalle'}
              </div>
            </div>

            {/* 1. Theme Selector */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Design & Style
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTheme('classic')}
                  className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                    theme === 'classic'
                      ? 'bg-primary/10 border-primary text-foreground shadow-sm ring-1 ring-primary'
                      : 'bg-card/40 border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/30'
                  }`}
                >
                  <span className="text-sm font-bold flex items-center gap-1.5">
                    <span>🏀 Classic Court</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Modernes Midnight & Orange Hardwood Design
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme('halloween')}
                  className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                    theme === 'halloween'
                      ? 'bg-orange-500/15 border-orange-500 text-orange-400 shadow-sm ring-1 ring-orange-500'
                      : 'bg-card/40 border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/30'
                  }`}
                >
                  <span className="text-sm font-bold flex items-center gap-1.5 text-orange-400">
                    <span>🎃 Halloween</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Dunkles Violett & Fledermaus-Ambiente
                  </span>
                </button>
              </div>
            </div>

            {/* 2. Custom Note / Freitext Field */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="custom-story-note"
                  className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                >
                  Zusatz-Hinweis für eure Fans (optional)
                </label>
                <span
                  className={`text-[11px] font-mono ${
                    customNote.length >= 65
                      ? 'text-amber-500 font-bold'
                      : 'text-muted-foreground'
                  }`}
                >
                  {customNote.length}/70
                </span>
              </div>

              <div className="relative">
                <input
                  id="custom-story-note"
                  type="text"
                  maxLength={70}
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="z.B. Einlass ab 16:30 Uhr • Kaffee & Kuchen"
                  className="w-full rounded-xl bg-background border border-border/80 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary pr-9 transition"
                />
                {customNote && (
                  <button
                    type="button"
                    onClick={() => setCustomNote('')}
                    title="Text löschen"
                    aria-label="Text löschen"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-md"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* 3. Quick-Chips */}
              <div className="flex flex-col gap-1.5 pt-1">
                <span className="text-[11px] text-muted-foreground">
                  Schnell-Vorlagen:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_CHIPS.map((chip) => {
                    const isSelected = customNote.includes(chip);

                    return (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => handleChipClick(chip)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          isSelected
                            ? 'bg-primary/20 border-primary text-primary font-semibold'
                            : 'bg-muted/40 border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/70'
                        }`}
                      >
                        {chip}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 4. Instagram Link-Sticker Copy Info Box */}
            <div className="rounded-xl border border-dashed border-border/70 p-3 bg-muted/20 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1 text-xs">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <span>🔗 Link für Instagram Sticker</span>
                </div>
                <div className="text-[11px] text-muted-foreground truncate font-mono mt-0.5">
                  {matchUrl}
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="h-8 px-2.5 text-xs font-semibold shrink-0 gap-1.5"
              >
                {isCopiedLink ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Kopiert</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Kopieren</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Sticky Bottom Actions */}
          <div className="p-4 sm:p-6 border-t border-border/50 bg-background/80 backdrop-blur-md flex flex-col gap-2 shrink-0">
            <Button
              type="button"
              disabled={isSharing}
              onClick={handleShareStory}
              className={`w-full h-11 text-sm font-bold gap-2 shadow-lg transition-transform active:scale-[0.99] ${
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
              <span>Story teilen / Bild speichern</span>
            </Button>

            <p className="text-[11px] text-center text-muted-foreground">
              Kopiert automatisch den Link für den Instagram Link-Sticker in die Zwischenablage.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
