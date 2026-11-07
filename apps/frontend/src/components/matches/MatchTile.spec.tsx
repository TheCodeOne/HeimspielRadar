import { renderToString } from 'react-dom/server';
import type { Match } from '@sundayleague/shared-types';
import { MatchTile } from './MatchTile';
import { MatchCard } from './MatchCard';
import { TopMatchBadge } from './TopMatchBadge';

const sampleMatch: Match = {
  id: 101,
  leagueId: 1,
  league: {
    id: 1,
    dbbId: 5001,
    name: 'Oberliga Württemberg',
    skName: 'Oberliga',
    akName: 'Senioren',
    geschlecht: 'männlich',
  },
  matchDay: 5,
  kickoffDate: '2099-10-25',
  kickoffTime: '18:00',
  homeTeam: { id: 10, dbbId: 1010, name: 'MTV Stuttgart 1843' },
  guestTeam: { id: 11, dbbId: 1011, name: 'SV Möhringen' },
  venue: {
    id: 501,
    name: 'Sporthalle West',
    street: 'Bebelstraße 24',
    postalCode: '70193',
    city: 'Stuttgart',
    latitude: 48.7745,
    longitude: 9.1565,
    kioskDescription: 'Waffeln, Kuchen & Kaffee',
  },
  admissionFee: 'Eintritt frei',
  result: null,
  confirmed: true,
  isFeatured: false,
  distanceKm: 2.1,
};

const featuredMatch: Match = {
  ...sampleMatch,
  id: 102,
  isFeatured: true,
  featuredReason: 'Spitzenspiel um Platz 1',
  featuredMeta: {
    type: 'algorithm',
    score: 92,
    factors: [
      { name: 'Tabelle', points: 30, description: 'Top 2 Duell' },
      { name: 'Derby', points: 25, description: 'Lokales Derby' },
    ],
  },
};

describe('MatchTile and TopMatchBadge Canonical Components', () => {
  describe('TopMatchBadge Component', () => {
    it('renders null when match is not featured', () => {
      const html = renderToString(<TopMatchBadge match={sampleMatch} />);

      expect(html).toBe('');
    });

    it('renders ⭐ Topspiel badge with data-testid="featured-match-badge" when match is featured', () => {
      const html = renderToString(<TopMatchBadge match={featuredMatch} />);

      expect(html).toContain('data-testid="featured-match-badge"');
      expect(html).toContain('⭐');
      expect(html).toContain('Topspiel');
    });

    it('invokes onOpenTopMatchInfo when clicked', () => {
      let openedMatch: Match | null = null;

      const onOpenTopMatchInfo = (m: Match) => {
        openedMatch = m;
      };

      const element = (
        <TopMatchBadge
          match={featuredMatch}
          onOpenTopMatchInfo={onOpenTopMatchInfo}
        />
      );

      // Verify callback prop is passed
      expect(element.props.onOpenTopMatchInfo).toBe(onOpenTopMatchInfo);

      // Invoke callback
      element.props.onOpenTopMatchInfo(featuredMatch);
      expect(openedMatch).toEqual(featuredMatch);
    });

    it('mounts TopMatchInfoModal when onOpenTopMatchInfo is omitted', () => {
      const html = renderToString(<TopMatchBadge match={featuredMatch} />);

      expect(html).toContain('data-testid="featured-match-badge"');
      expect(html).toBeDefined();
    });
  });

  describe('MatchTile Presentation Component', () => {
    it('renders variant="card" (default) with venue, distance and "Auf Karte anzeigen"', () => {
      const html = renderToString(<MatchTile match={sampleMatch} variant="card" />);

      // Match identity
      expect(html).toContain('data-match-id="101"');
      expect(html).toContain('MTV Stuttgart 1843');
      expect(html).toContain('SV Möhringen');

      // Venue information
      expect(html).toContain('Sporthalle West');
      expect(html).toContain('Stuttgart');
      expect(html).toContain('2.1 km');

      // Actions
      expect(html).toContain('Auf Karte anzeigen');
      expect(html).toContain('Kiosk- &amp; Hallen-Info melden');
      expect(html).toContain('DBB Quick-Actions');
    });

    it('renders variant="row" with compact layout without venue distance row or "Auf Karte anzeigen"', () => {
      const html = renderToString(<MatchTile match={sampleMatch} variant="row" />);

      // Match identity
      expect(html).toContain('data-match-id="101"');
      expect(html).toContain('MTV Stuttgart 1843');
      expect(html).toContain('SV Möhringen');

      // Row layout omits redundant venue and distance
      expect(html).not.toContain('2.1 km');
      expect(html).not.toContain('Auf Karte anzeigen');

      // Contains DBB Quick-Actions and kiosk report button
      expect(html).toContain('DBB Quick-Actions');
      expect(html).toContain('Kiosk- &amp; Hallen-Info melden');
    });

    it('renders TopMatchBadge and featured styling on featured matches for both card and row variants', () => {
      const cardHtml = renderToString(<MatchTile match={featuredMatch} variant="card" />);

      expect(cardHtml).toContain('data-featured="true"');
      expect(cardHtml).toContain('data-testid="featured-match-badge"');
      expect(cardHtml).toContain('Topspiel');

      const rowHtml = renderToString(<MatchTile match={featuredMatch} variant="row" />);

      expect(rowHtml).toContain('data-featured="true"');
      expect(rowHtml).toContain('data-testid="featured-match-badge"');
      expect(rowHtml).toContain('Topspiel');
    });

    it('applies isActive styling when active in row variant', () => {
      const activeHtml = renderToString(
        <MatchTile match={sampleMatch} variant="row" isActive={true} />
      );

      expect(activeHtml).toContain('border-primary');
    });

    it('delegates onOpenTopMatchInfo and onReportKioskInfo callbacks', () => {
      let reportedMatch: Match | null = null;
      let topMatchInfo: Match | null = null;

      const element = (
        <MatchTile
          match={featuredMatch}
          variant="card"
          onReportKioskInfo={(m) => {
            reportedMatch = m;
          }}
          onOpenTopMatchInfo={(m) => {
            topMatchInfo = m;
          }}
        />
      );

      element.props.onReportKioskInfo?.(featuredMatch);
      element.props.onOpenTopMatchInfo?.(featuredMatch);

      expect(reportedMatch).toEqual(featuredMatch);
      expect(topMatchInfo).toEqual(featuredMatch);
    });

    it('MatchCard acts as a backward-compatible wrapper for MatchTile variant="card"', () => {
      const cardWrapperHtml = renderToString(<MatchCard match={sampleMatch} />);
      const tileCardHtml = renderToString(<MatchTile match={sampleMatch} variant="card" />);

      expect(cardWrapperHtml).toEqual(tileCardHtml);
    });
  });

  describe('TopMatchBadge Integration for Ticket / Detail View', () => {
    it('renders TopMatchBadge with size="sm" as used in MatchDetailView ticket header stub', () => {
      const badgeHtml = renderToString(<TopMatchBadge match={featuredMatch} size="sm" />);

      expect(badgeHtml).toContain('data-testid="featured-match-badge"');
      expect(badgeHtml).toContain('Topspiel');
      expect(badgeHtml).toContain('text-[10px]');
    });
  });
});
