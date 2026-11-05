import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {
  Bell,
  BellRing,
  CalendarPlus,
  Check,
  Clock,
  MapPin,
  Trash2,
  X,
} from 'lucide-react';
import type { Match } from '@sundayleague/shared-types';
import { formatDisplayDate, formatKickoffTime } from '@/lib/date-utils';
import { downloadMatchIcs } from '@/lib/ics-export';
import { scheduleWebPushReminder } from '@/lib/push-notification';
import {
  type ReminderLeadTime,
  getLeadTimeLabel,
  getReminder,
  removeReminder,
  useReminders,
} from '@/lib/reminder-storage';

export interface GameReminderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match | null;
  onFeedback?: (message: string) => void;
}

interface LeadTimeOption {
  value: ReminderLeadTime;
  title: string;
  tagline: string;
  isDefault?: boolean;
}

const LEAD_TIME_OPTIONS: LeadTimeOption[] = [
  {
    value: '1h',
    title: '1 Stunde vorher',
    tagline: 'Ideal für kurze Anfahrten & direkte Vorbereitung',
  },
  {
    value: '2h',
    title: '2 Stunden vorher',
    tagline: 'Standard • Genug Zeit für Anfahrt & Halleneinlass',
    isDefault: true,
  },
  {
    value: '1d',
    title: '1 Tag vorher',
    tagline: 'Am Vorabend (18:00 Uhr) zur optimalen Wochenendplanung',
  },
];

export function GameReminderDialog({
  isOpen,
  onClose,
  match,
  onFeedback,
}: GameReminderDialogProps) {
  useReminders();

  const activeReminder = match ? getReminder(match.id) : null;
  const isReminderActive = activeReminder !== null;

  const [selectedLeadTime, setSelectedLeadTime] = React.useState<ReminderLeadTime>(
    activeReminder?.leadTime ?? '2h',
  );

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [inlineFeedback, setInlineFeedback] = React.useState<{
    text: string;
    isError?: boolean;
  } | null>(null);

  // Sync selectedLeadTime if dialog reopens or match changes
  React.useEffect(() => {
    if (activeReminder) {
      setSelectedLeadTime(activeReminder.leadTime);
    } else {
      setSelectedLeadTime('2h');
    }

    setInlineFeedback(null);
  }, [match?.id, isOpen]);

  // ESC key handler
  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !match) {
    return null;
  }

  const dateFormatted = formatDisplayDate(match.kickoffDate);
  const timeFormatted = formatKickoffTime(match.kickoffTime);

  const handleActivatePush = async () => {
    setIsSubmitting(true);
    setInlineFeedback(null);

    try {
      const result = await scheduleWebPushReminder(match, selectedLeadTime);

      setInlineFeedback({
        text: result.message,
        isError: !result.success,
      });

      onFeedback?.(result.message);
    } catch {
      const errMsg = 'Aktivierung fehlgeschlagen. Bitte erneut versuchen.';

      setInlineFeedback({
        text: errMsg,
        isError: true,
      });

      onFeedback?.(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportIcs = () => {
    try {
      downloadMatchIcs(match, selectedLeadTime);
      const msg = `Kalenderdatei (.ics) mit Weckalarm (${getLeadTimeLabel(selectedLeadTime)}) heruntergeladen!`;

      setInlineFeedback({
        text: msg,
        isError: false,
      });

      onFeedback?.(msg);
    } catch {
      const errMsg = 'Kalenderexport fehlgeschlagen.';

      setInlineFeedback({
        text: errMsg,
        isError: true,
      });

      onFeedback?.(errMsg);
    }
  };

  const handleRemoveReminder = () => {
    removeReminder(match.id);
    const msg = 'Spiel-Erinnerung entfernt.';

    setInlineFeedback({
      text: msg,
      isError: false,
    });

    onFeedback?.(msg);
  };

  const dialogContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reminder-dialog-title"
      className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-4 overscroll-contain pointer-events-auto"
      data-testid="game-reminder-dialog"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Dialog Card */}
      <div
        className="relative z-10 flex w-full max-w-md max-h-[calc(100dvh-2rem)] min-h-0 flex-col rounded-2xl border border-border/80 bg-background/95 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-150 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between border-b border-border/60 p-4 sm:p-5 pb-3.5 bg-card/40">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-xs ${
                isReminderActive
                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                  : 'border-primary/40 bg-primary/10 text-primary'
              }`}
            >
              <Bell
                className={`h-4.5 w-4.5 ${
                  isReminderActive ? 'fill-amber-400 text-amber-400' : 'text-primary'
                }`}
              />
            </div>

            <div className="min-w-0 flex-1">
              <h2
                id="reminder-dialog-title"
                className="text-base font-bold text-foreground leading-tight"
              >
                Spiel-Erinnerung & Kalender
              </h2>

              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {match.homeTeam.name} vs. {match.guestTeam.name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Dialog schließen"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted/80 hover:text-foreground cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
          {/* Match Context Card */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>
                  {dateFormatted} • {timeFormatted}
                </span>
              </div>

              {isReminderActive && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-300">
                  <Check className="h-2.5 w-2.5" />
                  Aktiv ({getLeadTimeLabel(activeReminder.leadTime)})
                </span>
              )}
            </div>

            {match.venue && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground border-t border-border/30 pt-1.5">
                <MapPin className="h-3 w-3 text-primary shrink-0" />
                <span className="truncate">
                  {match.venue.name} {match.venue.city ? `• ${match.venue.city}` : ''}
                </span>
              </div>
            )}
          </div>

          {/* Lead-Time Selection Options */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Vorlaufzeit wählen
            </label>

            <div className="space-y-2" role="radiogroup" aria-label="Vorlaufzeit">
              {LEAD_TIME_OPTIONS.map((opt) => {
                const isSelected = selectedLeadTime === opt.value;

                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setSelectedLeadTime(opt.value)}
                    className={`w-full flex items-center justify-between rounded-xl border p-3 text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-primary/10 ring-1 ring-primary/40'
                        : 'border-border/60 bg-card/40 hover:bg-muted/30 hover:border-border'
                    }`}
                  >
                    <div className="space-y-0.5 min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-foreground">
                          {opt.title}
                        </span>
                        {opt.isDefault && (
                          <span className="rounded bg-muted px-1.5 py-0.2 text-[9px] font-mono text-muted-foreground">
                            Standard
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-tight">
                        {opt.tagline}
                      </p>
                    </div>

                    <div
                      className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border ${
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-muted-foreground/40'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Inline Feedback Banner */}
          {inlineFeedback && (
            <div
              role="status"
              className={`rounded-xl border p-3 text-xs flex items-center gap-2 ${
                inlineFeedback.isError
                  ? 'border-destructive/40 bg-destructive/10 text-destructive'
                  : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              }`}
            >
              <span className="shrink-0 leading-none">
                {inlineFeedback.isError ? '⚠️' : '✓'}
              </span>
              <span>{inlineFeedback.text}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 border-t border-border/50 pt-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleActivatePush}
              data-testid="btn-activate-push"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer disabled:opacity-50"
            >
              <BellRing className="h-4 w-4" />
              <span>
                {isReminderActive && selectedLeadTime === activeReminder.leadTime
                  ? 'Web-Push Erinnerung erneuern'
                  : 'Web-Push Benachrichtigung aktivieren'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleExportIcs}
              data-testid="btn-export-ics"
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-card/60 px-4 py-2.5 text-xs font-semibold text-foreground transition hover:bg-muted/50 hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
            >
              <CalendarPlus className="h-4 w-4 text-primary" />
              <span>In Kalender speichern (.ics mit Alarm)</span>
            </button>

            {isReminderActive && (
              <button
                type="button"
                onClick={handleRemoveReminder}
                data-testid="btn-remove-reminder"
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs font-semibold text-destructive transition hover:bg-destructive/20 focus-visible:outline-none cursor-pointer mt-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Erinnerung entfernen</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border/60 p-3 sm:p-4 bg-card/20 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto rounded-xl bg-muted px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted/80 transition cursor-pointer"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return ReactDOM.createPortal(dialogContent, document.body);
  }

  return dialogContent;
}
