import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borders } from '../theme';

const WINDOW = Dimensions.get('window');
const CARD_HEIGHT = WINDOW.height * 0.68;
const CARD_GAP = spacing.xs;

const USER = {
  username: 'yas15sp',
  level: 12,
  rank: 'CHEF DE PARTIE',
  xp: 3400,
  xpToNext: 5000,
};

const WEEKLY_EVENT = {
  title: 'STREET FOOD SHOWDOWN',
  subtitle: 'Cook your best street food dish & get voted to the top',
  prize: '5,000 XP + GOLD BADGE',
  participants: 248,
  endsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 7 * 3600 * 1000 + 44 * 60 * 1000),
};

const POSTS = [
  { id: '1', username: 'chef_miguel', rank: 'SOUS CHEF', level: 28, dish: 'Spicy Korean Tacos', votes: 1204, timeAgo: '2h ago' },
  { id: '2', username: 'firepit_anna', rank: 'HEAD CHEF', level: 41, dish: 'Smoked BBQ Brisket', votes: 987, timeAgo: '4h ago' },
  { id: '3', username: 'pastry_kim', rank: 'CHEF DE PARTIE', level: 19, dish: 'Miso Caramel Croissant', votes: 743, timeAgo: '6h ago' },
  { id: '4', username: 'ramen_lord', rank: 'SOUS CHEF', level: 33, dish: 'Tonkotsu Ramen XL', votes: 612, timeAgo: '8h ago' },
  { id: '5', username: 'grill_queen', rank: 'COMMIS CHEF', level: 8, dish: 'Jerk Chicken Skewers', votes: 441, timeAgo: '11h ago' },
];

const RANK_COLORS = {
  'KITCHEN HAND': '#555555',
  'COMMIS CHEF': '#AAAAAA',
  'CHEF DE PARTIE': colors.accent,
  'SOUS CHEF': colors.primary,
  'HEAD CHEF': colors.gold,
  'EXECUTIVE CHEF': colors.success,
};

function useCountdown(targetDate) {
  const calc = () => {
    const diff = Math.max(0, targetDate - Date.now());
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      mins: Math.floor((diff / (1000 * 60)) % 60),
      secs: Math.floor((diff / 1000) % 60),
    };
  };
  const [time, setTime] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function TikTokCard({ item, index }) {
  const isTop = index === 0;
  const rankColor = RANK_COLORS[item.rank] || colors.accent;

  return (
    <View style={[styles.tikTokCard, { height: CARD_HEIGHT }, isTop && styles.tikTokCardTop]}>
      {/* Full bleed image placeholder */}
      <View style={styles.tikTokImage}>
        <Ionicons name="restaurant" size={72} color="#1e1e1e" />
      </View>

      {/* Top-left rank badge */}
      <View style={[styles.tikTokRankBadge, isTop && { backgroundColor: colors.gold, borderColor: colors.gold }]}>
        <Text style={[styles.tikTokRankNum, isTop && { color: colors.background }]}>#{index + 1}</Text>
      </View>

      {/* Right-side action column */}
      <View style={styles.tikTokActions}>
        <TouchableOpacity style={[styles.tikTokVoteBtn, isTop && styles.tikTokVoteBtnTop]}>
          <Ionicons name="flame" size={26} color={isTop ? colors.background : colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.tikTokVoteCount, isTop && { color: colors.gold }]}>
          {item.votes.toLocaleString()}
        </Text>
      </View>

      {/* Bottom info overlay */}
      <View style={styles.tikTokOverlay}>
        <Text style={styles.tikTokDish} numberOfLines={1}>{item.dish}</Text>
        <View style={styles.tikTokUserRow}>
          <View style={[styles.tikTokLevelDot, { backgroundColor: rankColor }]}>
            <Text style={styles.tikTokLevelDotText}>{item.level}</Text>
          </View>
          <Text style={styles.tikTokUsername}>@{item.username}</Text>
          <View style={[styles.tikTokRankChip, { borderColor: rankColor }]}>
            <Text style={[styles.tikTokRankChipText, { color: rankColor }]}>{item.rank}</Text>
          </View>
          <Text style={styles.tikTokTime}>{item.timeAgo}</Text>
        </View>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const countdown = useCountdown(WEEKLY_EVENT.endsAt);
  const xpPct = (USER.xp / USER.xpToNext) * 100;
  const rankColor = RANK_COLORS[USER.rank] || colors.accent;
  const [headerHeight, setHeaderHeight] = useState(0);

  const snapOffsets = useMemo(
    () => POSTS.map((_, i) => headerHeight + i * (CARD_HEIGHT + CARD_GAP)),
    [headerHeight],
  );

  const ListHeader = (
    <View onLayout={e => setHeaderHeight(e.nativeEvent.layout.height)}>
      {/* App bar */}
      <View style={styles.appHeader}>
        <Text style={styles.appTitle}>LET ME COOK</Text>
        <TouchableOpacity style={styles.notifBtn}>
          <Ionicons name="notifications" size={22} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Player card */}
      <View style={styles.playerCard}>
        <View style={styles.playerTop}>
          <View style={styles.levelBadge}>
            <Text style={styles.levelLabel}>LVL</Text>
            <Text style={styles.levelNum}>{USER.level}</Text>
          </View>
          <View style={styles.playerInfo}>
            <Text style={styles.playerName}>{USER.username}</Text>
            <View style={[styles.rankBadge, { borderColor: rankColor }]}>
              <Text style={[styles.rankText, { color: rankColor }]}>{USER.rank}</Text>
            </View>
          </View>
        </View>
        <View style={styles.xpRow}>
          <Text style={styles.xpLabel}>XP</Text>
          <Text style={styles.xpNums}>{USER.xp.toLocaleString()} / {USER.xpToNext.toLocaleString()}</Text>
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

        <View style={styles.countdownRow}>
          {[
            { val: countdown.days, label: 'DAYS' },
            { val: countdown.hours, label: 'HRS' },
            { val: countdown.mins, label: 'MIN' },
            { val: countdown.secs, label: 'SEC' },
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
        <TouchableOpacity style={styles.joinBtn}>
          <Text style={styles.joinBtnText}>JOIN EVENT</Text>
        </TouchableOpacity>
      </View>

      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>TRENDING</Text>
        <View style={styles.sectionLine} />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={POSTS}
        keyExtractor={item => item.id}
        ListHeaderComponent={ListHeader}
        renderItem={({ item, index }) => <TikTokCard item={item} index={index} />}
        snapToOffsets={snapOffsets}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },

  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  appTitle: {
    color: colors.white,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.black,
    letterSpacing: typography.letterSpacing.wider,
  },
  notifBtn: {
    width: 38, height: 38,
    borderWidth: borders.thin, borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },

  // Player card
  playerCard: {
    backgroundColor: colors.surface,
    borderWidth: borders.medium, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.md,
  },
  playerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  levelBadge: {
    backgroundColor: colors.primary,
    borderWidth: borders.thin, borderColor: colors.border,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    alignItems: 'center', marginRight: spacing.md, minWidth: 52,
  },
  levelLabel: {
    color: colors.white, fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold, letterSpacing: typography.letterSpacing.wider,
  },
  levelNum: {
    color: colors.white, fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.black, lineHeight: typography.fontSize.xxl + 4,
  },
  playerInfo: { flex: 1 },
  playerName: {
    color: colors.white, fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold, letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing.xs,
  },
  rankBadge: {
    borderWidth: borders.thin, paddingHorizontal: spacing.sm,
    paddingVertical: 2, alignSelf: 'flex-start',
  },
  rankText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold, letterSpacing: typography.letterSpacing.wider },
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
  eventBadgeText: { color: colors.white, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold, letterSpacing: typography.letterSpacing.wider },
  participantsBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: borders.thin, borderColor: colors.border,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  participantsText: { color: colors.accent, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },
  eventTitle: {
    color: colors.white, fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider, marginBottom: spacing.xs,
  },
  eventSubtitle: { color: colors.inactive, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, marginBottom: spacing.md, lineHeight: 18 },
  countdownRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md, gap: spacing.xs },
  countdownGroup: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  countdownBox: {
    backgroundColor: colors.background,
    borderWidth: borders.thin, borderColor: colors.border,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    minWidth: 44, alignItems: 'center',
  },
  countdownNum: { color: colors.accent, fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.black, fontVariant: ['tabular-nums'] },
  countdownLabel: { color: colors.inactive, fontSize: typography.fontSize.xs - 1, fontWeight: typography.fontWeight.bold, letterSpacing: typography.letterSpacing.wider, marginTop: 2 },
  countdownSep: { color: colors.primary, fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.black, marginTop: -2 },
  prizeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  prizeText: { color: colors.gold, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, letterSpacing: typography.letterSpacing.wide },
  joinBtn: { backgroundColor: colors.primary, borderWidth: borders.thin, borderColor: colors.border, paddingVertical: spacing.sm, alignItems: 'center' },
  joinBtnText: { color: colors.white, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },

  // Section
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm },
  sectionTitle: { color: colors.white, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  sectionLine: { flex: 1, height: 2, backgroundColor: colors.border },

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
    backgroundColor: '#0d0d0d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tikTokRankBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: borders.thin,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tikTokRankNum: {
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
    gap: spacing.xs,
  },
  tikTokVoteBtn: {
    width: 48, height: 48,
    borderWidth: borders.medium, borderColor: colors.primary,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  tikTokVoteBtnTop: {
    backgroundColor: colors.primary,
  },
  tikTokVoteCount: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.black,
  },
  tikTokOverlay: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(10,10,10,0.92)',
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
    color: '#333', fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold, marginLeft: 'auto',
  },
});
