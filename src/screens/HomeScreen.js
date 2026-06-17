import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions, Image, PanResponder, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { supabase } from '../lib/supabase';
import { getProfile, getFeed, getEvents, voteCook, unvoteCook, timeAgo } from '../lib/api';
import { xpProgress, cooksToNextLevel, nextLevelName, RANK_COLORS, rankFromXp } from '../lib/xp';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, typography, borders } from '../theme';
import VoteNotifBell from '../components/VoteNotifBell';
import AvatarImage from '../components/AvatarImage';
import ActiveDuelBanner from '../components/ActiveDuelBanner';

const SEEN_WINNERS_KEY = '@seen_winner_events';

async function getSeenWinners() {
  try {
    const raw = await AsyncStorage.getItem(SEEN_WINNERS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

async function markWinnersSeen(eventIds) {
  try {
    const seen = await getSeenWinners();
    eventIds.forEach(id => seen.add(id));
    await AsyncStorage.setItem(SEEN_WINNERS_KEY, JSON.stringify([...seen]));
  } catch {}
}

function applyWinnerBoost(posts, seenEventIds) {
  const unseen = posts.filter(p => p.is_event_winner && p.event_id && !seenEventIds.has(p.event_id));
  if (!unseen.length) return posts;
  const rest = posts.filter(p => !unseen.includes(p));
  return [...unseen, ...rest];
}

const WINDOW = Dimensions.get('window');
const CARD_HEIGHT = WINDOW.height * 0.68;
const CARD_GAP = spacing.xs;

// ─── Countdown hook ────────────────────────────────────────────────────────────

function useCountdown(targetMs) {
  const calc = useCallback(() => {
    const diff = Math.max(0, (targetMs ?? 0) - Date.now());
    return {
      days:  Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      mins:  Math.floor((diff / (1000 * 60)) % 60),
      secs:  Math.floor((diff / 1000) % 60),
    };
  }, [targetMs]);
  const [time, setTime] = useState(calc);
  useEffect(() => {
    setTime(calc());
    const id = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(id);
  }, [calc]);
  return time;
}

function pad(n) { return String(n).padStart(2, '0'); }

// ─── Video frame ──────────────────────────────────────────────────────────────

function VideoFrame({ uri }) {
  const player = useVideoPlayer(uri, p => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

// ─── TikTok-style feed card ────────────────────────────────────────────────────

function TikTokCard({ item, index, userId, eventsMap }) {
  const isTop = index === 0;
  const profile = item.profiles || {};
  const { rank: computedRank, tier: computedTier } = rankFromXp(profile.xp ?? 0);
  const rankColor = RANK_COLORS[computedRank] || colors.accent;
  const cardNavigation = useNavigation();
  const [voted, setVoted] = useState(false);
  const [voteCount, setVoteCount] = useState((item.votes || []).length);

  // Sync voted state once userId is available (arrives after first render)
  useEffect(() => {
    if (!userId) return;
    setVoted((item.votes || []).some(v => v.user_id === userId));
  }, [userId]);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const photos = item.photo_urls || [];
  const hasVideo = !!item.video_url;

  // Flat media array: video first, then photos in reverse (finale → mid-cook → pre-cook)
  const mediaItems = useMemo(() => {
    const items = [];
    if (hasVideo) items.push({ type: 'video', uri: item.video_url });
    [...photos].reverse().forEach(uri => items.push({ type: 'photo', uri }));
    return items;
  }, []);
  const [activeMediaIdx, setActiveMediaIdx] = useState(0);
  const activeMedia = mediaItems[activeMediaIdx] ?? null;

  // Swipe gesture to advance/retreat media
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10,
      onPanResponderRelease: (_, { dx }) => {
        if (dx < -50) setActiveMediaIdx(i => Math.min(i + 1, mediaItems.length - 1));
        else if (dx > 50) setActiveMediaIdx(i => Math.max(i - 1, 0));
      },
    })
  ).current;

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
      if (next) await voteCook(item.id, userId);
      else await unvoteCook(item.id, userId);
    } catch {
      setVoted(!next);
      setVoteCount(c => c + (next ? -1 : 1));
    }
  }

  return (
    <View style={[styles.tikTokCard, { height: CARD_HEIGHT }, (isTop || item.is_event_winner) && styles.tikTokCardTop]} {...panResponder.panHandlers}>
      {/* Background — pointerEvents none so clip-frame taps pass through */}
      <View style={[styles.tikTokImage, { backgroundColor: '#0a0a0a' }]} pointerEvents="none">
        {activeMedia?.type === 'video' ? (
          <VideoFrame uri={activeMedia.uri} />
        ) : activeMedia?.uri ? (
          <Image source={{ uri: activeMedia.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <>
            <View style={styles.tikTokStripes} pointerEvents="none">
              {Array.from({ length: 8 }).map((_, i) => (
                <View key={i} style={[styles.tikTokStripe, { backgroundColor: rankColor, opacity: isTop ? 0.07 : 0.04 }]} />
              ))}
            </View>
            <Ionicons name="restaurant" size={64} color={isTop ? rankColor : '#1a1a1a'} style={{ opacity: isTop ? 0.3 : 1 }} />
          </>
        )}
      </View>

      {/* Clip strip — video first, then photos */}
      <View style={styles.clipRow}>
        {mediaItems.map((m, i) => {
          const active = i === activeMediaIdx;
          const activeColor = m.type === 'video' ? colors.primary : rankColor;
          return (
            <TouchableOpacity
              key={i}
              style={[styles.clipFrame, active && { borderColor: activeColor, backgroundColor: activeColor }]}
              onPress={() => setActiveMediaIdx(i)}
              activeOpacity={0.75}
            >
              <Ionicons name={m.type === 'video' ? 'play' : 'camera'} size={9} color={active ? colors.background : '#555'} />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Position badge */}
      <View style={[styles.positionBadge, isTop && { backgroundColor: colors.gold, borderColor: colors.gold }]}>
        <Text style={[styles.positionText, isTop && { color: colors.background }]}>#{index + 1}</Text>
      </View>

      {/* Right-side actions */}
      <View style={styles.tikTokActions}>
        <TouchableOpacity onPress={handleVote} activeOpacity={0.8}>
          <Animated.View
            style={[
              styles.tikTokVoteBtn,
              voted && styles.tikTokVoteBtnActive,
              isTop && !voted && styles.tikTokVoteBtnTop,
              { transform: [{ scale: scaleAnim }] },
            ]}
          >
            <Ionicons
              name={voted ? 'flame' : 'flame-outline'}
              size={26}
              color={voted ? colors.white : isTop ? colors.background : colors.primary}
            />
          </Animated.View>
        </TouchableOpacity>
        <Text style={[styles.tikTokVoteCount, voted && { color: colors.primary }, isTop && !voted && { color: colors.gold }]}>
          {voteCount.toLocaleString()}
        </Text>
        <TouchableOpacity style={styles.tikTokShareBtn} activeOpacity={0.8}>
          <Ionicons name="share-outline" size={20} color={colors.inactive} />
        </TouchableOpacity>
      </View>

      {/* Bottom info overlay */}
      <View style={styles.tikTokOverlay}>
        {item.event_id && (
          <View style={[styles.tikTokEventBadge, item.is_event_winner && styles.tikTokEventBadgeWinner]}>
            <Ionicons
              name={item.is_event_winner ? 'trophy' : 'star'}
              size={9}
              color={item.is_event_winner ? '#000' : colors.gold}
            />
            <Text style={[styles.tikTokEventBadgeText, item.is_event_winner && styles.tikTokEventBadgeTextWinner]}>
              {item.is_event_winner
                ? `WINNER · ${eventsMap?.[item.event_id]?.title ?? 'EVENT'}`
                : (eventsMap?.[item.event_id]?.title ?? 'EVENT ENTRY')}
            </Text>
          </View>
        )}
        <TouchableOpacity activeOpacity={0.75} onPress={() => cardNavigation.navigate('PostDetail', { item })}>
          <Text style={styles.tikTokDish} numberOfLines={1}>{item.dish_name}</Text>
        </TouchableOpacity>
        {item.inspired_by?.username && (
          <TouchableOpacity
            style={styles.tikTokInspiredRow}
            activeOpacity={0.7}
            onPress={() => cardNavigation.navigate('PostDetail', { cookId: item.inspired_by_cook_id })}
          >
            <Ionicons name="link-outline" size={10} color={colors.inactive} />
            <Text style={styles.tikTokInspiredText}>Inspired by @{item.inspired_by.username}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.tikTokUserRow}
          activeOpacity={0.7}
          onPress={() => profile.id && cardNavigation.navigate('UserProfile', { userId: profile.id })}
        >
          <View style={[styles.tikTokLevelDot, { backgroundColor: rankColor }]}>
            <Text style={styles.tikTokLevelDotText}>{computedTier}</Text>
          </View>
          <Text style={styles.tikTokUsername}>@{profile.username}</Text>
          <View style={[styles.tikTokRankChip, { borderColor: rankColor }]}>
            <Text style={[styles.tikTokRankChipText, { color: rankColor }]}>{computedRank}</Text>
          </View>
          <Text style={styles.tikTokTime}>{timeAgo(item.created_at)}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────

function pickFeaturedEvent(events) {
  const now = Date.now();
  const live = events.filter(e =>
    new Date(e.starts_at).getTime() <= now &&
    new Date(e.ends_at).getTime() > now
  );
  if (!live.length) return null;
  return live.reduce((best, e) => (e.xp_reward > best.xp_reward ? e : best), live[0]);
}

export default function HomeScreen() {
  const navigation = useNavigation();
  const [headerHeight, setHeaderHeight] = useState(0);
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [featuredEvent, setFeaturedEvent] = useState(null);
  const [eventsMap, setEventsMap] = useState({});
  const [cookCount, setCookCount] = useState(0);
  const [hasEnteredEvent, setHasEnteredEvent] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const feedOffset = useRef(0);
  const FEED_PAGE = 20;

  const countdown = useCountdown(featuredEvent ? new Date(featuredEvent.ends_at).getTime() : null);

  useEffect(() => {
    if (!featuredEvent || !userId) { setHasEnteredEvent(false); return; }
    supabase
      .from('cooks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('event_id', featuredEvent.id)
      .then(({ count }) => setHasEnteredEvent((count ?? 0) > 0))
      .catch(() => {});
  }, [featuredEvent?.id, userId]);

  function applyEvents(events) {
    setFeaturedEvent(pickFeaturedEvent(events));
    setEventsMap(Object.fromEntries(events.map(e => [e.id, e])));
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      const uid = session.user.id;
      setUserId(uid);

      // Profile + cook count load independently — never blocked by feed/events
      getProfile(uid).then(setProfile).catch(() => {});
      supabase.from('cooks').select('*', { count: 'exact', head: true })
        .eq('user_id', uid)
        .then(({ count }) => setCookCount(count ?? 0))
        .catch(() => {});

      // Feed + events
      Promise.all([getFeed({ limit: FEED_PAGE, offset: 0 }), getEvents(), getSeenWinners()])
        .then(([feed, events, seen]) => {
          const boosted = applyWinnerBoost(feed, seen);
          const newWinners = feed.filter(p => p.is_event_winner && p.event_id && !seen.has(p.event_id)).map(p => p.event_id);
          if (newWinners.length) markWinnersSeen(newWinners);
          setPosts(boosted);
          feedOffset.current = feed.length;
          setHasMore(feed.length === FEED_PAGE);
          applyEvents(events);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    });
  }, []);

  // Refresh feed, profile, and event each time the tab is focused
  useFocusEffect(useCallback(() => {
    if (!userId) return;

    // Profile + cook count always load independently
    getProfile(userId).then(setProfile).catch(() => {});
    supabase.from('cooks').select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .then(({ count }) => setCookCount(count ?? 0))
      .catch(() => {});

    Promise.all([getFeed({ limit: FEED_PAGE, offset: 0 }), getSeenWinners()])
      .then(([feed, seen]) => {
        const boosted = applyWinnerBoost(feed, seen);
        const newWinners = feed.filter(p => p.is_event_winner && p.event_id && !seen.has(p.event_id)).map(p => p.event_id);
        if (newWinners.length) markWinnersSeen(newWinners);
        setPosts(boosted);
        feedOffset.current = feed.length;
        setHasMore(feed.length === FEED_PAGE);
      })
      .catch(() => {});

    getEvents().then(applyEvents).catch(() => {});
  }, [userId]));

  async function handleLoadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const more = await getFeed({ limit: FEED_PAGE, offset: feedOffset.current });
      setPosts(prev => {
        const seen = new Set(prev.map(p => p.id));
        return [...prev, ...more.filter(p => !seen.has(p.id))];
      });
      feedOffset.current += more.length;
      setHasMore(more.length === FEED_PAGE);
    } catch {}
    setLoadingMore(false);
  }

  const { current: xpInLevel, needed: xpNeeded, pct: xpPct } = xpProgress(profile?.xp ?? 0);
  const { rank: myComputedRank } = rankFromXp(profile?.xp ?? 0);
  const rankColor = RANK_COLORS[myComputedRank] || colors.accent;
  const cooksLeft = cooksToNextLevel(profile?.xp ?? 0);
  const nextLevel = nextLevelName(profile?.xp ?? 0);

  const snapOffsets = useMemo(
    () => posts.map((_, i) => headerHeight + i * (CARD_HEIGHT + CARD_GAP)),
    [headerHeight, posts],
  );

  const ListHeader = (
    <View onLayout={e => setHeaderHeight(e.nativeEvent.layout.height)}>
      {/* Player card */}
      <View style={styles.playerCard}>
        <View style={styles.playerTop}>
          <AvatarImage
            uri={profile?.avatar_url}
            letters={(profile?.username ?? '?').slice(0, 2).toUpperCase()}
            rankColor={rankColor}
            size={48}
          />
          <View style={styles.playerInfo}>
            <Text style={styles.playerName}>{profile?.username ?? '...'}</Text>
            <View style={[styles.rankBadge, { borderColor: rankColor }]}>
              <Text style={[styles.rankText, { color: rankColor }]}>{profile ? myComputedRank : '...'}</Text>
            </View>
          </View>
          <View style={styles.streakPill}>
            <Ionicons name="flame" size={14} color={colors.gold} />
            <Text style={styles.streakText}>{profile?.streak ?? 0}</Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="flame" size={12} color={colors.primary} />
            <Text style={styles.statNum}>{(profile?.total_votes ?? 0).toLocaleString()}</Text>
            <Text style={styles.statLabel}>VOTES</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="restaurant" size={12} color={colors.accent} />
            <Text style={styles.statNum}>{cookCount.toLocaleString()}</Text>
            <Text style={styles.statLabel}>COOKS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="trophy" size={12} color={colors.gold} />
            <Text style={styles.statNum}>{profile?.global_rank ? `#${profile.global_rank}` : '—'}</Text>
            <Text style={styles.statLabel}>RANK</Text>
          </View>
        </View>
        <View style={styles.xpRow}>
          <Text style={styles.xpLabel}>XP TO NEXT LEVEL</Text>
          <Text style={styles.xpNums}>
            {nextLevel ? `${xpInLevel.toLocaleString()} / ${xpNeeded.toLocaleString()}` : 'MAX'}
          </Text>
        </View>
        <View style={styles.xpTrack}>
          <View style={[styles.xpFill, { width: `${xpPct}%`, backgroundColor: rankColor }]} />
          <View style={[styles.xpMarker, { left: `${xpPct}%` }]} />
        </View>
        {nextLevel ? (
          <Text style={styles.xpPreview}>~{cooksLeft} cook{cooksLeft !== 1 ? 's' : ''} to {nextLevel}</Text>
        ) : (
          <Text style={styles.xpPreview}>Maximum rank achieved</Text>
        )}
      </View>

      {/* Live event card — only shown when there's an active event */}
      {featuredEvent && (
        <View style={styles.eventCard}>
          <View style={styles.eventHeader}>
            <View style={styles.eventBadge}>
              <Text style={styles.eventBadgeText}>LIVE EVENT</Text>
            </View>
            <View style={styles.xpAwardPill}>
              <Text style={styles.xpAwardText}>+{featuredEvent.xp_reward} XP</Text>
            </View>
          </View>
          <Text style={styles.eventTitle}>{featuredEvent.title}</Text>
          {featuredEvent.subtitle ? (
            <Text style={styles.eventSubtitle}>{featuredEvent.subtitle}</Text>
          ) : null}

          {/* Countdown */}
          <View style={styles.countdownRow}>
            {[
              { val: countdown.days,  label: 'DAYS' },
              { val: countdown.hours, label: 'HRS'  },
              { val: countdown.mins,  label: 'MIN'  },
              { val: countdown.secs,  label: 'SEC'  },
            ].map(({ val, label }, i) => (
              <View key={label} style={styles.countdownGroup}>
                <View style={styles.countdownBox}>
                  <Text style={styles.countdownNum}>{pad(val)}</Text>
                </View>
                <Text style={styles.countdownLabel}>{label}</Text>
                {i < 3 && <Text style={styles.countdownSep}>:</Text>}
              </View>
            ))}
          </View>

          {featuredEvent.prize_label ? (
            <View style={styles.prizeRow}>
              <Ionicons name="trophy" size={14} color={colors.gold} />
              <Text style={styles.prizeText}>{featuredEvent.prize_label}</Text>
            </View>
          ) : null}
          {hasEnteredEvent ? (
            <View style={styles.youCookedBtn}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.youCookedBtnText}>YOU COOKED!</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.joinBtn}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Cook', {
                eventId: featuredEvent.id,
                eventTitle: featuredEvent.title,
                eventXpReward: featuredEvent.xp_reward,
              })}
            >
              <Text style={styles.joinBtnText}>JOIN EVENT</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>TRENDING</Text>
        <View style={styles.sectionLine} />
        <Text style={styles.sectionCount}>{posts.length}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top bar — outside scroll so it stays fixed */}
      <View style={styles.appHeader}>
        <Text style={styles.appTitle}>LET ME COOK!</Text>
        <VoteNotifBell />
      </View>
      <ActiveDuelBanner />

      <FlatList
        data={posts}
        keyExtractor={item => item.id}
        ListHeaderComponent={ListHeader}
        renderItem={({ item, index }) => (
          <TikTokCard item={item} index={index} userId={userId} eventsMap={eventsMap} />
        )}
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyState}>
              <Ionicons name="restaurant-outline" size={40} color={colors.border} />
              <Text style={styles.emptyTitle}>NO COOKS YET</Text>
              <Text style={styles.emptySubtitle}>Be the first to post a cook!</Text>
            </View>
          )
        }
        snapToOffsets={snapOffsets}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ padding: spacing.lg }} /> : null}
      />
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: borders.medium,
    borderBottomColor: '#000',
  },
  appTitle: {
    color: colors.white,
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.black,
    letterSpacing: typography.letterSpacing.wide,
    textTransform: 'uppercase',
  },
  notifBtn: {
    width: 36, height: 36,
    borderWidth: borders.thin, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  notifDot: {
    position: 'absolute',
    top: 6, right: 6,
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: colors.accent,
    borderWidth: 1, borderColor: colors.primary,
  },

  content: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xxl * 2, gap: spacing.sm },
  emptyTitle: { color: colors.border, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  emptySubtitle: { color: colors.inactive, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },

  // Player card
  playerCard: {
    backgroundColor: colors.surface,
    borderWidth: borders.medium, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.md,
  },
  playerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, gap: spacing.sm },
  levelBadge: {
    backgroundColor: colors.primary,
    borderWidth: borders.thin, borderColor: '#000',
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    alignItems: 'center', minWidth: 52,
  },
  levelLabel: {
    color: 'rgba(255,255,255,0.7)', fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold, letterSpacing: typography.letterSpacing.wider,
  },
  levelNum: {
    color: colors.white, fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.black, lineHeight: typography.fontSize.xxl + 4,
  },
  playerInfo: { flex: 1, gap: spacing.xs },
  playerName: {
    color: colors.white, fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wide,
  },
  rankBadge: {
    borderWidth: borders.thin, paddingHorizontal: spacing.sm,
    paddingVertical: 2, alignSelf: 'flex-start',
  },
  rankText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  streakPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#1a1500',
    borderWidth: borders.thin, borderColor: colors.gold,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
  },
  streakText: { color: colors.gold, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.black },
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: borders.thin, borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  statItem: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: spacing.sm,
  },
  statNum: {
    color: colors.white, fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.black,
  },
  statLabel: {
    color: colors.inactive, fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wide,
  },
  statDivider: { width: 1, height: '60%', backgroundColor: colors.border },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  xpLabel: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold, letterSpacing: typography.letterSpacing.wider },
  xpNums: { color: colors.accent, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },
  xpTrack: {
    height: 12, backgroundColor: colors.background,
    borderWidth: borders.thin, borderColor: colors.border, overflow: 'hidden', position: 'relative',
  },
  xpFill: { height: '100%', backgroundColor: colors.accent },
  xpMarker: { position: 'absolute', top: 0, width: 3, height: '100%', backgroundColor: colors.white, marginLeft: -1 },
  xpPreview: {
    color: colors.inactive, fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold, marginTop: spacing.xs,
    letterSpacing: typography.letterSpacing.wide,
  },

  // Event card
  eventCard: {
    backgroundColor: colors.surface,
    borderWidth: borders.medium, borderColor: colors.primary,
    padding: spacing.md, marginBottom: spacing.md,
  },
  eventHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  eventBadge: { backgroundColor: colors.primary, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  eventBadgeText: { color: colors.white, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  xpAwardPill: {
    backgroundColor: '#1a3a1a',
    borderWidth: borders.thin, borderColor: colors.success,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  xpAwardText: { color: colors.success, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wide },
  eventTitle: {
    color: colors.white, fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.tight, marginBottom: spacing.xs,
  },
  eventSubtitle: { color: colors.inactive, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, marginBottom: spacing.md, lineHeight: 18 },

  // Countdown
  countdownRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  countdownGroup: { flex: 1, alignItems: 'center', flexDirection: 'column' },
  countdownBox: {
    backgroundColor: colors.background,
    borderWidth: borders.thin, borderColor: colors.border,
    width: '90%', alignItems: 'center', paddingVertical: spacing.xs,
    marginBottom: 4,
  },
  countdownNum: { color: colors.accent, fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.black, fontVariant: ['tabular-nums'] },
  countdownLabel: { color: colors.inactive, fontSize: typography.fontSize.xs - 1, fontWeight: typography.fontWeight.bold, letterSpacing: typography.letterSpacing.wider },
  countdownSep: { position: 'absolute', right: 0, top: 4, color: colors.primary, fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.black, lineHeight: typography.fontSize.xl + 4 },

  prizeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  prizeText: { color: colors.gold, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, letterSpacing: typography.letterSpacing.wide },
  joinBtn: { backgroundColor: colors.primary, borderWidth: borders.thin, borderColor: '#000', paddingVertical: spacing.sm + 2, alignItems: 'center' },
  joinBtnText: { color: colors.white, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  youCookedBtn: {
    borderWidth: borders.medium, borderColor: colors.success,
    backgroundColor: '#001a00',
    paddingVertical: spacing.sm + 2,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
  },
  youCookedBtnText: { color: colors.success, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },

  // Section
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm },
  sectionTitle: { color: colors.white, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  sectionLine: { flex: 1, height: 2, backgroundColor: colors.border },
  sectionCount: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },

  // TikTok cards
  tikTokCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: borders.thin,
    borderColor: colors.border,
    marginBottom: CARD_GAP,
    overflow: 'hidden',
    position: 'relative',
  },
  tikTokCardTop: {
    borderColor: colors.gold,
    borderWidth: borders.medium,
  },
  tikTokImage: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tikTokStripes: {
    position: 'absolute',
    top: -40, left: -40, right: -40, bottom: -40,
    flexDirection: 'row',
    gap: 18,
    transform: [{ rotate: '-20deg' }],
  },
  tikTokStripe: {
    width: 20,
    flex: 1,
  },
  clipRow: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    gap: 3,
  },
  clipFrame: {
    width: 22, height: 22,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  positionBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: borders.thin,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  positionText: {
    color: colors.white,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.black,
    letterSpacing: typography.letterSpacing.wide,
  },
  tikTokActions: {
    position: 'absolute',
    right: spacing.md,
    bottom: 90,
    alignItems: 'center',
    gap: spacing.sm,
  },
  tikTokVoteBtn: {
    width: 50, height: 50,
    borderWidth: borders.medium, borderColor: colors.primary,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  tikTokVoteBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tikTokVoteBtnTop: {
    backgroundColor: colors.primary,
  },
  tikTokVoteCount: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.black,
  },
  tikTokShareBtn: {
    width: 36, height: 36,
    borderWidth: borders.thin, borderColor: colors.border,
    backgroundColor: 'rgba(17,17,17,0.8)',
    alignItems: 'center', justifyContent: 'center',
  },
  tikTokOverlay: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(8,8,8,0.93)',
    borderTopWidth: borders.thin,
    borderTopColor: colors.border,
    padding: spacing.md,
  },
  tikTokEventBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#1a1400',
    borderWidth: 1, borderColor: colors.gold,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xs, paddingVertical: 2,
    marginBottom: spacing.xs,
  },
  tikTokEventBadgeWinner: {
    backgroundColor: colors.gold,
    borderColor: '#a37800',
  },
  tikTokEventBadgeText: {
    color: colors.gold, fontSize: 8,
    fontWeight: typography.fontWeight.black, letterSpacing: 1,
  },
  tikTokEventBadgeTextWinner: {
    color: '#000',
  },
  tikTokDish: {
    color: colors.white,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.black,
    letterSpacing: typography.letterSpacing.tight,
    marginBottom: spacing.xs,
  },
  tikTokInspiredRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  tikTokInspiredText: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },
  tikTokUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  tikTokLevelDot: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  tikTokLevelDotText: {
    color: colors.background, fontSize: 9,
    fontWeight: typography.fontWeight.black,
  },
  tikTokUsername: {
    color: colors.inactive, fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  tikTokRankChip: {
    borderWidth: 1, paddingHorizontal: spacing.xs, paddingVertical: 1,
  },
  tikTokRankChipText: {
    fontSize: 9, fontWeight: typography.fontWeight.black,
    letterSpacing: typography.letterSpacing.wider,
  },
  tikTokTime: {
    color: '#444', fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold, marginLeft: 'auto',
  },
});
