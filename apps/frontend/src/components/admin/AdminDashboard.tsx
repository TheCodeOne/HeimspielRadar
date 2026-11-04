import * as React from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  Database,
  Edit2,
  MapPin,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Star,
  Terminal,
  Trash2,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  AdminStatusResponse,
  GERMAN_BASKETBALL_VERBAENDE,
  Match,
  PaginatedMatchesResponse,
  SyncFailure,
  SyncRun,
  UpdateSubmissionDto,
  VenueSubmission,
  VenueSubmissionFilterStatus,
} from '@sundayleague/shared-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KioskInfoBadges } from '@/components/matches/KioskInfoBadges';

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days}d`);
  }

  if (hours > 0 || days > 0) {
    parts.push(`${hours}h`);
  }

  parts.push(`${minutes}m`);

  return parts.join(' ');
}

function formatDateTime(dateVal: string | Date | null | undefined): string {
  if (!dateVal) {
    return '–';
  }

  const d = new Date(dateVal);

  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d);
}

function formatShortDate(dateVal: string | Date | null | undefined): string {
  if (!dateVal) {
    return '–';
  }

  const d = new Date(dateVal);

  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

function formatMatchKickoff(
  kickoffDate: string | null | undefined,
  kickoffTime: string | null | undefined
): string {
  if (!kickoffDate) {
    return 'Termin offen';
  }

  const parts = kickoffDate.split('-');

  const formattedDate =
    parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : kickoffDate;

  if (kickoffTime && kickoffTime !== '00:00') {
    return `${formattedDate} • ${kickoffTime} Uhr`;
  }

  return formattedDate;
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null) {
    return '–';
  }

  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function formatTargetLabel(target: string): string {
  if (target === 'all') {
    return 'Alle Verbände (bundesweit)';
  }

  if (target.startsWith('verband:')) {
    const verbandId = parseInt(target.split(':')[1], 10);
    const found = GERMAN_BASKETBALL_VERBAENDE.find((v) => v.id === verbandId);

    if (found) {
      return `${found.shortName} (${found.name})`;
    }

    return `Verband ${verbandId}`;
  }

  return target;
}

export function AdminDashboard() {
  const [status, setStatus] = React.useState<AdminStatusResponse | null>(null);
  const [syncRuns, setSyncRuns] = React.useState<SyncRun[]>([]);
  const [failures, setFailures] = React.useState<SyncFailure[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = React.useState<boolean>(false);

  // Navigation tab state ('overview' shows full dashboard + featured matches; 'featured' focuses on featured matches; 'submissions' shows moderation table)
  const [activeTab, setActiveTab] = React.useState<
    'overview' | 'featured' | 'submissions'
  >('overview');

  // Featured Matches state
  const [featuredMatches, setFeaturedMatches] = React.useState<Match[]>([]);
  const [featuredPage, setFeaturedPage] = React.useState<number>(1);
  const [featuredTotal, setFeaturedTotal] = React.useState<number>(0);
  const [featuredTotalPages, setFeaturedTotalPages] = React.useState<number>(0);
  const [isFeaturedLoading, setIsFeaturedLoading] = React.useState<boolean>(false);
  const [matchSearchQuery, setMatchSearchQuery] = React.useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState<string>('');
  const [searchResults, setSearchResults] = React.useState<Match[]>([]);
  const [isSearchingMatches, setIsSearchingMatches] = React.useState<boolean>(false);
  const [togglingMatchId, setTogglingMatchId] = React.useState<number | null>(null);
  const [isCalculatingTopMatches, setIsCalculatingTopMatches] = React.useState<boolean>(false);

  // Submissions & Moderation state
  const [submissions, setSubmissions] = React.useState<VenueSubmission[]>([]);

  const [submissionFilter, setSubmissionFilter] =
    React.useState<VenueSubmissionFilterStatus>('pending');

  const [moderatingSubmissionId, setModeratingSubmissionId] = React.useState<
    number | null
  >(null);

  // Edit Submission Modal state
  const [editingSubmission, setEditingSubmission] =
    React.useState<VenueSubmission | null>(null);

  const [editFormData, setEditFormData] = React.useState<UpdateSubmissionDto>({
    admissionFee: '',
    kioskDescription: '',
    parkingNotes: '',
    matchNotes: '',
    submitterName: '',
    submitterRole: '',
    scope: 'matchday',
  });

  const [isSavingEdit, setIsSavingEdit] = React.useState<boolean>(false);

  const [deletingSubmissionId, setDeletingSubmissionId] = React.useState<
    number | null
  >(null);

  // Sync trigger form state
  const [selectedTarget, setSelectedTarget] = React.useState<string>('verband:1');
  const [customLeagueId, setCustomLeagueId] = React.useState<string>('');
  const [syncType, setSyncType] = React.useState<'delta' | 'deep'>('delta');
  const [isTriggering, setIsTriggering] = React.useState<boolean>(false);

  // Action states
  const [isRetrying, setIsRetrying] = React.useState<boolean>(false);
  const [isTestingTelegram, setIsTestingTelegram] = React.useState<boolean>(false);

  const [feedbackMessage, setFeedbackMessage] = React.useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const clearFeedbackTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFeedback = React.useCallback(
    (type: 'success' | 'error' | 'info', text: string) => {
      if (clearFeedbackTimerRef.current) {
        clearTimeout(clearFeedbackTimerRef.current);
      }

      setFeedbackMessage({ type, text });
      clearFeedbackTimerRef.current = setTimeout(() => {
        setFeedbackMessage(null);
      }, 6000);
    },
    []
  );

  const fetchData = React.useCallback(
    async (showInitialSpinner = false) => {
      if (showInitialSpinner) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const [statusRes, runsRes, failuresRes, featuredRes, submissionsRes] =
          await Promise.all([
            fetch('/api/admin/status'),
            fetch('/api/admin/sync-runs?limit=20'),
            fetch('/api/admin/failures'),
            fetch('/api/admin/matches/featured?page=1&limit=25').catch(() => null),
            fetch(`/api/admin/submissions?status=${submissionFilter}`).catch(
              () => null
            ),
          ]);

        if (statusRes.ok) {
          // SAFETY: /api/admin/status returns AdminStatusResponse
          const data = (await statusRes.json()) as AdminStatusResponse;
          setStatus(data);
        }

        if (runsRes.ok) {
          // SAFETY: /api/admin/sync-runs returns SyncRun[]
          const runsData = (await runsRes.json()) as SyncRun[];
          setSyncRuns(runsData);
        }

        if (failuresRes.ok) {
          // SAFETY: /api/admin/failures returns SyncFailure[]
          const failuresData = (await failuresRes.json()) as SyncFailure[];
          setFailures(failuresData);
        }

        if (
          featuredRes &&
          featuredRes.ok &&
          featuredRes.headers.get('content-type')?.includes('application/json')
        ) {
          // SAFETY: /api/admin/matches/featured returns PaginatedMatchesResponse (or legacy Match[])
          const featuredData = (await featuredRes.json()) as
            | PaginatedMatchesResponse
            | Match[];

          if (Array.isArray(featuredData)) {
            setFeaturedMatches(featuredData);
            setFeaturedTotal(featuredData.length);
            setFeaturedPage(1);
            setFeaturedTotalPages(
              Math.max(1, Math.ceil(featuredData.length / 25))
            );
          } else if (featuredData && Array.isArray(featuredData.data)) {
            setFeaturedMatches(featuredData.data);
            setFeaturedTotal(featuredData.total ?? 0);
            setFeaturedPage(featuredData.page ?? 1);
            setFeaturedTotalPages(featuredData.totalPages ?? 0);
          }
        }

        if (
          submissionsRes &&
          submissionsRes.ok &&
          submissionsRes.headers
            .get('content-type')
            ?.includes('application/json')
        ) {
          // SAFETY: /api/admin/submissions returns VenueSubmission[]
          const submissionsData =
            (await submissionsRes.json()) as VenueSubmission[];

          if (Array.isArray(submissionsData)) {
            setSubmissions(submissionsData);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        showFeedback('error', `Fehler beim Laden der Admin-Daten: ${msg}`);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [showFeedback, submissionFilter]
  );

  const fetchSubmissions = React.useCallback(
    async (filterStatus: VenueSubmissionFilterStatus) => {
      try {
        const res = await fetch(
          `/api/admin/submissions?status=${encodeURIComponent(filterStatus)}`
        );

        if (
          res.ok &&
          res.headers.get('content-type')?.includes('application/json')
        ) {
          // SAFETY: /api/admin/submissions returns VenueSubmission[]
          const data = (await res.json()) as VenueSubmission[];

          if (Array.isArray(data)) {
            setSubmissions(data);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        showFeedback('error', `Fehler beim Laden der Einreichungen: ${msg}`);
      }
    },
    [showFeedback]
  );

  const handleSubmissionFilterChange = async (
    nextFilter: VenueSubmissionFilterStatus
  ) => {
    setSubmissionFilter(nextFilter);
    await fetchSubmissions(nextFilter);
  };

  const handleModerateSubmission = async (
    submission: VenueSubmission,
    action: 'approve' | 'reject'
  ) => {
    setModeratingSubmissionId(submission.id);

    try {
      const searchParams = new URLSearchParams(window.location.search);
      const urlToken = searchParams.get('token');

      const querySuffix = urlToken
        ? `?token=${encodeURIComponent(urlToken)}`
        : '';

      const res = await fetch(
        `/api/admin/submissions/${submission.id}/${action}${querySuffix}`,
        {
          method: 'POST',
        }
      );

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const nextStatus = action === 'approve' ? 'approved' : 'rejected';

      setSubmissions((prev) =>
        prev.map((item) =>
          item.id === submission.id ? { ...item, status: nextStatus } : item
        )
      );

      if (action === 'approve') {
        showFeedback(
          'success',
          `✅ Einreichung #${submission.id} erfolgreich freigegeben und live geschaltet!`
        );
      } else {
        showFeedback(
          'success',
          `❌ Einreichung #${submission.id} wurde abgelehnt.`
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showFeedback(
        'error',
        `Fehler bei der Moderation von #${submission.id}: ${msg}`
      );
    } finally {
      setModeratingSubmissionId(null);
    }
  };

  const handleStartEditSubmission = (sub: VenueSubmission) => {
    setEditingSubmission(sub);
    setEditFormData({
      admissionFee: sub.submittedData?.admissionFee || '',
      kioskDescription:
        sub.submittedData?.kioskDescription ?? sub.submittedData?.kiosk ?? '',
      parkingNotes:
        sub.submittedData?.parkingNotes ?? sub.submittedData?.parking ?? '',
      matchNotes:
        sub.submittedData?.matchNotes ?? sub.submittedData?.notes ?? '',
      submitterName: sub.submitterName || '',
      submitterRole: sub.submitterRole || '',
      scope: sub.scope ?? 'matchday',
    });
  };

  const handleSaveEditSubmission = async () => {
    if (!editingSubmission) {
      return;
    }

    setIsSavingEdit(true);

    try {
      const res = await fetch(`/api/admin/submissions/${editingSubmission.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      // SAFETY: PATCH returns updated VenueSubmission
      const updated = (await res.json()) as VenueSubmission;

      setSubmissions((prev) =>
        prev.map((item) => (item.id === editingSubmission.id ? updated : item))
      );

      showFeedback(
        'success',
        `✅ Einreichung #${editingSubmission.id} erfolgreich aktualisiert!`
      );
      setEditingSubmission(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showFeedback(
        'error',
        `Fehler beim Bearbeiten von #${editingSubmission.id}: ${msg}`
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteSubmission = async (sub: VenueSubmission) => {
    const confirmDelete = window.confirm(
      `Möchtest du Einreichung #${sub.id} wirklich unwiderruflich löschen?`
    );

    if (!confirmDelete) {
      return;
    }

    setDeletingSubmissionId(sub.id);

    try {
      const res = await fetch(`/api/admin/submissions/${sub.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      setSubmissions((prev) => prev.filter((item) => item.id !== sub.id));
      showFeedback(
        'success',
        `🗑️ Einreichung #${sub.id} wurde erfolgreich gelöscht.`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showFeedback('error', `Fehler beim Löschen von #${sub.id}: ${msg}`);
    } finally {
      setDeletingSubmissionId(null);
    }
  };

  const filteredSubmissions = React.useMemo(() => {
    if (submissionFilter === 'all') {
      return submissions;
    }

    return submissions.filter((sub) => sub.status === submissionFilter);
  }, [submissions, submissionFilter]);

  const pendingSubmissionsCount = React.useMemo(
    () => submissions.filter((sub) => sub.status === 'pending').length,
    [submissions]
  );

  // Initial fetch
  React.useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  // Adaptive polling: 3s while any sync run is running, 15s during idle
  const isSyncActive =
    status?.activeSyncRun != null ||
    syncRuns.some((run) => run.status === 'running');

  const pollIntervalMs = isSyncActive ? 3000 : 15000;

  React.useEffect(() => {
    const timer = setInterval(() => {
      fetchData(false);
    }, pollIntervalMs);

    return () => clearInterval(timer);
  }, [fetchData, pollIntervalMs]);

  // Handle Trigger Sync
  const handleTriggerSync = async () => {
    let target = selectedTarget;

    if (target === 'custom') {
      const trimmed = customLeagueId.trim();

      if (!trimmed || isNaN(parseInt(trimmed, 10))) {
        showFeedback('error', 'Bitte eine gültige numerische Liga-ID eingeben.');

        return;
      }

      target = `league:${trimmed}`;
    }

    setIsTriggering(true);

    try {
      const res = await fetch('/api/admin/sync/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: syncType, target }),
      });

      if (res.status === 409) {
        // SAFETY: Conflict response returns { message: string }
        const data = (await res.json()) as { message?: string };
        showFeedback('error', data.message || 'Ein Sync-Vorgang läuft bereits!');

        return;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      showFeedback('success', `Sync für "${target}" erfolgreich im Hintergrund gestartet.`);
      await fetchData(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showFeedback('error', `Fehler beim Starten des Syncs: ${msg}`);
    } finally {
      setIsTriggering(false);
    }
  };

  // Handle Retry Failed
  const handleRetryFailed = async () => {
    setIsRetrying(true);

    try {
      const res = await fetch('/api/admin/failures/retry', {
        method: 'POST',
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      // SAFETY: retry returns RetryFailedResult
      const result = (await res.json()) as {
        retriedCount?: number;
        resolvedCount?: number;
        stillFailingCount?: number;
      };

      showFeedback(
        'success',
        `Wiederholung abgeschlossen: ${result.resolvedCount ?? 0} behoben, ${result.stillFailingCount ?? 0} weiterhin offen.`
      );
      await fetchData(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showFeedback('error', `Fehler beim Wiederholen der Fehler: ${msg}`);
    } finally {
      setIsRetrying(false);
    }
  };

  // Handle Telegram Test
  const handleTelegramTest = async () => {
    setIsTestingTelegram(true);

    try {
      const res = await fetch('/api/admin/telegram/test', {
        method: 'POST',
      });

      // SAFETY: test endpoint returns { success: boolean, message?: string }
      const data = (await res.json()) as { success: boolean; message?: string };

      if (data.success) {
        showFeedback('success', 'Telegram Testnachricht erfolgreich versendet!');
      } else {
        showFeedback('error', `Telegram Fehler: ${data.message || 'Unbekannt'}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showFeedback('error', `Telegram Test fehlgeschlagen: ${msg}`);
    } finally {
      setIsTestingTelegram(false);
    }
  };

  // Debounce match search input (300ms)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(matchSearchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [matchSearchQuery]);

  // Execute live search when debouncedSearchQuery changes
  React.useEffect(() => {
    const trimmed = debouncedSearchQuery.trim();

    if (!trimmed) {
      setSearchResults([]);
      setIsSearchingMatches(false);

      return;
    }

    let cancelled = false;
    setIsSearchingMatches(true);

    fetch(`/api/admin/matches/search?q=${encodeURIComponent(trimmed)}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        // SAFETY: /api/admin/matches/search returns Match[]
        const data = (await res.json()) as Match[];

        if (!cancelled && Array.isArray(data)) {
          setSearchResults(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          showFeedback('error', `Fehler bei der Spielsuche: ${msg}`);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsSearchingMatches(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearchQuery, showFeedback]);

  // Fetch paginated active featured matches from server
  const fetchFeaturedMatches = React.useCallback(
    async (pageToFetch: number, queryToSearch?: string) => {
      setIsFeaturedLoading(true);

      try {
        const query =
          queryToSearch !== undefined ? queryToSearch : debouncedSearchQuery;

        const trimmed = query.trim();

        const params = new URLSearchParams({
          page: String(pageToFetch),
          limit: '25',
        });

        if (trimmed) {
          params.set('query', trimmed);
        }

        const res = await fetch(`/api/admin/matches/featured?${params.toString()}`);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        // SAFETY: /api/admin/matches/featured returns PaginatedMatchesResponse (or legacy Match[])
        const data = (await res.json()) as
          | PaginatedMatchesResponse
          | Match[];

        if (Array.isArray(data)) {
          setFeaturedMatches(data);
          setFeaturedTotal(data.length);
          setFeaturedPage(1);
          setFeaturedTotalPages(
            Math.max(1, Math.ceil(data.length / 25))
          );
        } else if (data && Array.isArray(data.data)) {
          setFeaturedMatches(data.data);
          setFeaturedTotal(data.total ?? 0);
          setFeaturedPage(data.page ?? pageToFetch);
          setFeaturedTotalPages(data.totalPages ?? 0);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        showFeedback('error', `Fehler beim Laden der Featured Matches: ${msg}`);
      } finally {
        setIsFeaturedLoading(false);
      }
    },
    [debouncedSearchQuery, showFeedback]
  );

  const isInitialFeaturedSearchRef = React.useRef(true);

  // Search input triggers debounced server-side search and resets to page 1
  React.useEffect(() => {
    if (isInitialFeaturedSearchRef.current) {
      isInitialFeaturedSearchRef.current = false;

      return;
    }

    setFeaturedPage(1);
    fetchFeaturedMatches(1, debouncedSearchQuery);
  }, [debouncedSearchQuery, fetchFeaturedMatches]);

  // Handle Toggle Featured Match (7-day default)
  const handleToggleFeature = async (match: Match, nextFeatured: boolean) => {
    setTogglingMatchId(match.id);

    try {
      const res = await fetch(`/api/admin/matches/${match.id}/feature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFeatured: nextFeatured, durationDays: 7 }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      // SAFETY: /api/admin/matches/:id/feature returns updated Match
      const updatedMatch = (await res.json()) as Match;

      const mergedMatch: Match = {
        ...match,
        ...updatedMatch,
        homeTeam: updatedMatch.homeTeam?.name ? updatedMatch.homeTeam : match.homeTeam,
        guestTeam: updatedMatch.guestTeam?.name ? updatedMatch.guestTeam : match.guestTeam,
        league: updatedMatch.league ?? match.league,
        venue: updatedMatch.venue !== undefined ? updatedMatch.venue : match.venue,
        isFeatured: nextFeatured,
        featuredUntil: nextFeatured ? (updatedMatch.featuredUntil ?? null) : null,
      };

      setSearchResults((prev) =>
        prev.map((m) => (m.id === match.id ? mergedMatch : m))
      );

      if (nextFeatured) {
        showFeedback(
          'success',
          `⭐ "${match.homeTeam.name} vs. ${match.guestTeam.name}" für 7 Tage als Featured Match markiert!`
        );
      } else {
        showFeedback(
          'success',
          `Hervorhebung für "${match.homeTeam.name} vs. ${match.guestTeam.name}" entfernt.`
        );
      }

      // Reload current page of featured matches
      await fetchFeaturedMatches(featuredPage, debouncedSearchQuery);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showFeedback('error', `Fehler beim Aktualisieren des Featured-Status: ${msg}`);
    } finally {
      setTogglingMatchId(null);
    }
  };

  // Handle deterministic top match recalculation
  const handleCalculateTopMatches = async () => {
    setIsCalculatingTopMatches(true);

    try {
      const res = await fetch('/api/admin/top-matches/calculate', {
        method: 'POST',
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      // SAFETY: /api/admin/top-matches/calculate returns json summary
      const data = (await res.json()) as {
        success: boolean;
        summary?: {
          leaguesProcessed: number;
          matchesEvaluated: number;
          topMatchesFeatured: number;
          preservedAdminCount: number;
        };
      };

      if (data.success && data.summary) {
        showFeedback(
          'success',
          `⚡ Topspiele erfolgreich neu berechnet! ${data.summary.topMatchesFeatured} Topspiele in ${data.summary.leaguesProcessed} Ligen ermittelt (${data.summary.preservedAdminCount} Admin-Picks beibehalten).`
        );
      } else {
        showFeedback('success', '⚡ Topspiele erfolgreich neu berechnet!');
      }

      // Refresh featured matches list
      await fetchFeaturedMatches(1, debouncedSearchQuery);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showFeedback('error', `Fehler bei der Neuberechnung der Topspiele: ${msg}`);
    } finally {
      setIsCalculatingTopMatches(false);
    }
  };

  const renderMatchRow = (match: Match, contextPrefix: string) => {
    const isFeatured = match.isFeatured === true;
    const isToggling = togglingMatchId === match.id;
    const leagueLabel = match.league?.name || `Liga #${match.leagueId}`;

    const venueLabel = match.venue
      ? `${match.venue.name}${match.venue.city ? `, ${match.venue.city}` : ''}`
      : 'Halle offen';

    return (
      <div
        key={`${contextPrefix}-${match.id}`}
        data-testid={`${contextPrefix}-match-${match.id}`}
        className={`flex flex-col justify-between gap-3 rounded-lg border p-3 transition-colors sm:flex-row sm:items-center ${
          isFeatured
            ? 'border-amber-500/40 bg-amber-500/5'
            : 'border-border bg-card/50 hover:bg-accent/30'
        }`}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {match.homeTeam.name} vs. {match.guestTeam.name}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              #{match.id}
            </span>
            {isFeatured ? (
              <span
                data-testid={`status-badge-${match.id}`}
                className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-400"
              >
                <Star className="size-3 fill-amber-400 text-amber-400" />
                <span>
                  ⭐ Aktiv bis {formatShortDate(match.featuredUntil)}
                </span>
              </span>
            ) : (
              <Badge
                variant="outline"
                data-testid={`status-badge-${match.id}`}
                className="text-[10px] text-muted-foreground"
              >
                Inaktiv
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">{leagueLabel}</span>
            <span>•</span>
            <span>{formatMatchKickoff(match.kickoffDate, match.kickoffTime)}</span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3 shrink-0" />
              <span>{venueLabel}</span>
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center">
          {isFeatured ? (
            <Button
              variant="outline"
              size="sm"
              disabled={isToggling}
              onClick={() => handleToggleFeature(match, false)}
              data-testid={`unfeature-btn-${match.id}`}
              className="gap-1.5 border-rose-500/30 text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
            >
              {isToggling ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : (
                <X className="size-3.5" />
              )}
              <span>✖️ Hervorhebung entfernen</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={isToggling}
              onClick={() => handleToggleFeature(match, true)}
              data-testid={`feature-btn-${match.id}`}
              className="gap-1.5 border-amber-500/40 bg-amber-500/10 text-xs text-amber-400 hover:bg-amber-500/20 hover:text-amber-300"
            >
              {isToggling ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : (
                <Star className="size-3.5" />
              )}
              <span>⭐ Als Featured markieren (7 Tage)</span>
            </Button>
          )}
        </div>
      </div>
    );
  };

  if (isLoading && !status) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="size-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">
            Lade HeimspielRadar Admin-Metriken...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh w-full flex-col overflow-y-auto bg-background text-foreground">
      {/* Header Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Activity className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight sm:text-lg">
                HeimspielRadar Pi Admin
              </h1>
              <Badge variant="outline" className="font-mono text-[10px]">
                /admin
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Raspberry Pi Scraper & Observability Dashboard
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground sm:flex">
            <span
              className={`size-2 rounded-full ${
                isSyncActive
                  ? 'animate-pulse bg-amber-400'
                  : 'bg-emerald-400'
              }`}
            />
            <span>{isSyncActive ? 'Sync aktiv (3s)' : 'Bereit (15s)'}</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(false)}
            disabled={isRefreshing}
            className="gap-1.5 text-xs"
          >
            <RefreshCw
              className={`size-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            <span className="hidden sm:inline">Aktualisieren</span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 space-y-6 p-4 sm:p-6">
        {/* Feedback Alert */}
        {feedbackMessage && (
          <div
            className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm transition-all ${
              feedbackMessage.type === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : feedbackMessage.type === 'error'
                  ? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                  : 'border-blue-500/30 bg-blue-500/10 text-blue-400'
            }`}
          >
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="size-4 shrink-0" />
            ) : feedbackMessage.type === 'error' ? (
              <XCircle className="size-4 shrink-0" />
            ) : (
              <AlertCircle className="size-4 shrink-0" />
            )}
            <span className="flex-1 font-medium">{feedbackMessage.text}</span>
            <button
              type="button"
              onClick={() => setFeedbackMessage(null)}
              className="text-xs opacity-70 hover:opacity-100"
            >
              Schließen
            </button>
          </div>
        )}

        {/* Tab Bar */}
        <div
          role="tablist"
          aria-label="Admin-Bereiche"
          className="flex flex-wrap items-center gap-2 border-b border-border pb-3"
        >
          <Button
            variant={activeTab === 'overview' ? 'default' : 'outline'}
            size="sm"
            role="tab"
            aria-selected={activeTab === 'overview'}
            data-testid="admin-tab-overview"
            onClick={() => setActiveTab('overview')}
            className="gap-1.5 text-xs"
          >
            <Activity className="size-3.5" />
            <span>System & Sync</span>
          </Button>

          <Button
            variant={activeTab === 'featured' ? 'default' : 'outline'}
            size="sm"
            role="tab"
            aria-selected={activeTab === 'featured'}
            data-testid="admin-tab-featured"
            onClick={() => setActiveTab('featured')}
            className="gap-1.5 text-xs"
          >
            <Star className="size-3.5 text-amber-400" />
            <span>⭐ Featured Matches</span>
            <Badge variant="outline" className="ml-1 px-1.5 py-0 text-[10px]">
              {featuredTotal}
            </Badge>
          </Button>

          <Button
            variant={activeTab === 'submissions' ? 'default' : 'outline'}
            size="sm"
            role="tab"
            aria-selected={activeTab === 'submissions'}
            data-testid="admin-tab-submissions"
            onClick={() => setActiveTab('submissions')}
            className="gap-1.5 text-xs"
          >
            <span>🌭 Submissions & Moderation</span>
            <Badge variant="outline" className="ml-1 px-1.5 py-0 text-[10px]">
              {pendingSubmissionsCount}
            </Badge>
          </Button>
        </div>

        {activeTab === 'overview' && (
          <>
            {/* System Status Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Uptime Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Systemlaufzeit
              </CardTitle>
              <Clock className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">
                {status ? formatUptime(status.uptimeSeconds) : '–'}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Node.js {status?.nodeVersion || '–'}
              </p>
            </CardContent>
          </Card>

          {/* Memory Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Arbeitsspeicher (Heap)
              </CardTitle>
              <Cpu className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">
                {status?.memory
                  ? `${status.memory.heapUsedMb} MB`
                  : '–'}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {status?.memory
                  ? `Heap Total: ${status.memory.heapTotalMb} MB • RSS: ${status.memory.rssMb} MB`
                  : '–'}
              </p>
            </CardContent>
          </Card>

          {/* Database Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Datenbank (PostgreSQL)
              </CardTitle>
              <Database className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span
                  className={`size-2.5 rounded-full ${
                    status?.databaseConnected
                      ? 'bg-emerald-400'
                      : 'bg-rose-500'
                  }`}
                />
                <span className="text-xl font-bold">
                  {status?.databaseConnected ? 'Verbunden' : 'Getrennt'}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                PostGIS Geodatenbank
              </p>
            </CardContent>
          </Card>

          {/* Telegram Alerting Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Telegram Alerting
              </CardTitle>
              <Send className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span
                  className={`size-2.5 rounded-full ${
                    status?.telegramConfigured
                      ? 'bg-emerald-400'
                      : 'bg-muted-foreground'
                  }`}
                />
                <span className="text-xl font-bold">
                  {status?.telegramConfigured ? 'Aktiv' : 'Inaktiv'}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {status?.telegramConfigured
                  ? 'Live-Status & Push-Warnungen'
                  : 'Token / Chat-ID fehlen'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Action Bar */}
        <Card className="border-border/80 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Zap className="size-4 text-primary" />
              <span>Aktionen & Manuelle Synchronisation</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              {/* Target Selector */}
              <div className="flex-1 space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Zielverband / Liga
                </label>
                <select
                  value={selectedTarget}
                  onChange={(e) => setSelectedTarget(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="all">
                    Alle Verbände bundesweit (23 Verbände & Regionalligen)
                  </option>
                  <optgroup label="Bundesligen & Regionalligen">
                    {GERMAN_BASKETBALL_VERBAENDE.filter(
                      (v) => v.type === 'national' || v.type === 'regional'
                    ).map((v) => (
                      <option key={v.id} value={`verband:${v.id}`}>
                        {v.shortName} – {v.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="16 Landesverbände & DRS">
                    {GERMAN_BASKETBALL_VERBAENDE.filter(
                      (v) => v.type === 'state' || v.type === 'special'
                    ).map((v) => (
                      <option key={v.id} value={`verband:${v.id}`}>
                        {v.shortName} – {v.name}
                      </option>
                    ))}
                  </optgroup>
                  <option value="custom">
                    Einzelne DBB Liga-ID...
                  </option>
                </select>
              </div>

              {/* Custom Liga-ID Input */}
              {selectedTarget === 'custom' && (
                <div className="w-full space-y-1.5 sm:w-48">
                  <label className="text-xs font-medium text-muted-foreground">
                    DBB Liga-ID
                  </label>
                  <input
                    type="number"
                    placeholder="z.B. 53941"
                    value={customLeagueId}
                    onChange={(e) => setCustomLeagueId(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              )}

              {/* Sync Type Selector */}
              <div className="w-full space-y-1.5 sm:w-56">
                <label className="text-xs font-medium text-muted-foreground">
                  Sync-Art
                </label>
                <select
                  value={syncType}
                  onChange={(e) => {
                    const val = e.target.value;

                    if (val === 'deep') {
                      setSyncType('deep');
                    } else {
                      setSyncType('delta');
                    }
                  }}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="delta">Delta-Sync (Schnell)</option>
                  <option value="deep">Vollständiger Sync (Tief)</option>
                </select>
              </div>

              {/* Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1 sm:pt-0">
                <Button
                  onClick={handleTriggerSync}
                  disabled={isSyncActive || isTriggering}
                  className="gap-2 text-xs"
                >
                  {isSyncActive || isTriggering ? (
                    <RefreshCw className="size-3.5 animate-spin" />
                  ) : (
                    <Zap className="size-3.5" />
                  )}
                  <span>{isSyncActive ? 'Sync läuft...' : 'Sync starten'}</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={handleRetryFailed}
                  disabled={isRetrying || failures.length === 0}
                  className="gap-2 text-xs"
                >
                  <AlertTriangle className="size-3.5 text-amber-500" />
                  <span>Fehler wiederholen</span>
                  {failures.length > 0 && (
                    <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
                      {failures.length}
                    </Badge>
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={handleTelegramTest}
                  disabled={isTestingTelegram || !status?.telegramConfigured}
                  className="gap-2 text-xs"
                >
                  {isTestingTelegram ? (
                    <RefreshCw className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                  <span>Telegram Test</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
          </>
        )}

        {/* Featured Matches Section */}
        {(activeTab === 'overview' || activeTab === 'featured') && (
        <Card
          id="featured-matches-section"
          data-testid="featured-matches-card"
          className="border-amber-500/30 bg-card/80"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <Star className="size-4 fill-amber-400 text-amber-400" />
              <CardTitle className="text-sm font-semibold">
                ⭐ Featured Matches
              </CardTitle>
              <Badge
                variant="outline"
                className="border-amber-500/40 bg-amber-500/10 text-[11px] text-amber-400"
              >
                {featuredTotal} aktiv
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCalculateTopMatches}
                disabled={isCalculatingTopMatches}
                className="border-amber-500/40 bg-amber-500/10 text-xs text-amber-300 hover:bg-amber-500/20 hover:text-amber-200 cursor-pointer"
                data-testid="calculate-top-matches-button"
              >
                {isCalculatingTopMatches ? (
                  <>
                    <RefreshCw className="mr-1.5 size-3.5 animate-spin" />
                    <span>Berechne...</span>
                  </>
                ) : (
                  <>
                    <Zap className="mr-1.5 size-3.5 text-amber-400" />
                    <span>⚡ Topspiele neu berechnen</span>
                  </>
                )}
              </Button>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Standard-Laufzeit: 7 Tage
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Debounced Live Search Bar */}
            <div className="space-y-1.5">
              <label
                htmlFor="featured-match-search"
                className="text-xs font-medium text-muted-foreground"
              >
                Spiel suchen (Teamname, Liga oder Spiel-ID)
              </label>
              <div className="relative flex items-center">
                <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
                <input
                  id="featured-match-search"
                  type="text"
                  value={matchSearchQuery}
                  onChange={(e) => setMatchSearchQuery(e.target.value)}
                  placeholder="Spiele suchen nach Team, Liga oder Spiel-ID (z. B. Baskets, Oberliga, 101)..."
                  aria-label="Spiele suchen"
                  data-testid="featured-match-search-input"
                  className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
                {matchSearchQuery && (
                  <button
                    type="button"
                    aria-label="Suche zurücksetzen"
                    onClick={() => {
                      setMatchSearchQuery('');
                      setDebouncedSearchQuery('');
                      setSearchResults([]);
                    }}
                    className="absolute right-2.5 rounded p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Search Results List */}
            {debouncedSearchQuery.trim() !== '' && (
              <div className="space-y-2.5" data-testid="featured-search-results">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Suchergebnisse für „{debouncedSearchQuery.trim()}“
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {isSearchingMatches
                      ? 'Suche läuft...'
                      : `${searchResults.length} Treffer`}
                  </span>
                </div>

                {isSearchingMatches ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                    <RefreshCw className="size-4 animate-spin text-amber-400" />
                    <span>Suche Spiele...</span>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                    Keine passenden Spiele für „{debouncedSearchQuery.trim()}“ gefunden.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {searchResults.map((match) =>
                      renderMatchRow(match, 'search-result')
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Active Featured Matches List */}
            <div className="space-y-2.5" data-testid="active-featured-matches">
              <div className="flex items-center justify-between border-t border-border/60 pt-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Aktuell aktive Featured Matches
                  </h3>
                  <Badge variant="outline" className="text-[10px]">
                    {featuredTotal} {debouncedSearchQuery.trim() ? 'Treffer' : 'aktiv'}
                  </Badge>
                </div>
                {isFeaturedLoading && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <RefreshCw className="size-3 animate-spin text-amber-400" />
                    <span>Aktualisiere...</span>
                  </div>
                )}
              </div>

              {isFeaturedLoading && featuredMatches.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                  <RefreshCw className="size-4 animate-spin text-amber-400" />
                  <span>Lade Featured Matches...</span>
                </div>
              ) : featuredMatches.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border py-5 text-center text-xs text-muted-foreground">
                  {debouncedSearchQuery.trim()
                    ? `Keine passenden Featured Matches für „${debouncedSearchQuery.trim()}“ gefunden.`
                    : 'Derzeit sind keine Featured Matches aktiv. Nutze die Suche oben, um ein Highlight-Spiel für 7 Tage hervorzuheben.'}
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {featuredMatches.map((match) =>
                      renderMatchRow(match, 'active-featured')
                    )}
                  </div>

                  {/* Pagination Controls */}
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3 text-xs text-muted-foreground"
                    data-testid="featured-pagination-controls"
                  >
                    <div className="text-xs">
                      <span>
                        Gesamt: <strong>{featuredTotal}</strong> Treffer
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const prevPage = Math.max(1, featuredPage - 1);
                          setFeaturedPage(prevPage);
                          fetchFeaturedMatches(prevPage, debouncedSearchQuery);
                        }}
                        disabled={featuredPage <= 1 || isFeaturedLoading}
                        data-testid="featured-pagination-prev"
                        className="h-8 gap-1 px-3 text-xs cursor-pointer"
                      >
                        <ChevronLeft className="size-3.5" />
                        <span>Vorherige Seite</span>
                      </Button>

                      <span
                        data-testid="featured-pagination-info"
                        className="px-2 text-xs font-medium text-foreground"
                      >
                        Seite {featuredPage} von {Math.max(1, featuredTotalPages)}
                      </span>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const nextPage = Math.min(
                            featuredTotalPages,
                            featuredPage + 1
                          );

                          setFeaturedPage(nextPage);
                          fetchFeaturedMatches(nextPage, debouncedSearchQuery);
                        }}
                        disabled={
                          featuredPage >= featuredTotalPages ||
                          featuredTotalPages === 0 ||
                          isFeaturedLoading
                        }
                        data-testid="featured-pagination-next"
                        className="h-8 gap-1 px-3 text-xs cursor-pointer"
                      >
                        <span>Nächste Seite</span>
                        <ChevronRight className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
        )}

        {/* Submissions & Moderation Section */}
        {activeTab === 'submissions' && (
          <Card
            id="submissions-moderation-section"
            data-testid="submissions-moderation-card"
            className="border-primary/30 bg-card/80"
          >
            <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold">
                  🌭 Submissions & Moderation
                </CardTitle>
                <Badge variant="outline" className="text-[11px]">
                  {filteredSubmissions.length} Einträge
                </Badge>
              </div>

              {/* Status Filter Pills */}
              <div
                role="group"
                aria-label="Submissions Status-Filter"
                className="flex flex-wrap items-center gap-1.5"
              >
                <Button
                  variant={
                    submissionFilter === 'pending' ? 'default' : 'outline'
                  }
                  size="sm"
                  data-testid="submission-filter-pending"
                  onClick={() => handleSubmissionFilterChange('pending')}
                  className="h-7 px-2.5 text-xs"
                >
                  Ausstehend (pending)
                </Button>
                <Button
                  variant={
                    submissionFilter === 'approved' ? 'default' : 'outline'
                  }
                  size="sm"
                  data-testid="submission-filter-approved"
                  onClick={() => handleSubmissionFilterChange('approved')}
                  className="h-7 px-2.5 text-xs"
                >
                  Freigegeben (approved)
                </Button>
                <Button
                  variant={
                    submissionFilter === 'rejected' ? 'default' : 'outline'
                  }
                  size="sm"
                  data-testid="submission-filter-rejected"
                  onClick={() => handleSubmissionFilterChange('rejected')}
                  className="h-7 px-2.5 text-xs"
                >
                  Abgelehnt (rejected)
                </Button>
                <Button
                  variant={submissionFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  data-testid="submission-filter-all"
                  onClick={() => handleSubmissionFilterChange('all')}
                  className="h-7 px-2.5 text-xs"
                >
                  Alle (all)
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              {filteredSubmissions.length === 0 ? (
                <div
                  data-testid="submissions-empty-state"
                  className="rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground"
                >
                  Keine Einreichungen für den Filter „{submissionFilter}“
                  gefunden.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table
                    data-testid="submissions-table"
                    className="w-full text-left text-xs"
                  >
                    <thead className="border-b border-border text-muted-foreground">
                      <tr>
                        <th className="py-2.5 pr-4 font-medium">Datum</th>
                        <th className="py-2.5 pr-4 font-medium">
                          Spiel & Halle
                        </th>
                        <th className="py-2.5 pr-4 font-medium">
                          Name & Rolle
                        </th>
                        <th className="py-2.5 pr-4 font-medium">
                          Eingereichte Felder
                        </th>
                        <th className="py-2.5 pr-4 font-medium">Geltungsbereich</th>
                        <th className="py-2.5 pr-4 font-medium">Status</th>
                        <th className="py-2.5 font-medium">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {filteredSubmissions.map((sub) => {
                        const isModerating = moderatingSubmissionId === sub.id;

                        const admissionFee =
                          sub.submittedData?.admissionFee || null;

                        const kioskText =
                          sub.submittedData?.kioskDescription ??
                          sub.submittedData?.kiosk ??
                          null;

                        const parkingText =
                          sub.submittedData?.parkingNotes ??
                          sub.submittedData?.parking ??
                          null;

                        const notesText =
                          sub.submittedData?.matchNotes ??
                          sub.submittedData?.notes ??
                          null;

                        return (
                          <tr
                            key={sub.id}
                            data-testid={`submission-row-${sub.id}`}
                            className="align-top hover:bg-accent/30"
                          >
                            <td className="whitespace-nowrap py-3 pr-4 font-mono text-muted-foreground">
                              <div>{formatDateTime(sub.createdAt)}</div>
                              <div className="mt-0.5 text-[10px]">
                                #{sub.id}
                              </div>
                            </td>

                            <td className="py-3 pr-4">
                              {sub.match ? (
                                <div className="space-y-0.5">
                                  <div className="font-semibold text-foreground">
                                    {sub.match.homeTeam} vs.{' '}
                                    {sub.match.guestTeam}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">
                                    {sub.match.leagueName ||
                                      `Liga #${sub.match.leagueId ?? ''}`}{' '}
                                    •{' '}
                                    {formatMatchKickoff(
                                      sub.match.kickoffDate,
                                      sub.match.kickoffTime
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-muted-foreground">
                                  {sub.matchId
                                    ? `Spiel #${sub.matchId}`
                                    : 'Kein Spiel verknüpft'}
                                </div>
                              )}

                              <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                                <MapPin className="size-3 shrink-0" />
                                <span>
                                  {sub.venue
                                    ? `${sub.venue.name}${sub.venue.city ? `, ${sub.venue.city}` : ''}`
                                    : sub.venueId
                                      ? `Halle #${sub.venueId}`
                                      : 'Halle offen'}
                                </span>
                              </div>
                            </td>

                            <td className="py-3 pr-4">
                              <div className="font-medium text-foreground">
                                {sub.submitterName || 'Anonym'}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {sub.submitterRole || 'Keine Rolle'}
                              </div>
                            </td>

                            <td className="max-w-md space-y-2 py-3 pr-4">
                              <div className="space-y-1">
                                <div>
                                  <span className="font-semibold text-muted-foreground">
                                    Eintritt:{' '}
                                  </span>
                                  <span className="text-foreground">
                                    {admissionFee || '–'}
                                  </span>
                                </div>
                                <div>
                                  <span className="font-semibold text-muted-foreground">
                                    Kiosk:{' '}
                                  </span>
                                  <span className="text-foreground">
                                    {kioskText || '–'}
                                  </span>
                                </div>
                                <div>
                                  <span className="font-semibold text-muted-foreground">
                                    Parken:{' '}
                                  </span>
                                  <span className="text-foreground">
                                    {parkingText || '–'}
                                  </span>
                                </div>
                                <div>
                                  <span className="font-semibold text-muted-foreground">
                                    Notizen:{' '}
                                  </span>
                                  <span className="text-foreground">
                                    {notesText || '–'}
                                  </span>
                                </div>
                              </div>

                              {(admissionFee || kioskText || parkingText || notesText) && (
                                <div
                                  className="mt-2 rounded-lg border border-border/60 bg-background/50 p-2"
                                  data-testid={`submission-preview-${sub.id}`}
                                >
                                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    MatchCard Kachel-Vorschau
                                  </div>
                                  <KioskInfoBadges
                                    size="sm"
                                    match={{
                                      id: sub.matchId ?? sub.id,
                                      leagueId: sub.match?.leagueId ?? 0,
                                      matchDay: 0,
                                      kickoffDate: sub.match?.kickoffDate ?? null,
                                      kickoffTime: sub.match?.kickoffTime ?? null,
                                      homeTeam: { id: 0, dbbId: 0, name: sub.match?.homeTeam || 'Heim' },
                                      guestTeam: { id: 0, dbbId: 0, name: sub.match?.guestTeam || 'Gast' },
                                      confirmed: true,
                                      admissionFee: admissionFee || undefined,
                                      venue: {
                                        id: sub.venueId ?? 0,
                                        name: sub.venue?.name || '',
                                        street: sub.venue?.street || '',
                                        postalCode: sub.venue?.postalCode || '',
                                        city: sub.venue?.city || '',
                                        latitude: null,
                                        longitude: null,
                                        kioskDescription: kioskText || undefined,
                                        parkingNotes: parkingText || undefined,
                                      },
                                      matchNotes: notesText || undefined,
                                      submitterName: sub.submitterName || undefined,
                                      submitterRole: sub.submitterRole || undefined,
                                    }}
                                  />
                                </div>
                              )}
                            </td>

                            <td className="whitespace-nowrap py-3 pr-4">
                              {sub.scope === 'match' ? (
                                <Badge
                                  variant="outline"
                                  data-testid={`submission-scope-${sub.id}`}
                                  className="border-indigo-500/40 bg-indigo-500/10 text-indigo-300 text-[10px]"
                                >
                                  Nur dieses Spiel
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  data-testid={`submission-scope-${sub.id}`}
                                  className="border-amber-500/40 bg-amber-500/10 text-amber-300 text-[10px]"
                                >
                                  Spieltag
                                </Badge>
                              )}
                            </td>

                            <td className="whitespace-nowrap py-3 pr-4">
                              {sub.status === 'pending' ? (
                                <span
                                  data-testid={`submission-status-${sub.id}`}
                                  className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400"
                                >
                                  Ausstehend
                                </span>
                              ) : sub.status === 'approved' ? (
                                <span
                                  data-testid={`submission-status-${sub.id}`}
                                  className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400"
                                >
                                  Freigegeben
                                </span>
                              ) : (
                                <span
                                  data-testid={`submission-status-${sub.id}`}
                                  className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-400"
                                >
                                  Abgelehnt
                                </span>
                              )}
                            </td>

                            <td className="whitespace-nowrap py-3">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {sub.status === 'pending' && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={isModerating}
                                      data-testid={`approve-submission-btn-${sub.id}`}
                                      onClick={() =>
                                        handleModerateSubmission(sub, 'approve')
                                      }
                                      className="h-7 gap-1 border-emerald-500/40 bg-emerald-500/10 px-2 text-xs text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300"
                                    >
                                      <span>✅ Freigeben</span>
                                    </Button>

                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={isModerating}
                                      data-testid={`reject-submission-btn-${sub.id}`}
                                      onClick={() =>
                                        handleModerateSubmission(sub, 'reject')
                                      }
                                      className="h-7 gap-1 border-rose-500/40 bg-rose-500/10 px-2 text-xs text-rose-400 hover:bg-rose-500/20 hover:text-rose-300"
                                    >
                                      <span>❌ Ablehnen</span>
                                    </Button>
                                  </>
                                )}

                                <Button
                                  variant="outline"
                                  size="sm"
                                  data-testid={`edit-submission-btn-${sub.id}`}
                                  onClick={() => handleStartEditSubmission(sub)}
                                  className="h-7 gap-1 border-border px-2 text-xs text-foreground hover:bg-accent"
                                >
                                  <Edit2 className="size-3" />
                                  <span>Bearbeiten</span>
                                </Button>

                                {sub.matchId && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={togglingMatchId === sub.matchId}
                                    data-testid={`feature-submission-btn-${sub.id}`}
                                    onClick={async () => {
                                      // SAFETY: synthetic minimal Match object sufficient for toggleFeature endpoint
                                      const syntheticMatch = {
                                        id: sub.matchId,
                                        homeTeam: { name: sub.match?.homeTeam || `Team #${sub.matchId}` },
                                        guestTeam: { name: sub.match?.guestTeam || 'Gast' },
                                        leagueId: sub.match?.leagueId ?? 0,
                                      } as Match;

                                      await handleToggleFeature(syntheticMatch, true);
                                    }}
                                    className="h-7 gap-1 border-amber-500/40 bg-amber-500/10 px-2 text-xs text-amber-400 hover:bg-amber-500/20 hover:text-amber-300"
                                  >
                                    {togglingMatchId === sub.matchId ? (
                                      <RefreshCw className="size-3 animate-spin" />
                                    ) : (
                                      <Star className="size-3" />
                                    )}
                                    <span>⭐ Featured</span>
                                  </Button>
                                )}

                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={deletingSubmissionId === sub.id}
                                  data-testid={`delete-submission-btn-${sub.id}`}
                                  onClick={() => handleDeleteSubmission(sub)}
                                  className="h-7 gap-1 border-rose-500/30 px-2 text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                                >
                                  {deletingSubmissionId === sub.id ? (
                                    <RefreshCw className="size-3 animate-spin" />
                                  ) : (
                                    <Trash2 className="size-3" />
                                  )}
                                  <span>Löschen</span>
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'overview' && (
          <>
        {/* Active Failures Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-amber-500" />
              <CardTitle className="text-sm font-semibold">
                Aktive Fehler (sync_failures)
              </CardTitle>
              {failures.length > 0 && (
                <Badge variant="destructive" className="ml-1 text-[11px]">
                  {failures.length} offen
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {failures.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                <CheckCircle2 className="size-8 text-emerald-500/60" />
                <p className="mt-2 text-xs font-medium">
                  Keine offenen Synchronisationsfehler. Alles läuft einwandfrei!
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Typ</th>
                      <th className="py-2 pr-4 font-medium">Liga / Match</th>
                      <th className="py-2 pr-4 font-medium">Fehlermeldung</th>
                      <th className="py-2 pr-4 font-medium">Versuche</th>
                      <th className="py-2 font-medium">Zeitpunkt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {failures.map((f) => (
                      <tr key={f.id} className="hover:bg-accent/40">
                        <td className="py-2.5 pr-4 font-mono font-medium">
                          <Badge variant="outline" className="text-[10px]">
                            {f.entityType}
                          </Badge>
                        </td>
                        <td className="py-2.5 pr-4 font-medium">
                          {f.leagueName ? (
                            <span>
                              {f.leagueName}{' '}
                              <span className="font-mono text-muted-foreground">
                                (#{f.dbbLeagueId})
                              </span>
                            </span>
                          ) : (
                            <span className="font-mono">#{f.dbbLeagueId}</span>
                          )}
                          {f.dbbMatchId && (
                            <span className="ml-1.5 font-mono text-muted-foreground">
                              Spiel #{f.dbbMatchId}
                            </span>
                          )}
                        </td>
                        <td className="max-w-xs truncate py-2.5 pr-4 text-rose-400" title={f.errorMessage}>
                          {f.errorMessage}
                        </td>
                        <td className="py-2.5 pr-4 font-mono">
                          {f.retryCount}
                        </td>
                        <td className="py-2.5 font-mono text-muted-foreground">
                          {formatDateTime(f.failedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Sync Runs Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <Terminal className="size-4 text-primary" />
              <CardTitle className="text-sm font-semibold">
                Sync-Protokoll (sync_runs)
              </CardTitle>
            </div>
            <span className="text-xs text-muted-foreground">
              Letzte {syncRuns.length} Ausführungen
            </span>
          </CardHeader>
          <CardContent>
            {syncRuns.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Noch keine protokollierten Sync-Läufe vorhanden.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">Ziel</th>
                      <th className="py-2 pr-4 font-medium">Typ</th>
                      <th className="py-2 pr-4 font-medium">Startzeit</th>
                      <th className="py-2 pr-4 font-medium">Dauer</th>
                      <th className="py-2 pr-4 font-medium">Ligen (OK / Ges.)</th>
                      <th className="py-2 pr-4 font-medium">Spiele</th>
                      <th className="py-2 pr-4 font-medium">Venues</th>
                      <th className="py-2 font-medium">Fehler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {syncRuns.map((run) => (
                      <tr key={run.id} className="hover:bg-accent/40">
                        <td className="py-2.5 pr-4">
                          {run.status === 'running' ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400 animate-pulse">
                              <span className="size-1.5 rounded-full bg-amber-400" />
                              running
                            </span>
                          ) : run.status === 'success' ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                              <CheckCircle2 className="size-2.5" />
                              success
                            </span>
                          ) : run.status === 'partial' ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                              <AlertTriangle className="size-2.5" />
                              partial
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-400">
                              <XCircle className="size-2.5" />
                              error
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 font-medium">
                          {formatTargetLabel(run.target)}
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-muted-foreground uppercase text-[10px]">
                          {run.syncType}
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-muted-foreground">
                          {formatDateTime(run.startedAt)}
                        </td>
                        <td className="py-2.5 pr-4 font-mono">
                          {formatDuration(run.durationMs)}
                        </td>
                        <td className="py-2.5 pr-4 font-mono">
                          {run.successfulLeagues} / {run.totalLeagues}
                        </td>
                        <td className="py-2.5 pr-4 font-mono font-medium">
                          {run.syncedMatches}
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-muted-foreground">
                          {run.geocodedVenues}
                        </td>
                        <td className="py-2.5 font-mono">
                          {run.failuresCount > 0 ? (
                            <span className="font-semibold text-rose-400">
                              {run.failuresCount}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                          {run.errorMessage && (
                            <p className="mt-0.5 max-w-xs truncate text-[10px] text-rose-400" title={run.errorMessage}>
                              {run.errorMessage}
                            </p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
          </>
        )}
      </main>

      {/* Edit Submission Modal */}
      {editingSubmission && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-submission-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="size-4 text-primary" />
                <h2
                  id="edit-submission-title"
                  className="text-sm font-semibold text-foreground"
                >
                  Einreichung #{editingSubmission.id} bearbeiten
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingSubmission(null)}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="edit-submitter-name"
                    className="font-medium text-muted-foreground"
                  >
                    Name
                  </label>
                  <input
                    id="edit-submitter-name"
                    type="text"
                    value={editFormData.submitterName || ''}
                    onChange={(e) =>
                      setEditFormData((prev) => ({
                        ...prev,
                        submitterName: e.target.value,
                      }))
                    }
                    placeholder="z.B. Lena"
                    className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="edit-submitter-role"
                    className="font-medium text-muted-foreground"
                  >
                    Rolle
                  </label>
                  <input
                    id="edit-submitter-role"
                    type="text"
                    value={editFormData.submitterRole || ''}
                    onChange={(e) =>
                      setEditFormData((prev) => ({
                        ...prev,
                        submitterRole: e.target.value,
                      }))
                    }
                    placeholder="z.B. Verein, Fan, Schiedsrichter"
                    className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="edit-scope"
                  className="font-medium text-muted-foreground"
                >
                  Geltungsbereich (Scope)
                </label>
                <select
                  id="edit-scope"
                  data-testid="edit-scope-select"
                  value={editFormData.scope || 'matchday'}
                  onChange={(e) => {
                    const nextScope = e.target.value === 'match' ? 'match' : 'matchday';
                    setEditFormData((prev) => ({
                      ...prev,
                      scope: nextScope,
                    }));
                  }}
                  className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  <option value="matchday">Spieltag (Halle am Spieltag / alle Spiele)</option>
                  <option value="match">Nur dieses Spiel</option>
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="edit-admission-fee"
                  className="font-medium text-muted-foreground"
                >
                  Eintrittspreis
                </label>
                <input
                  id="edit-admission-fee"
                  type="text"
                  value={editFormData.admissionFee || ''}
                  onChange={(e) =>
                    setEditFormData((prev) => ({
                      ...prev,
                      admissionFee: e.target.value,
                    }))
                  }
                  placeholder="z.B. Freier Eintritt oder 3 EUR"
                  className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="edit-kiosk-description"
                  className="font-medium text-muted-foreground"
                >
                  Kiosk & Verpflegung
                </label>
                <textarea
                  id="edit-kiosk-description"
                  rows={2}
                  value={editFormData.kioskDescription || ''}
                  onChange={(e) =>
                    setEditFormData((prev) => ({
                      ...prev,
                      kioskDescription: e.target.value,
                    }))
                  }
                  placeholder="z.B. Kaffee, Kuchen & Kaltgetränke"
                  className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="edit-parking-notes"
                  className="font-medium text-muted-foreground"
                >
                  Parkhinweise
                </label>
                <textarea
                  id="edit-parking-notes"
                  rows={2}
                  value={editFormData.parkingNotes || ''}
                  onChange={(e) =>
                    setEditFormData((prev) => ({
                      ...prev,
                      parkingNotes: e.target.value,
                    }))
                  }
                  placeholder="z.B. Parkplatz direkt hinter der Halle"
                  className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="edit-match-notes"
                  className="font-medium text-muted-foreground"
                >
                  Besondere Spiel-Notizen
                </label>
                <textarea
                  id="edit-match-notes"
                  rows={2}
                  value={editFormData.matchNotes || ''}
                  onChange={(e) =>
                    setEditFormData((prev) => ({
                      ...prev,
                      matchNotes: e.target.value,
                    }))
                  }
                  placeholder="z.B. Einlass ab 18:00 Uhr"
                  className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>

              {/* Live Preview of MatchCard info tiles */}
              <div
                className="mt-3 rounded-lg border border-border/80 bg-background/60 p-3"
                data-testid="edit-submission-preview"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Live-Vorschau (MatchCard Kacheln)
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Aktualisiert in Echtzeit
                  </span>
                </div>
                {editFormData.kioskDescription ||
                editFormData.parkingNotes ||
                editFormData.matchNotes ||
                editFormData.admissionFee ||
                editFormData.submitterName ? (
                  <KioskInfoBadges
                    match={{
                      id: editingSubmission.matchId ?? editingSubmission.id,
                      leagueId: editingSubmission.match?.leagueId ?? 0,
                      matchDay: 0,
                      kickoffDate: editingSubmission.match?.kickoffDate ?? null,
                      kickoffTime: editingSubmission.match?.kickoffTime ?? null,
                      homeTeam: {
                        id: 0,
                        dbbId: 0,
                        name: editingSubmission.match?.homeTeam || 'Heimteam',
                      },
                      guestTeam: {
                        id: 0,
                        dbbId: 0,
                        name: editingSubmission.match?.guestTeam || 'Gastteam',
                      },
                      confirmed: true,
                      admissionFee: editFormData.admissionFee || undefined,
                      venue: {
                        id: editingSubmission.venueId ?? 0,
                        name: editingSubmission.venue?.name || 'Halle',
                        street: editingSubmission.venue?.street || '',
                        postalCode: editingSubmission.venue?.postalCode || '',
                        city: editingSubmission.venue?.city || '',
                        latitude: null,
                        longitude: null,
                        kioskDescription:
                          editFormData.kioskDescription || undefined,
                        parkingNotes: editFormData.parkingNotes || undefined,
                      },
                      matchNotes: editFormData.matchNotes || undefined,
                      submitterName: editFormData.submitterName || undefined,
                      submitterRole: editFormData.submitterRole || undefined,
                    }}
                  />
                ) : (
                  <div className="py-2 text-center text-xs italic text-muted-foreground">
                    Keine Kiosk-, Hallen- oder Eintrittsinformationen angegeben.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-border pt-3">
              <Button
                variant="outline"
                size="sm"
                type="button"
                disabled={isSavingEdit}
                onClick={() => setEditingSubmission(null)}
                className="text-xs"
              >
                Abbrechen
              </Button>
              <Button
                variant="default"
                size="sm"
                type="button"
                disabled={isSavingEdit}
                onClick={handleSaveEditSubmission}
                className="gap-1.5 text-xs"
              >
                {isSavingEdit ? (
                  <RefreshCw className="size-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-3.5" />
                )}
                <span>Änderungen speichern</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
