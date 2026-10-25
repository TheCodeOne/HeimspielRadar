import React, { useRef, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Platform,
  Linking,
  Share,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import BottomSheet, {
  BottomSheetFlatList,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import type { Match } from '@sundayleague/shared-types';
import {
  LocationCoordinates,
  calculateDistanceKm,
  formatKickoffTime,
} from './data';
import {
  TimeIcon,
  NavigateIcon,
  NavigateOutlineIcon,
  CloseIcon,
  BasketballIcon,
  ChevronUpIcon,
  TrophyIcon,
  ShareIcon,
  CalendarIcon,
  FileTextIcon,
} from './Icons';
import { getMatchLinks } from './matchLinks';

export interface MobileBottomSheetProps {
  matches: Match[];
  userLocation: LocationCoordinates | null;
  selectedMatch: Match | null;
  onSelectMatch: (match: Match) => void;
  onClearSelectedMatch: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onSnapChange?: (index: number) => void;
  sheetRef?: React.RefObject<BottomSheet | null>;
}

export const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
  matches,
  userLocation,
  selectedMatch,
  onSelectMatch,
  onClearSelectedMatch,
  onRefresh: _onRefresh,
  isRefreshing = false,
  onSnapChange,
  sheetRef,
}) => {
  const isWeb = Platform.OS === 'web';
  const internalBottomSheetRef = useRef<BottomSheet>(null);
  const bottomSheetRef = sheetRef || internalBottomSheetRef;

  // 3 Snap points: Collapsed peek (80px), Half-screen (48%), Full-screen (90%)
  const snapPoints = useMemo(() => [80, '48%', '90%'], []);

  // Sort matches chronologically by kickoffDate and kickoffTime (Europe/Berlin invariant)
  const sortedMatches = useMemo(() => {
    return [...matches].sort((a, b) => {
      const dateA = a.kickoffDate || '';
      const dateB = b.kickoffDate || '';

      if (dateA !== dateB) {
        return dateA.localeCompare(dateB);
      }

      const timeA = a.kickoffTime || '99:99';
      const timeB = b.kickoffTime || '99:99';

      return timeA.localeCompare(timeB);
    });
  }, [matches]);

  // Nearest match for the peek header
  const nearestMatch = useMemo(() => {
    if (!userLocation || sortedMatches.length === 0) {
      return sortedMatches[0] || null;
    }

    let nearest = sortedMatches[0];
    let minDistance = Infinity;

    for (const match of sortedMatches) {
      if (match.venue?.latitude && match.venue?.longitude) {
        const d = calculateDistanceKm(
          userLocation.latitude,
          userLocation.longitude,
          match.venue.latitude,
          match.venue.longitude,
        );

        if (d < minDistance) {
          minDistance = d;
          nearest = match;
        }
      }
    }

    return nearest;
  }, [sortedMatches, userLocation]);

  // Distance for selected match
  const selectedMatchDistance = useMemo(() => {
    if (
      !selectedMatch?.venue?.latitude ||
      !selectedMatch?.venue?.longitude ||
      !userLocation
    ) {
      return undefined;
    }

    return calculateDistanceKm(
      userLocation.latitude,
      userLocation.longitude,
      selectedMatch.venue.latitude,
      selectedMatch.venue.longitude,
    );
  }, [selectedMatch, userLocation]);

  // When selectedMatch changes:
  // If selected -> snap to Full-screen (index 2)
  useEffect(() => {
    if (selectedMatch) {
      bottomSheetRef.current?.snapToIndex(2);
    }
  }, [selectedMatch, bottomSheetRef]);

  const handleSnapChange = useCallback(
    (index: number) => {
      onSnapChange?.(index);

      // If user snaps down to peek while a match was selected, reset selection
      if (index === 0 && selectedMatch) {
        onClearSelectedMatch();
      }
    },
    [selectedMatch, onClearSelectedMatch, onSnapChange],
  );

  const handleSelectMatchItem = useCallback(
    (match: Match) => {
      if (!isWeb) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }

      onSelectMatch(match);
      bottomSheetRef.current?.snapToIndex(2);
    },
    [isWeb, onSelectMatch, bottomSheetRef],
  );

  const handleCloseDetail = useCallback(() => {
    if (!isWeb) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    onClearSelectedMatch();
    bottomSheetRef.current?.snapToIndex(1); // Return to half-screen match list
  }, [isWeb, onClearSelectedMatch, bottomSheetRef]);

  const handleOpenNavigation = useCallback((match: Match) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    const lat = match.venue?.latitude;
    const lng = match.venue?.longitude;
    const venueName = match.venue?.name || 'Basketball Spiel';
    const label = encodeURIComponent(venueName);

    const venueAddress = [
      match.venue?.street,
      match.venue?.postalCode,
      match.venue?.city,
    ]
      .filter(Boolean)
      .join(' ');

    if (lat && lng) {
      if (Platform.OS === 'ios') {
        const appleMapsUrl = `maps://?q=${label}&ll=${lat},${lng}`;

        Linking.canOpenURL(appleMapsUrl).then((supported) => {
          if (supported) {
            Linking.openURL(appleMapsUrl);
          } else {
            Linking.openURL(
              `https://maps.apple.com/?q=${label}&ll=${lat},${lng}`,
            );
          }
        });
      } else {
        const googleMapsUrl = `geo:${lat},${lng}?q=${lat},${lng}(${label})`;

        Linking.canOpenURL(googleMapsUrl).then((supported) => {
          if (supported) {
            Linking.openURL(googleMapsUrl);
          } else {
            Linking.openURL(
              `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
            );
          }
        });
      }
    } else if (venueAddress) {
      const encodedAddress = encodeURIComponent(venueAddress);

      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`,
      );
    }
  }, []);

  const handleShareMatch = useCallback((match: Match) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    const homeName = match.homeTeam?.name ?? 'Heim';
    const guestName = match.guestTeam?.name ?? 'Gast';
    const timeFormatted = formatKickoffTime(match.kickoffTime);
    const dateFormatted = match.kickoffDate ?? '';
    const venueName = match.venue?.name ?? 'Sporthalle';

    const venueAddress = [
      match.venue?.street,
      match.venue?.postalCode,
      match.venue?.city,
    ]
      .filter(Boolean)
      .join(' ');

    const shareMessage = [
      `🏀 HeimspielRadar: ${homeName} vs. ${guestName}`,
      `📅 Datum: ${dateFormatted} um ${timeFormatted}`,
      `📍 Halle: ${venueName}${venueAddress ? ` (${venueAddress})` : ''}`,
      `🔗 Spielbericht: https://www.basketball-bund.net/static/#/spiel/${match.id}`,
    ].join('\n');

    Share.share({
      title: `${homeName} vs. ${guestName}`,
      message: shareMessage,
    }).catch(() => {});
  }, []);

  const handleOpenCalendar = useCallback((match: Match) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    const homeName = match.homeTeam?.name ?? 'Heim';
    const guestName = match.guestTeam?.name ?? 'Gast';
    const title = encodeURIComponent(`Basketball: ${homeName} vs. ${guestName}`);
    const venueName = match.venue?.name ?? '';

    const venueAddress = [
      match.venue?.street,
      match.venue?.postalCode,
      match.venue?.city,
    ]
      .filter(Boolean)
      .join(' ');

    const locationStr = encodeURIComponent(
      venueAddress ? `${venueName}, ${venueAddress}` : venueName,
    );

    const dateStr = match.kickoffDate?.replace(/-/g, '') ?? '';
    const timeStr = (match.kickoffTime ?? '18:00').replace(':', '') + '00';
    const dates = `${dateStr}T${timeStr}/${dateStr}T${timeStr}`;

    const googleCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&location=${locationStr}&dates=${dates}`;

    Linking.openURL(googleCalUrl).catch(() => {});
  }, []);

  const handleOpenUrl = useCallback((url: string | null) => {
    if (!url) {
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    Linking.openURL(url).catch(() => {});
  }, []);

  // Web Fallback: Render a lightweight panel overlay
  if (isWeb) {
    if (selectedMatch) {
      const homeName = selectedMatch.homeTeam?.name ?? 'Heim';
      const guestName = selectedMatch.guestTeam?.name ?? 'Gast';
      const venueName = selectedMatch.venue?.name ?? 'Unbekannte Spielstätte';
      const matchLinks = getMatchLinks(selectedMatch);

      const venueAddress = [
        selectedMatch.venue?.street,
        selectedMatch.venue?.postalCode,
        selectedMatch.venue?.city,
      ]
        .filter(Boolean)
        .join(' ');

      return (
        <View style={styles.webContainer}>
          <View style={styles.detailContainer}>
            <View style={styles.detailHeader}>
              <View style={styles.kickoffChip}>
                <TimeIcon size={13} color="#0284c7" />
                <Text style={styles.kickoffText}>
                  {formatKickoffTime(selectedMatch.kickoffTime)}
                </Text>
              </View>

              {selectedMatchDistance !== undefined && (
                <View style={styles.distanceBadge}>
                  <NavigateOutlineIcon size={12} color="#64748b" />
                  <Text style={styles.distanceText}>
                    {selectedMatchDistance.toFixed(1)} km
                  </Text>
                </View>
              )}

              <Pressable
                onPress={handleCloseDetail}
                accessibilityLabel="Zurück zur Liste"
                accessibilityRole="button"
                style={styles.closeBtn}
              >
                <CloseIcon size={16} color="#64748b" />
              </Pressable>
            </View>

            <View style={styles.detailMatchup}>
              <Text style={styles.detailTeamHome}>{homeName}</Text>
              <Text style={styles.detailVs}>VS.</Text>
              <Text style={styles.detailTeamGuest}>{guestName}</Text>
            </View>

            <View style={styles.detailVenueSection}>
              <Text style={styles.venueSectionTitle}>SPIELORT & HALLE</Text>
              <Text style={styles.detailVenueName}>{venueName}</Text>
              {venueAddress.length > 0 && (
                <Text style={styles.detailVenueAddress}>{venueAddress}</Text>
              )}

              {/* Action Buttons: Primary Navigation */}
              <Pressable
                onPress={() => handleOpenNavigation(selectedMatch)}
                style={styles.navButton}
                accessibilityRole="button"
                accessibilityLabel="Navigation starten"
              >
                <NavigateIcon size={14} color="#ffffff" />
                <Text style={styles.navButtonText}>Route starten</Text>
              </Pressable>

              {/* Quick Actions Grid: Teilen, Kalender, DBB Spielinfo, Tabelle */}
              <View style={styles.actionButtonsGrid}>
                <Pressable
                  onPress={() => handleShareMatch(selectedMatch)}
                  style={styles.actionSecondaryBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Spiel teilen"
                >
                  <ShareIcon size={15} color="#0284c7" />
                  <Text style={styles.actionSecondaryText}>Teilen</Text>
                </Pressable>

                <Pressable
                  onPress={() => handleOpenCalendar(selectedMatch)}
                  style={styles.actionSecondaryBtn}
                  accessibilityRole="button"
                  accessibilityLabel="In Kalender eintragen"
                >
                  <CalendarIcon size={15} color="#0284c7" />
                  <Text style={styles.actionSecondaryText}>Kalender</Text>
                </Pressable>

                <Pressable
                  onPress={() => handleOpenUrl(matchLinks.dbbMatchInfoUrl)}
                  style={styles.actionSecondaryBtn}
                  accessibilityRole="button"
                  accessibilityLabel="DBB Spielbericht öffnen"
                >
                  <FileTextIcon size={15} color="#0284c7" />
                  <Text style={styles.actionSecondaryText}>Spielbericht</Text>
                </Pressable>

                {matchLinks.dbbStandingsUrl && (
                  <Pressable
                    onPress={() => handleOpenUrl(matchLinks.dbbStandingsUrl)}
                    style={styles.actionSecondaryBtn}
                    accessibilityRole="button"
                    accessibilityLabel="DBB Ligatabelle öffnen"
                  >
                    <TrophyIcon size={15} color="#0284c7" />
                    <Text style={styles.actionSecondaryText}>Tabelle</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.webContainer}>
        <View style={styles.peekHeader}>
          <Text style={styles.peekTitle}>
            {sortedMatches.length}{' '}
            {sortedMatches.length === 1 ? 'Spiel' : 'Spiele'} in Reichweite
          </Text>

          {nearestMatch && (
            <Text style={styles.peekSubtitle} numberOfLines={1}>
              Nächstes: {nearestMatch.homeTeam?.name ?? 'Heim'} (
              {formatKickoffTime(nearestMatch.kickoffTime)})
            </Text>
          )}
        </View>
      </View>
    );
  }

  // Native gorhom bottom sheet rendering
  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      index={0}
      onChange={handleSnapChange}
      enablePanDownToClose={false}
      style={styles.sheetShadow}
      containerStyle={styles.sheetContainer}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.sheetIndicator}
    >
      {selectedMatch ? (
        <BottomSheetView style={styles.detailContainer}>
          {/* Detail View Header */}
          <View style={styles.detailHeader}>
            <View style={styles.metaRow}>
              <View style={styles.kickoffChip}>
                <TimeIcon size={13} color="#0284c7" />
                <Text style={styles.kickoffText}>
                  {formatKickoffTime(selectedMatch.kickoffTime)}
                </Text>
              </View>

              {selectedMatchDistance !== undefined && (
                <View style={styles.distanceBadge}>
                  <NavigateOutlineIcon size={12} color="#64748b" />
                  <Text style={styles.distanceText}>
                    {selectedMatchDistance.toFixed(1)} km
                  </Text>
                </View>
              )}
            </View>

            <Pressable
              onPress={handleCloseDetail}
              accessibilityLabel="Zurück zur Liste"
              accessibilityRole="button"
              hitSlop={12}
              style={({ pressed }) => [
                styles.closeBtn,
                pressed && styles.pressed,
              ]}
            >
              <CloseIcon size={16} color="#64748b" />
            </Pressable>
          </View>

          {/* Teams Matchup */}
          <View style={styles.detailMatchup}>
            <Text style={styles.detailTeamHome} numberOfLines={2}>
              {selectedMatch.homeTeam?.name ?? 'Heim'}
            </Text>

            <View style={styles.vsBadge}>
              <Text style={styles.detailVs}>VS.</Text>
            </View>

            <Text style={styles.detailTeamGuest} numberOfLines={2}>
              {selectedMatch.guestTeam?.name ?? 'Gast'}
            </Text>
          </View>

          {/* League & Matchday Info */}
          <View style={styles.leagueRow}>
            <TrophyIcon size={15} color="#d97706" />
            <Text style={styles.leagueText}>
              Spieltag {selectedMatch.matchDay ?? '-'} •{' '}
              {selectedMatch.confirmed ? 'Bestätigt' : 'Vorläufig'}
            </Text>
          </View>

          {/* Venue & Facilities Section */}
          <View style={styles.detailVenueSection}>
            <Text style={styles.venueSectionTitle}>SPIELORT & HALLE</Text>
            <Text style={styles.detailVenueName}>
              {selectedMatch.venue?.name ?? 'Spielort unbekannt'}
            </Text>

            {[
              selectedMatch.venue?.street,
              selectedMatch.venue?.postalCode,
              selectedMatch.venue?.city,
            ].filter(Boolean).length > 0 && (
              <Text style={styles.detailVenueAddress}>
                {[
                  selectedMatch.venue?.street,
                  selectedMatch.venue?.postalCode,
                  selectedMatch.venue?.city,
                ]
                  .filter(Boolean)
                  .join(' ')}
              </Text>
            )}

            {/* 1-Tap Navigation Action */}
            <Pressable
              onPress={() => handleOpenNavigation(selectedMatch)}
              accessibilityRole="button"
              accessibilityLabel="Navigation zu dieser Halle starten"
              style={({ pressed }) => [
                styles.navButton,
                pressed && styles.navButtonPressed,
              ]}
            >
              <NavigateIcon size={15} color="#ffffff" />
              <Text style={styles.navButtonText}>Route starten (Maps)</Text>
            </Pressable>

            {/* Quick Actions Grid: Teilen, Kalender, DBB Spielinfo, Tabelle */}
            <View style={styles.actionButtonsGrid}>
              <Pressable
                onPress={() => handleShareMatch(selectedMatch)}
                style={({ pressed }) => [
                  styles.actionSecondaryBtn,
                  pressed && styles.actionSecondaryBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Spiel teilen"
              >
                <ShareIcon size={15} color="#0284c7" />
                <Text style={styles.actionSecondaryText}>Teilen</Text>
              </Pressable>

              <Pressable
                onPress={() => handleOpenCalendar(selectedMatch)}
                style={({ pressed }) => [
                  styles.actionSecondaryBtn,
                  pressed && styles.actionSecondaryBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="In Kalender eintragen"
              >
                <CalendarIcon size={15} color="#0284c7" />
                <Text style={styles.actionSecondaryText}>Kalender</Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  handleOpenUrl(
                    getMatchLinks(selectedMatch).dbbMatchInfoUrl,
                  )
                }
                style={({ pressed }) => [
                  styles.actionSecondaryBtn,
                  pressed && styles.actionSecondaryBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="DBB Spielbericht öffnen"
              >
                <FileTextIcon size={15} color="#0284c7" />
                <Text style={styles.actionSecondaryText}>Spielbericht</Text>
              </Pressable>

              {getMatchLinks(selectedMatch).dbbStandingsUrl && (
                <Pressable
                  onPress={() =>
                    handleOpenUrl(
                      getMatchLinks(selectedMatch).dbbStandingsUrl,
                    )
                  }
                  style={({ pressed }) => [
                    styles.actionSecondaryBtn,
                    pressed && styles.actionSecondaryBtnPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="DBB Ligatabelle öffnen"
                >
                  <TrophyIcon size={15} color="#0284c7" />
                  <Text style={styles.actionSecondaryText}>Tabelle</Text>
                </Pressable>
              )}
            </View>
          </View>
        </BottomSheetView>
      ) : (
        <View style={styles.sheetContent}>
          {/* Peek Header */}
          <Pressable
            onPress={() => bottomSheetRef.current?.snapToIndex(1)}
            style={styles.peekHeader}
          >
            <View style={styles.peekLeft}>
              <View style={styles.peekIcon}>
                <BasketballIcon size={16} color="#0284c7" />
              </View>

              <View>
                <Text style={styles.peekTitle}>
                  {sortedMatches.length}{' '}
                  {sortedMatches.length === 1 ? 'Spiel' : 'Spiele'} in
                  Reichweite
                </Text>

                {nearestMatch && (
                  <Text style={styles.peekSubtitle} numberOfLines={1}>
                    Nächstes: {nearestMatch.homeTeam?.name ?? 'Heim'} (
                    {formatKickoffTime(nearestMatch.kickoffTime)})
                  </Text>
                )}
              </View>
            </View>

            <ChevronUpIcon size={20} color="#94a3b8" />
          </Pressable>

          {/* Chronological Scrollable Match List without aggressive pull-to-refresh so downward swipe drags sheet smoothly */}
          <BottomSheetFlatList
            data={sortedMatches}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const dist =
                item.venue?.latitude && item.venue?.longitude && userLocation
                  ? calculateDistanceKm(
                      userLocation.latitude,
                      userLocation.longitude,
                      item.venue.latitude,
                      item.venue.longitude,
                    )
                  : undefined;

              return (
                <Pressable
                  onPress={() => handleSelectMatchItem(item)}
                  style={({ pressed }) => [
                    styles.matchCard,
                    pressed && styles.matchCardPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.homeTeam?.name ?? 'Heim'} gegen ${item.guestTeam?.name ?? 'Gast'}`}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.timeBadge}>
                      <TimeIcon size={11} color="#0284c7" />
                      <Text style={styles.timeBadgeText}>
                        {formatKickoffTime(item.kickoffTime)}
                      </Text>
                    </View>

                    {dist !== undefined && (
                      <View style={styles.distanceBadgeCompact}>
                        <NavigateOutlineIcon size={11} color="#64748b" />
                        <Text style={styles.distanceBadgeCompactText}>
                          {dist.toFixed(1)} km
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.cardTeams}>
                    <Text style={styles.teamText} numberOfLines={1}>
                      {item.homeTeam?.name ?? 'Heim'}
                    </Text>

                    <Text style={styles.cardVs}>vs.</Text>

                    <Text style={styles.teamText} numberOfLines={1}>
                      {item.guestTeam?.name ?? 'Gast'}
                    </Text>
                  </View>

                  <View style={styles.cardVenue}>
                    <Text style={styles.cardVenueText} numberOfLines={1}>
                      {item.venue?.name ?? 'Spielstätte unbekannt'}
                    </Text>
                  </View>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                {isRefreshing ? (
                  <ActivityIndicator size="small" color="#0284c7" />
                ) : (
                  <Text style={styles.emptyText}>
                    Keine Spiele im gewählten Umkreis gefunden.
                  </Text>
                )}
              </View>
            }
          />
        </View>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  sheetContainer: {
    zIndex: 50,
    elevation: 25,
  },
  sheetShadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 25,
  },
  sheetBackground: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetIndicator: {
    backgroundColor: '#cbd5e1',
    width: 38,
    height: 4,
    borderRadius: 2,
  },
  sheetContent: {
    flex: 1,
  },
  peekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  peekLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  peekIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f9ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e0f2fe',
  },
  peekTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  peekSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 10,
  },
  matchCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  matchCardPressed: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(2, 132, 199, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  timeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  distanceBadgeCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  distanceBadgeCompactText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  cardTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  teamText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    flex: 1,
  },
  cardVs: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  cardVenue: {
    paddingTop: 4,
  },
  cardVenueText: {
    fontSize: 12,
    color: '#64748b',
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
  },
  detailContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 30,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kickoffChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  kickoffText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  detailMatchup: {
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 12,
  },
  detailTeamHome: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  vsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    marginVertical: 4,
  },
  detailVs: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
  },
  detailTeamGuest: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  leagueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  leagueText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
  },
  detailVenueSection: {
    paddingTop: 8,
  },
  venueSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailVenueName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  detailVenueAddress: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 16,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  navButtonPressed: {
    backgroundColor: '#0369a1',
    transform: [{ scale: 0.98 }],
  },
  navButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  actionButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  actionSecondaryBtn: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingVertical: 12,
    borderRadius: 14,
  },
  actionSecondaryBtnPressed: {
    backgroundColor: '#e0f2fe',
    transform: [{ scale: 0.98 }],
  },
  actionSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0284c7',
  },
  webContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 50,
  },
});
