import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { getProfile, getFeed, voteCook, unvoteCook, timeAgo } from '../lib/api';
import { colors, spacing, typography, borders } from '../theme';

const WINDOW = Dimensions.get('window');
const CARD_HEIGHT = WINDOW.height * 0.68;
const CARD_GAP = spacing.xs;

const XP_PER_RANK = 5000;

const WEEKLY_EVENT = {
  title: 'STREET FOOD SHOWDOWN',
  subtitle: 'Cook your best street food dish & get voted to the top',
  prize: '5,000 XP + GOLD BADGE',
  participants: 248,
  endsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 7 * 3600 * 1000 + 44 * 60 * 1000),
};

const RANK_COLORS = {
  'Gold Cook':        '#FFB800',
  'Emerald Cook':     '#00C47A',
  'Diamond Cook':     '#88CCFF',
  'Chef':             '#E8001C',
  'Exec Chef':        '#A855F7',
  'Master Chef':      '#FF6B00',
  'World Class Chef': '#E8C840',
};

// ─── Countdown hook ────────────────────────────────────────────────────────────

function useCountdown(targetDate) {
  const calc = () => {
    const diff = Math.max(0, targetDate - Date.now());
    return {
      days:  Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      mins:  Math.floor((diff / (1000 * 60)) % 60),
      secs:  Math.floor((diff / 1000) % 60),
    };
  };
  const [time, setTime] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function pad(n) { return String(n).padStart(2, '0'); }

// ─── TikTok-style feed card ────────────────────────────────────────────────────

function TikTokCard({ item, index, userId }) {
  const isTop = index === 0;
  const profile = item.profiles || {};
  const rankColor = RANK_COLORS[profile.rank] || colors.accent;
  const initiallyVoted = (item.votes || []).some(v => v.user_id === userId);
  const [voted, setVoted] = useState(initiallyVoted);
  const [voteCount, setVoteCount] = useState((item.votes || []).length);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  async function handleVote() {
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
      // revert on error
      setVoted(!next);
      setVoteCount(c => c + (next ? -1 : 1));
    }
  }

  const stripeColor = rankColor;

  return (
    <View style={[styles.tikTokCard, { height: CARD_HEIGHT }, isTop && styles.tikTokCardTop]}>
      {/* Background image placeholder with diagonal stripes */}
      <View style={[styles.tikTokImage, { backgroundColor: '#0a0a0a' }]}>
        <View style={styles.tikTokStripes} pointerEvents="none">
          {Array.from({ length: 8 }).map((_, i) => (
            <View key={i} style={[styles.tikTokStripe, { backgroundColor: stripeColor, opacity: isTop ? 0.07 : 0.04 }]} />
          ))}
        </View>
        <Ionicons name="restaurant" size={64} color={isTop ? stripeColor : '#1a1a1a'} style={{ opacity: isTop ? 0.3 : 1 }} />
        {/* 3-clip indicator */}
        <View style={styles.clipRow}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[styles.clipFrame, i === 1 && { borderColor: stripeColor }]}>
              <Ionicons name="camera" size={9} color={i === 1 ? stripeColor : '#333'} />
            </View>
          ))}
        </View>
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
        <Text style={styles.tikTokDish} numberOfLines={1}>{item.dish_name}</Text>
        <View style={styles.tikTokUserRow}>
          <View style={[styles.tikTokLevelDot, { backgroundColor: rankColor }]}>
            <Text style={styles.tikTokLevelDotText}>{profile.level}</Text>
          </View>
          <Text style={styles.tikTokUsername}>@{profile.username}</Text>
          <View style={[styles.tikTokRankChip, { borderColor: rankColor }]}>
            <Text style={[styles.tikTokRankChipText, { color: rankColor }]}>{profile.rank}</Text>
          </View>
          <Text style={styles.tikTokTime}>{timeAgo(item.created_at)}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const countdown = useCountdown(WEEKLY_EVENT.endsAt);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      const uid = session.user.id;
      setUserId(uid);
      Promise.all([getProfile(uid), getFeed()]).then(([prof, feed]) => {
        setProfile(prof);
        setPosts(feed);
        setLoading(false);
      }).catch(() => setLoading(false));
    });
  }, []);

  const xpPct = profile ? Math.min((profile.xp / XP_PER_RANK) * 100, 100) : 0;
  const rankColor = RANK_COLORS[profile?.rank] || colors.accent;

  const snapOffsets = useMemo(
    () => posts.map((_, i) => headerHeight + i * (CARD_HEIGHT + CARD_GAP)),
    [headerHeight, posts],
  );

  const ListHeader = (
    <View onLayout={e => setHeaderHeight(e.nativeEvent.layout.height)}>
      {/* Player card */}
      <View style={styles.playerCard}>
        <View style={styles.playerTop}>
          <View style={styles.levelBadge}>
            <Text style={styles.levelLabel}>LVL</Text>
            <Text style={styles.levelNum}>{profile?.level ?? 1}</Text>
          </View>
          <View style={styles.playerInfo}>
            <Text style={styles.playerName}>{profile?.username ?? '...'}</Text>
            <View style={[styles.rankBadge, { borderColor: rankColor }]}>
              <Text style={[styles.rankText, { color: rankColor }]}>{profile?.rank ?? '...'}</Text>
            </View>
          </View>
          <View style={styles.streakPill}>
            <Ionicons name="flame" size={14} color={colors.gold} />
            <Text style={styles.streakText}>{profile?.streak ?? 0}</Text>
          </View>
        </View>
        <View style={styles.xpRow}>
          <Text style={styles.xpLabel}>XP TO NEXT RANK</Text>
          <Text style={styles.xpNums}>{(profile?.xp ?? 0).toLocaleString()} / {XP_PER_RANK.toLocaleString()}</Text>
        </View>
        <View style={styles.xpTrack}>
          <View style={[styles.xpFill, { width: `${xpPct}%` }]} />
          <View style={[styles.xpMarker, { left: `${xpPct}%` }]} />
        </View>
      </View>

      {/* Weekly event card */}
      <View style={styles.eventCard}>
        <View style={styles.eventHeader}>
          <View style={styles.eventBadge}>
            <Text style={styles.eventBadgeText}>WEEKLY EVENT</Text>
          </View>
          <View style={styles.participantsBadge}>
            <Ionicons name="people" size={12} color={colors.accent} />
            <Text style={styles.participantsText}>{WEEKLY_EVENT.participants}</Text>
          </View>
        </View>
        <Text style={styles.eventTitle}>{WEEKLY_EVENT.title}</Text>
        <Text style={styles.eventSubtitle}>{WEEKLY_EVENT.subtitle}</Text>

        {/* Countdown — boxes stacked, separators between them */}
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

        <View style={styles.prizeRow}>
          <Ionicons name="trophy" size={14} color={colors.gold} />
          <Text style={styles.prizeText}>{WEEKLY_EVENT.prize}</Text>
        </View>
        <TouchableOpacity style={styles.joinBtn} activeOpacity={0.85}>
          <Text style={styles.joinBtnText}>JOIN EVENT</Text>
        </TouchableOpacity>
      </View>

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
        <TouchableOpacity style={styles.notifBtn} activeOpacity={0.8}>
          <Ionicons name="notifications" size={20} color={colors.white} />
          <View style={styles.notifDot} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={posts}
        keyExtractor={item => item.id}
        ListHeaderComponent={ListHeader}
        renderItem={({ item, index }) => (
          <TikTokCard item={item} index={index} userId={userId} />
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
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  xpLabel: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold, letterSpacing: typography.letterSpacing.wider },
  xpNums: { color: colors.accent, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },
  xpTrack: {
    height: 12, backgroundColor: colors.background,
    borderWidth: borders.thin, borderColor: colors.border, overflow: 'hidden', position: 'relative',
  },
  xpFill: { height: '100%', backgroundColor: colors.accent },
  xpMarker: { position: 'absolute', top: 0, width: 3, height: '100%', backgroundColor: colors.white, marginLeft: -1 },

  // Event card
  eventCard: {
    backgroundColor: colors.surface,
    borderWidth: borders.medium, borderColor: colors.primary,
    padding: spacing.md, marginBottom: spacing.md,
  },
  eventHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  eventBadge: { backgroundColor: colors.primary, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  eventBadgeText: { color: colors.white, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  participantsBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: borders.thin, borderColor: colors.border,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  participantsText: { color: colors.accent, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },
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
  tikTokDish: {
    color: colors.white,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.black,
    letterSpacing: typography.letterSpacing.tight,
    marginBottom: spacing.xs,
  },
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
