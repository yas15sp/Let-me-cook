import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borders } from '../theme';

const { width: W } = Dimensions.get('window');

// ─── Mock data ────────────────────────────────────────────────────────────────

const ACTIVE_DUELS = [
  {
    id: '1',
    opponent: 'chef_miguel',
    opponentRank: 'Chef',
    opponentRankColor: '#E8001C',
    initials: 'CM',
    recipe: 'Spicy Korean Tacos',
    expiresIn: 2340,   // seconds — under 1 hour shows red
    yourTurn: true,
  },
  {
    id: '2',
    opponent: 'firepit_anna',
    opponentRank: 'Exec Chef',
    opponentRankColor: '#A855F7',
    initials: 'FA',
    recipe: 'Smoked BBQ Brisket',
    expiresIn: 5 * 3600 + 12 * 60, // 5h 12m — over 1 hour shows grey
    yourTurn: false,
  },
];

const FRIENDS = [
  {
    id: '1',
    name: 'Jamie K.',
    handle: '@jamiek',
    initials: 'JK',
    rank: 'Sous Chef',
    rankColor: '#FFB800',
    online: true,
    status: 'mid-cook',
    activity: 'Kimchi fried rice',
  },
  {
    id: '2',
    name: 'Priya S.',
    handle: '@priyas',
    initials: 'PS',
    rank: 'Chef',
    rankColor: '#E8001C',
    online: true,
    status: 'browsing',
    activity: 'Browsing',
  },
  {
    id: '3',
    name: 'Tom R.',
    handle: '@tomr',
    initials: 'TR',
    rank: 'Gold Cook',
    rankColor: '#FFB800',
    online: false,
    status: 'idle',
    activity: 'Last seen 2h ago',
  },
];

const XP_BONUSES = [
  { label: 'Base cook',             xp: '+80 XP' },
  { label: 'Same time window',      xp: '+40 XP' },
  { label: 'Same recipe as rival',  xp: '+30 XP' },
  { label: 'Simultaneous cook',     xp: '+50 XP' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimer(secs) {
  if (secs >= 3600) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return `${h}h ${m}m`;
  }
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function useCountdown(initial) {
  const [secs, setSecs] = useState(initial);
  useEffect(() => {
    const id = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  return secs;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ initials, rankColor, size = 40, dim = false }) {
  return (
    <View style={[styles.avatar, {
      width: size, height: size, borderRadius: size / 2,
      borderColor: rankColor,
      opacity: dim ? 0.5 : 1,
    }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.32 }]}>{initials}</Text>
    </View>
  );
}

function RankChip({ rank, rankColor }) {
  return (
    <View style={[styles.rankChip, { borderColor: rankColor }]}>
      <Text style={[styles.rankChipText, { color: rankColor }]}>{rank.toUpperCase()}</Text>
    </View>
  );
}

function DuelCard({ duel }) {
  const secs = useCountdown(duel.expiresIn);
  const isUrgent = secs < 3600;

  return (
    <View style={styles.duelCard}>
      <Avatar initials={duel.initials} rankColor={duel.opponentRankColor} size={38} />
      <View style={styles.duelInfo}>
        <View style={styles.duelNameRow}>
          <Text style={styles.duelOpponent} numberOfLines={1}>{duel.opponent}</Text>
          <RankChip rank={duel.opponentRank} rankColor={duel.opponentRankColor} />
        </View>
        <Text style={styles.duelRecipe} numberOfLines={1}>{duel.recipe}</Text>
        <View style={styles.duelBottom}>
          <View style={styles.duelTimerRow}>
            <Ionicons name="time-outline" size={11} color={isUrgent ? colors.primary : colors.inactive} />
            <Text style={[styles.duelTimer, { color: isUrgent ? colors.primary : colors.inactive }]}>
              {formatTimer(secs)}
            </Text>
          </View>
          <View style={[styles.statusChip, duel.yourTurn ? styles.statusChipYours : styles.statusChipWaiting]}>
            <Text style={[styles.statusChipText, { color: duel.yourTurn ? colors.background : colors.inactive }]}>
              {duel.yourTurn ? 'YOUR TURN' : 'WAITING'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function FriendCard({ friend }) {
  const isMidCook = friend.status === 'mid-cook';
  const dim = !friend.online;

  return (
    <View style={[styles.friendCard, dim && styles.friendCardDim]}>
      <View style={styles.friendLeft}>
        <View style={{ position: 'relative' }}>
          <Avatar initials={friend.initials} rankColor={friend.rankColor} size={44} dim={dim} />
          {friend.online && <View style={styles.presenceDot} />}
        </View>
        <View style={styles.friendInfo}>
          <View style={styles.friendNameRow}>
            <Text style={[styles.friendName, dim && styles.dimText]}>{friend.name}</Text>
            <RankChip rank={friend.rank} rankColor={dim ? colors.inactive : friend.rankColor} />
          </View>
          <Text style={[styles.friendActivity, isMidCook && styles.friendActivityCook]}>
            {isMidCook ? `Mid-cook · ${friend.activity}` : friend.activity}
          </Text>
        </View>
      </View>

      {!dim && (
        <View style={styles.friendActions}>
          {isMidCook && (
            <TouchableOpacity style={styles.jumpInBtn} activeOpacity={0.85}>
              <Text style={styles.jumpInText}>JUMP IN</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.challengeBtn} activeOpacity={0.85}>
            <Text style={styles.challengeText}>CHALLENGE</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function SectionLabel({ title }) {
  return (
    <View style={styles.sectionLabelRow}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function RivalsScreen() {
  const [searching, setSearching] = useState(false);

  const onlineCount = FRIENDS.filter(f => f.online).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>Rivals</Text>
        <View style={styles.onlineIndicator}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>{onlineCount} online</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Active Duels ── */}
        <SectionLabel title="Active Duels" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.duelsStrip}
          style={styles.duelsScroll}
        >
          {ACTIVE_DUELS.map(d => <DuelCard key={d.id} duel={d} />)}
        </ScrollView>

        {/* ── Friends ── */}
        <SectionLabel title="Friends" />
        <View style={styles.friendsList}>
          {[...FRIENDS]
            .sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0))
            .map(f => <FriendCard key={f.id} friend={f} />)
          }
        </View>

        {/* ── Matchmaking ── */}
        <SectionLabel title="Find a Rival" />
        <View style={styles.matchCard}>
          <View style={styles.matchHeader}>
            <Text style={styles.matchTitle}>Ranked Match</Text>
            <View style={styles.matchBadge}>
              <Text style={styles.matchBadgeText}>RANKED</Text>
            </View>
          </View>
          <Text style={styles.matchSub}>
            Matched within ±1 rank tier · same time window
          </Text>

          <TouchableOpacity
            style={[styles.findBtn, searching && styles.findBtnSearching]}
            onPress={() => setSearching(s => !s)}
            activeOpacity={0.85}
          >
            {searching ? (
              <View style={styles.findBtnInner}>
                <View style={styles.searchingDot} />
                <Text style={styles.findBtnText}>SEARCHING...</Text>
              </View>
            ) : (
              <Text style={styles.findBtnText}>FIND A RIVAL</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.matchNote}>
            Bonus XP for cooking the same recipe · Max bonus for simultaneous cooks
          </Text>
        </View>

        {/* ── XP Bonus Info ── */}
        <View style={styles.xpBox}>
          <Text style={styles.xpBoxTitle}>RIVAL BONUS BREAKDOWN</Text>
          {XP_BONUSES.map(({ label, xp }) => (
            <View key={label} style={styles.xpRow}>
              <Text style={styles.xpLabel}>{label}</Text>
              <Text style={styles.xpValue}>{xp}</Text>
            </View>
          ))}
          <View style={styles.xpDivider} />
          <View style={styles.xpRow}>
            <Text style={[styles.xpLabel, { color: colors.white, fontWeight: '900' }]}>Max rival bonus</Text>
            <Text style={[styles.xpValue, { fontSize: 15, color: colors.success }]}>+200 XP</Text>
          </View>
        </View>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Top bar
  topBar: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
  },
  topBarTitle: {
    color: colors.white,
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.black,
    fontFamily: undefined,
    letterSpacing: typography.letterSpacing.tight,
  },
  onlineIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00C47A' },
  onlineText: { color: colors.white, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: spacing.md },

  // Section label
  sectionLabelRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: spacing.md, marginBottom: spacing.sm, marginTop: spacing.lg, gap: spacing.sm,
  },
  sectionLabel: {
    color: colors.accent,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.black,
    letterSpacing: typography.letterSpacing.wider,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: colors.border },

  // Duel cards
  duelsScroll: { marginBottom: spacing.xs },
  duelsStrip: { paddingHorizontal: spacing.md, gap: spacing.sm },
  duelCard: {
    width: 188,
    backgroundColor: colors.surface,
    borderWidth: borders.thin,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  duelInfo: { flex: 1, gap: 3 },
  duelNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  duelOpponent: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.black,
    flex: 1,
  },
  duelRecipe: {
    color: colors.inactive,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  duelBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  duelTimerRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  duelTimer: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: 0.5 },
  statusChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  statusChipYours: { backgroundColor: colors.accent },
  statusChipWaiting: { backgroundColor: colors.border },
  statusChipText: { fontSize: 8, fontWeight: typography.fontWeight.black, letterSpacing: 0.8 },

  // Avatar
  avatar: {
    borderWidth: 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontWeight: typography.fontWeight.black, letterSpacing: 0.5 },

  // Rank chip
  rankChip: {
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  rankChipText: { fontSize: 7, fontWeight: typography.fontWeight.black, letterSpacing: 1 },

  // Friend cards
  friendsList: { marginHorizontal: spacing.md, gap: spacing.sm },
  friendCard: {
    backgroundColor: colors.surface,
    borderWidth: borders.thin,
    borderColor: colors.border,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  friendCardDim: { opacity: 0.4 },
  friendLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  presenceDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#00C47A',
    borderWidth: 2, borderColor: colors.surface,
  },
  friendInfo: { flex: 1, gap: 3 },
  friendNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  friendName: {
    color: colors.white,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.black,
    flex: 1,
  },
  dimText: { color: colors.inactive },
  friendActivity: {
    color: colors.inactive,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  friendActivityCook: { color: colors.success },

  friendActions: { flexDirection: 'row', gap: spacing.xs },
  challengeBtn: {
    borderWidth: borders.thin,
    borderColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  challengeText: {
    color: colors.accent,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.black,
    letterSpacing: 0.8,
  },
  jumpInBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  jumpInText: {
    color: colors.white,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.black,
    letterSpacing: 0.8,
  },

  // Matchmaking card
  matchCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: borders.thin,
    borderColor: colors.primary,
    padding: spacing.md,
    gap: spacing.sm,
  },
  matchHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  matchTitle: {
    color: colors.white,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.black,
    flex: 1,
  },
  matchBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  matchBadgeText: {
    color: colors.white,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.black,
    letterSpacing: 1.5,
  },
  matchSub: {
    color: colors.inactive,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    lineHeight: 18,
  },
  findBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
    borderWidth: borders.thin,
    borderColor: colors.border,
  },
  findBtnSearching: { backgroundColor: colors.surface, borderColor: colors.primary },
  findBtnInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  searchingDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary,
  },
  findBtnText: {
    color: colors.white,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.black,
    letterSpacing: typography.letterSpacing.wider,
  },
  matchNote: {
    color: colors.inactive,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
    lineHeight: 16,
  },

  // XP bonus box
  xpBox: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: borders.thin,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  xpBoxTitle: {
    color: colors.inactive,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.black,
    letterSpacing: typography.letterSpacing.wider,
    marginBottom: spacing.xs,
  },
  xpRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  xpLabel: {
    color: colors.inactive,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  xpValue: {
    color: colors.success,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.black,
    letterSpacing: 0.5,
  },
  xpDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
});
