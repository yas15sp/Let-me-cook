import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, spacing, typography, borders } from '../theme';
import { getEvents, getEventEntries, awardEventWinner, voteCook, unvoteCook, timeAgo } from '../lib/api';
import VoteNotifBell from '../components/VoteNotifBell';
import ActiveDuelBanner from '../components/ActiveDuelBanner';

const { width: W, height: H } = Dimensions.get('window');
const CARD_HEIGHT = H * 0.66;

const RANK_COLORS = {
  'Gold Cook':        '#FFB800',
  'Emerald Cook':     '#00C47A',
  'Diamond Cook':     '#88CCFF',
  'Chef':             '#E8001C',
  'Exec Chef':        '#A855F7',
  'Master Chef':      '#FF6B00',
  'World Class Chef': '#FFFFFF',
};

// ─── Countdown ────────────────────────────────────────────────────────────────

function useCountdown(targetMs) {
  const calc = useCallback(() => {
    const diff = Math.max(0, (targetMs ?? 0) - Date.now());
    return {
      h: Math.floor(diff / 3600000),
      m: Math.floor((diff % 3600000) / 60000),
      s: Math.floor((diff % 60000) / 1000),
    };
  }, [targetMs]);
  const [t, setT] = useState(calc);
  useEffect(() => {
    setT(calc());
    const id = setInterval(() => setT(calc()), 1000);
    return () => clearInterval(id);
  }, [calc]);
  return t;
}

function pad(n) { return String(n).padStart(2, '0'); }

function classifyEvents(events) {
  const now = Date.now();
  const live = [], upcoming = [], past = [];
  for (const e of events) {
    const startsAt = new Date(e.starts_at).getTime();
    const endsAt = new Date(e.ends_at).getTime();
    if (endsAt < now) {
      const winner = e.winner_cook
        ? { dishName: e.winner_cook.dish_name, username: e.winner_cook.profiles?.username, rank: e.winner_cook.profiles?.rank }
        : null;
      past.push({ ...e, winner, endedAgo: timeAgo(e.ends_at) });
    } else if (startsAt > now) {
      upcoming.push({ ...e, startsIn: startsAt - now });
    } else {
      live.push({ ...e, endsAt });
    }
  }
  return { live, upcoming, past };
}

// ─── Event header (live event + rules + enter) ────────────────────────────────

function EventHeader({ event, entryCount, onEnter, hasEntered }) {
  const { h, m, s } = useCountdown(event.endsAt);
  const urgent = h === 0 && m < 60;
  const pulse = useRef(new Animated.Value(1)).current;
  const rankColor = RANK_COLORS[event.min_rank] ?? null;

  useEffect(() => {
    if (!urgent) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.05, duration: 500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [urgent]);

  return (
    <View style={styles.eventHeader}>
      {/* Tag row */}
      <View style={styles.eventTagRow}>
        <View style={styles.liveTag}>
          <View style={styles.liveDot} />
          <Text style={styles.liveTagText}>LIVE</Text>
        </View>
        <Text style={styles.entryCount}>{entryCount} {entryCount === 1 ? 'ENTRY' : 'ENTRIES'}</Text>
        {rankColor && (
          <View style={[styles.rankGate, { borderColor: rankColor }]}>
            <Text style={[styles.rankGateText, { color: rankColor }]}>{event.min_rank}+</Text>
          </View>
        )}
      </View>

      {/* Title */}
      <Text style={styles.eventTitle}>{event.title}</Text>
      {event.subtitle ? <Text style={styles.eventSubtitle}>{event.subtitle}</Text> : null}

      {/* XP reward */}
      <View style={styles.eventXpRow}>
        <View style={styles.xpBadge}>
          <Ionicons name="star" size={11} color={colors.background} />
          <Text style={styles.xpBadgeText}>+{event.xp_reward} XP</Text>
        </View>
        {event.prize_label ? <Text style={styles.prizeLabel}>{event.prize_label}</Text> : null}
      </View>

      {/* Countdown */}
      <View style={[styles.countdown, urgent && styles.countdownUrgent]}>
        <Text style={[styles.countdownLabel, urgent && { color: colors.primary }]}>ENDS IN</Text>
        <Animated.Text style={[styles.countdownValue, urgent && { color: colors.primary, transform: [{ scale: pulse }] }]}>
          {h > 0 ? `${h}h ${pad(m)}m` : `${pad(m)}m ${pad(s)}s`}
        </Animated.Text>
      </View>

      {/* Rules */}
      <View style={styles.rulesCard}>
        <View style={styles.rulesHeader}>
          <Ionicons name="trophy" size={11} color={colors.gold} />
          <Text style={styles.rulesTitle}>HOW TO WIN</Text>
        </View>
        <View style={styles.ruleRow}>
          <View style={styles.ruleBullet}><Text style={styles.ruleBulletText}>1</Text></View>
          <Text style={styles.ruleText}>Cook something that fits the theme and submit your best cook</Text>
        </View>
        <View style={styles.ruleRow}>
          <View style={styles.ruleBullet}><Text style={styles.ruleBulletText}>2</Text></View>
          <Text style={styles.ruleText}>Get votes from the community — the most voted cook wins</Text>
        </View>
        <View style={styles.ruleRow}>
          <View style={styles.ruleBullet}><Text style={styles.ruleBulletText}>3</Text></View>
          <Text style={styles.ruleText}>Winner is decided when the timer hits zero{rankColor ? ` · ${event.min_rank}+ only` : ''}</Text>
        </View>
      </View>

      {/* Enter button */}
      {hasEntered ? (
        <View style={styles.youCookedBanner}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={styles.youCookedText}>YOU COOKED!</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.enterBtn} onPress={onEnter} activeOpacity={0.85}>
          <Ionicons name="flame" size={18} color={colors.white} />
          <Text style={styles.enterBtnText}>ENTER NOW</Text>
        </TouchableOpacity>
      )}

      {/* Entries heading */}
      {entryCount > 0 && (
        <View style={styles.entriesHeading}>
          <Text style={styles.entriesHeadingText}>ENTRIES</Text>
          <View style={styles.entriesHeadingLine} />
          <Text style={styles.entriesHeadingNote}>sorted by votes · winner gets trophy</Text>
        </View>
      )}
    </View>
  );
}

// ─── Feed-style entry card ────────────────────────────────────────────────────

function EntryCard({ entry, position, userId }) {
  const navigation = useNavigation();
  const profile = entry.profiles || {};
  const rankColor = RANK_COLORS[profile.rank] || colors.accent;
  const isLeading = position === 0;
  const photo = entry.photo_urls?.[entry.photo_urls.length - 1] ?? null;
  const [voted, setVoted] = useState(false);
  const [voteCount, setVoteCount] = useState(entry.votes?.length ?? 0);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!userId) return;
    setVoted((entry.votes || []).some(v => v.user_id === userId));
  }, [userId]);

  async function handleVote() {
    if (!userId) return;
    const next = !voted;
    setVoted(next);
    setVoteCount(c => c + (next ? 1 : -1));
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.35, duration: 120, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    try {
      if (next) await voteCook(entry.id, userId);
      else await unvoteCook(entry.id, userId);
    } catch {
      setVoted(!next);
      setVoteCount(c => c + (next ? -1 : 1));
    }
  }

  return (
    <TouchableOpacity
      style={[styles.entryCard, { height: CARD_HEIGHT }, isLeading && styles.entryCardLeading]}
      onPress={() => navigation.push('PostDetail', { cookId: entry.id })}
      activeOpacity={0.95}
    >
      {/* Photo */}
      <View style={StyleSheet.absoluteFill}>
        {photo ? (
          <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.entryPlaceholder]}>
            <Ionicons name="restaurant" size={48} color="#1a1a1a" />
          </View>
        )}
      </View>

      {/* Leading overlay stripe */}
      {isLeading && <View style={styles.leadingStripe} />}

      {/* Position badge */}
      <View style={[styles.posBadge, isLeading && styles.posBadgeLeading]}>
        {isLeading
          ? <Ionicons name="trophy" size={12} color={colors.background} />
          : <Text style={styles.posBadgeText}>#{position + 1}</Text>
        }
      </View>

      {/* Right-side actions */}
      <View style={styles.cardActions}>
        <TouchableOpacity onPress={handleVote} activeOpacity={0.8}>
          <Animated.View style={[styles.voteBtn, voted && styles.voteBtnActive, { transform: [{ scale: scaleAnim }] }]}>
            <Ionicons
              name={voted ? 'flame' : 'flame-outline'}
              size={26}
              color={voted ? colors.white : isLeading ? colors.gold : colors.primary}
            />
          </Animated.View>
        </TouchableOpacity>
        <Text style={[styles.voteCount, voted && { color: colors.primary }, isLeading && !voted && { color: colors.gold }]}>
          {voteCount.toLocaleString()}
        </Text>
      </View>

      {/* Bottom overlay */}
      <View style={styles.cardOverlay}>
        <Text style={styles.cardDish} numberOfLines={1}>{entry.dish_name}</Text>
        <View style={styles.cardUserRow}>
          <View style={[styles.rankTierDot, { backgroundColor: rankColor }]}>
            <Text style={styles.rankTierDotText}>{profile.rank_tier ?? 'I'}</Text>
          </View>
          <Text style={styles.cardUsername}>@{profile.username}</Text>
          <View style={[styles.rankChip, { borderColor: rankColor }]}>
            <Text style={[styles.rankChipText, { color: rankColor }]}>{profile.rank}</Text>
          </View>
          <Text style={styles.cardTime}>{timeAgo(entry.created_at)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Upcoming card ────────────────────────────────────────────────────────────

function UpcomingCard({ event }) {
  const rankColor = RANK_COLORS[event.min_rank] ?? null;
  const h = Math.floor(event.startsIn / 3600000);
  const d = Math.floor(h / 24);
  const startsIn = d > 0 ? `${d}d` : `${h}h`;
  return (
    <View style={styles.upcomingCard}>
      <View style={styles.upcomingTopRow}>
        <View style={styles.upcomingTag}>
          <Text style={styles.upcomingTagText}>SOON</Text>
        </View>
        <Text style={styles.upcomingStartsIn}>Starts in {startsIn}</Text>
        {rankColor && (
          <View style={[styles.rankGate, { borderColor: rankColor }]}>
            <Text style={[styles.rankGateText, { color: rankColor }]}>{event.min_rank}+</Text>
          </View>
        )}
      </View>
      <Text style={styles.upcomingTitle}>{event.title}</Text>
      {event.subtitle ? <Text style={styles.upcomingSubtitle}>{event.subtitle}</Text> : null}
      <View style={styles.upcomingFooter}>
        <View style={styles.xpBadgeSmall}>
          <Text style={styles.xpBadgeSmallText}>+{event.xp_reward} XP</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Past card ────────────────────────────────────────────────────────────────

function PastCard({ event }) {
  const winnerRankColor = RANK_COLORS[event.winner?.rank] ?? colors.inactive;
  return (
    <View style={styles.pastCard}>
      <View style={styles.pastTopRow}>
        <Text style={styles.pastTitle} numberOfLines={1}>{event.title}</Text>
        <Text style={styles.pastEnded}>{event.endedAgo}</Text>
      </View>
      {event.winner ? (
        <View style={styles.pastWinner}>
          <Ionicons name="trophy" size={11} color={colors.gold} />
          <Text style={styles.pastWinnerDish} numberOfLines={1}>{event.winner.dishName}</Text>
          <Text style={styles.pastWinnerBy}>by</Text>
          <Text style={[styles.pastWinnerUser, { color: winnerRankColor }]}>@{event.winner.username}</Text>
        </View>
      ) : (
        <Text style={styles.pastNoWinner}>no winner awarded</Text>
      )}
    </View>
  );
}

// ─── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

// ─── No event state ───────────────────────────────────────────────────────────

function NoEventState({ upcoming, past, onEnterUpcoming }) {
  return (
    <View style={styles.noEventWrap}>
      <View style={styles.noEventIcon}>
        <Ionicons name="trophy-outline" size={32} color={colors.border} />
      </View>
      <Text style={styles.noEventTitle}>NO LIVE EVENT</Text>
      <Text style={styles.noEventSub}>Check back soon for the next competition</Text>

      {upcoming.length > 0 && (
        <>
          <SectionHeader title="COMING UP" />
          {upcoming.map(e => <UpcomingCard key={e.id} event={e} />)}
        </>
      )}
      {past.length > 0 && (
        <>
          <SectionHeader title="RECENTLY ENDED" />
          {past.map(e => <PastCard key={e.id} event={e} />)}
        </>
      )}
    </View>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function EventsScreen() {
  const navigation = useNavigation();
  const [live, setLive] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [past, setPast] = useState([]);
  const [entries, setEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [loadingEvents, setLoadingEvents] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUserId(session.user.id);
    });
  }, []);

  const loadEvents = useCallback(() => {
    getEvents().then(data => {
      const { live: l, upcoming: u, past: p } = classifyEvents(data);
      setLive(l);
      setUpcoming(u);
      setPast(p);
      setLoadingEvents(false);
      p.forEach(e => { if (!e.winner_awarded) awardEventWinner(e.id).catch(() => {}); });
    }).catch(() => setLoadingEvents(false));
  }, []);

  useFocusEffect(loadEvents);

  const featured = live[0] ?? null;

  useEffect(() => {
    if (!featured) { setEntries([]); return; }
    setEntriesLoading(true);
    getEventEntries(featured.id)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setEntriesLoading(false));
  }, [featured?.id]);

  function handleEnter() {
    if (!featured) return;
    navigation.navigate('Cook', {
      eventId: featured.id,
      eventTitle: featured.title,
      eventXpReward: featured.xp_reward,
    });
  }

  // FlatList data: entries only; header is ListHeaderComponent
  const listData = useMemo(() => entries, [entries]);

  const hasEntered = useMemo(
    () => !!userId && entries.some(e => e.profiles?.id === userId),
    [entries, userId]
  );

  const renderHeader = useMemo(() => {
    if (!featured) return null;
    return (
      <>
        <EventHeader event={featured} entryCount={entries.length} onEnter={handleEnter} hasEntered={hasEntered} />
        {entriesLoading && (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
        )}
        {!entriesLoading && entries.length === 0 && (
          <View style={styles.noEntriesWrap}>
            <Text style={styles.noEntriesText}>NO ENTRIES YET — BE FIRST</Text>
          </View>
        )}
      </>
    );
  }, [featured, entries.length, entriesLoading, hasEntered]);

  const renderFooter = useMemo(() => (
    <View style={styles.footerSection}>
      {upcoming.length > 0 && (
        <>
          <SectionHeader title="COMING UP" />
          {upcoming.map(e => <UpcomingCard key={e.id} event={e} />)}
        </>
      )}
      {past.length > 0 && (
        <>
          <SectionHeader title="RECENTLY ENDED" />
          {past.map(e => <PastCard key={e.id} event={e} />)}
        </>
      )}
      <View style={{ height: spacing.xxl }} />
    </View>
  ), [upcoming, past]);

  return (
    <View style={styles.root}>
      {/* Top bar */}
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.topBar}>
          <Text style={styles.topBarTitle}>Events</Text>
          <View style={styles.topBarRight}>
            {featured && (
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.livePillText}>LIVE</Text>
              </View>
            )}
            <VoteNotifBell />
          </View>
        </View>
      </SafeAreaView>
      <ActiveDuelBanner />

      {loadingEvents ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : !featured ? (
        <FlatList
          data={[]}
          ListHeaderComponent={
            <NoEventState upcoming={upcoming} past={past} />
          }
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={listData}
          keyExtractor={item => item.id}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <EntryCard
              entry={item}
              position={index}
              userId={userId}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
        />
      )}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safeTop: { backgroundColor: colors.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  topBar: {
    backgroundColor: colors.primary,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: borders.medium,
    borderBottomColor: '#000',
  },
  topBarTitle: {
    color: colors.white,
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.black,
    letterSpacing: typography.letterSpacing.wide,
    textTransform: 'uppercase',
  },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  livePill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#000', paddingHorizontal: spacing.sm, paddingVertical: 4, gap: 5,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  livePillText: {
    color: colors.white, fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider,
  },

  scrollContent: { paddingBottom: spacing.lg },

  // ── Event header ──────────────────────────────────────────────────────────
  eventHeader: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: 0,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
    marginBottom: spacing.xs,
  },
  eventTagRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  liveTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  liveTagText: { color: colors.white, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  entryCount: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold, flex: 1 },
  rankGate: {
    borderWidth: borders.thin,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  rankGateText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wide },

  eventTitle: {
    color: colors.accent,
    fontSize: typography.fontSize.display,
    fontWeight: typography.fontWeight.black,
    letterSpacing: typography.letterSpacing.tight,
    lineHeight: 38,
    marginBottom: 4,
  },
  eventSubtitle: {
    color: colors.inactive, fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold, marginBottom: spacing.md,
  },

  eventXpRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  xpBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.success, paddingHorizontal: spacing.sm, paddingVertical: 4,
  },
  xpBadgeText: { color: colors.background, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wide },
  prizeLabel: { color: colors.inactive, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },

  countdown: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: borders.thin, borderColor: colors.border,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  countdownUrgent: { borderColor: colors.primary, backgroundColor: '#1a0000' },
  countdownLabel: {
    color: colors.inactive, fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider,
  },
  countdownValue: {
    color: colors.white, fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.black, letterSpacing: 2, fontVariant: ['tabular-nums'],
  },

  rulesCard: {
    borderWidth: borders.thin, borderColor: '#1f1f1f',
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  rulesHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderBottomWidth: borders.thin, borderBottomColor: '#1f1f1f',
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    backgroundColor: '#1a1400',
  },
  rulesTitle: {
    color: colors.gold, fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider,
  },
  ruleRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
  },
  ruleBullet: {
    width: 18, height: 18, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
  },
  ruleBulletText: { color: colors.white, fontSize: 9, fontWeight: typography.fontWeight.black },
  ruleText: {
    flex: 1, color: colors.inactive, fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold, lineHeight: 18,
  },

  enterBtn: {
    backgroundColor: colors.primary,
    borderWidth: borders.medium, borderColor: '#000',
    paddingVertical: spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    marginBottom: spacing.md,
  },
  enterBtnText: {
    color: colors.white, fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider,
  },
  youCookedBanner: {
    borderWidth: borders.medium, borderColor: colors.success,
    backgroundColor: '#001a00',
    paddingVertical: spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    marginBottom: spacing.md,
  },
  youCookedText: {
    color: colors.success, fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider,
  },

  entriesHeading: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  entriesHeadingText: {
    color: colors.inactive, fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider,
  },
  entriesHeadingLine: { flex: 1, height: 1, backgroundColor: '#1f1f1f' },
  entriesHeadingNote: {
    color: '#333', fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  // ── Entry card (feed-style) ────────────────────────────────────────────────
  entryCard: {
    width: '100%', backgroundColor: colors.surface,
    overflow: 'hidden', position: 'relative',
  },
  entryCardLeading: { borderWidth: borders.thin, borderColor: colors.gold },
  entryPlaceholder: { backgroundColor: '#0d0d0d', alignItems: 'center', justifyContent: 'center' },
  leadingStripe: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
    backgroundColor: colors.gold, zIndex: 2,
  },

  posBadge: {
    position: 'absolute', top: spacing.sm, left: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderWidth: borders.thin, borderColor: '#333',
    paddingHorizontal: spacing.sm, paddingVertical: 3,
    zIndex: 3,
  },
  posBadgeLeading: { backgroundColor: colors.gold, borderColor: colors.gold },
  posBadgeText: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black },

  cardActions: {
    position: 'absolute', right: spacing.sm, bottom: 80,
    alignItems: 'center', gap: 4, zIndex: 3,
  },
  voteBtn: {
    width: 48, height: 48, backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: borders.thin, borderColor: '#333',
    alignItems: 'center', justifyContent: 'center',
  },
  voteBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  voteCount: {
    color: colors.white, fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.black, textAlign: 'center',
  },

  cardOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing.md, paddingBottom: spacing.md, paddingTop: spacing.xl,
    background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
    backgroundColor: 'transparent',
  },
  cardDish: {
    color: colors.white, fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.tight,
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  cardUserRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rankTierDot: {
    width: 18, height: 18, alignItems: 'center', justifyContent: 'center',
  },
  rankTierDotText: { color: '#000', fontSize: 8, fontWeight: typography.fontWeight.black },
  cardUsername: {
    color: 'rgba(255,255,255,0.85)', fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.black, flex: 1,
  },
  rankChip: {
    borderWidth: borders.thin,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  rankChipText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: 0.5 },
  cardTime: { color: 'rgba(255,255,255,0.45)', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },

  // ── No entries ────────────────────────────────────────────────────────────
  noEntriesWrap: {
    marginHorizontal: spacing.md, marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: borders.thin, borderColor: '#1f1f1f',
    paddingVertical: spacing.lg, alignItems: 'center',
  },
  noEntriesText: {
    color: colors.inactive, fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider,
  },

  // ── No event ──────────────────────────────────────────────────────────────
  noEventWrap: { paddingHorizontal: spacing.md, paddingTop: spacing.xl },
  noEventIcon: {
    width: 64, height: 64, backgroundColor: colors.surface,
    borderWidth: borders.thin, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  noEventTitle: {
    color: colors.border, fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider,
    marginBottom: spacing.xs,
  },
  noEventSub: {
    color: colors.inactive, fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold, marginBottom: spacing.xl,
  },

  // ── Footer (upcoming / past) ──────────────────────────────────────────────
  footerSection: { paddingHorizontal: spacing.md },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.inactive, fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: '#1f1f1f' },

  // Upcoming
  upcomingCard: {
    backgroundColor: colors.surface,
    borderWidth: borders.thin, borderColor: '#1f1f1f',
    padding: spacing.md, marginBottom: spacing.sm,
  },
  upcomingTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  upcomingTag: {
    backgroundColor: '#1a2600', borderWidth: borders.thin, borderColor: '#00C47A',
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  upcomingTagText: { color: '#00C47A', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  upcomingStartsIn: { flex: 1, color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },
  upcomingTitle: {
    color: colors.white, fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.tight, marginBottom: 3,
  },
  upcomingSubtitle: { color: '#555', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, marginBottom: spacing.sm },
  upcomingFooter: { flexDirection: 'row', alignItems: 'center' },
  xpBadgeSmall: {
    backgroundColor: '#1a3a1a',
    borderWidth: borders.thin, borderColor: colors.success,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  xpBadgeSmallText: { color: colors.success, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wide },

  // Past
  pastCard: {
    backgroundColor: '#0d0d0d',
    borderWidth: borders.thin, borderColor: '#1a1a1a',
    padding: spacing.md, marginBottom: spacing.sm, opacity: 0.75,
  },
  pastTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  pastTitle: { flex: 1, color: '#555', fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.black },
  pastEnded: { color: '#333', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },
  pastWinner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pastWinnerDish: { flex: 1, color: '#666', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },
  pastWinnerBy: { color: '#333', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },
  pastWinnerUser: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black },
  pastNoWinner: { color: '#333', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },
});
