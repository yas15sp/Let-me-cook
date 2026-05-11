import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, spacing, typography, borders } from '../theme';

// ─── Mock data ────────────────────────────────────────────────────────────────

const FEATURED = {
  id: 'f1',
  title: 'WEEKEND WIPEOUT',
  subtitle: 'Iron Chef style — one mystery ingredient revealed at start',
  endsAt: Date.now() + 1000 * 60 * 60 * 14 + 1000 * 60 * 37, // 14h 37m from now
  xpReward: 500,
  prizeLabel: '🏆 Gold Trophy',
  participants: 1204,
  minRank: null,
  tag: 'LIVE',
  tagColor: colors.primary,
  accent: colors.accent,
};

const UPCOMING = [
  {
    id: 'u1',
    title: 'RAMEN ROYALE',
    subtitle: 'Best broth wins. Classic, modern, or fusion.',
    startsIn: 1000 * 60 * 60 * 26,
    xpReward: 300,
    participants: 88,
    minRank: 'Emerald Cook',
    minRankColor: '#00C47A',
    tag: 'SOON',
    tagColor: '#00C47A',
  },
  {
    id: 'u2',
    title: 'DESSERT DUEL',
    subtitle: 'Sweet, savoury, or somewhere in between.',
    startsIn: 1000 * 60 * 60 * 51,
    xpReward: 250,
    participants: 214,
    minRank: null,
    tag: 'SOON',
    tagColor: '#00C47A',
  },
  {
    id: 'u3',
    title: 'KNIFE SKILLS CHALLENGE',
    subtitle: 'Speed + precision. Julienne, chiffonade, brunoise.',
    startsIn: 1000 * 60 * 60 * 72,
    xpReward: 200,
    participants: 56,
    minRank: 'Diamond Cook',
    minRankColor: '#88CCFF',
    tag: 'SOON',
    tagColor: '#00C47A',
  },
];

const PAST = [
  {
    id: 'p1',
    title: 'TACO TAKEDOWN',
    endedAgo: '2 days ago',
    xpReward: 300,
    participants: 932,
    winner: 'jamie_k',
    tag: 'ENDED',
    tagColor: colors.inactive,
  },
  {
    id: 'p2',
    title: 'BRUNCH BATTLE',
    endedAgo: '5 days ago',
    xpReward: 200,
    participants: 741,
    winner: 'priya_s',
    tag: 'ENDED',
    tagColor: colors.inactive,
  },
];

// ─── Countdown hook ────────────────────────────────────────────────────────────

function useCountdown(targetMs) {
  const [remaining, setRemaining] = useState(Math.max(0, targetMs - Date.now()));
  useEffect(() => {
    const id = setInterval(() => setRemaining(Math.max(0, targetMs - Date.now())), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  const totalSecs = Math.floor(remaining / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return { h, m, s, pad, totalSecs };
}

function formatStartsIn(ms) {
  const h = Math.floor(ms / 1000 / 3600);
  if (h < 24) return `Starts in ${h}h`;
  const d = Math.floor(h / 24);
  return `Starts in ${d}d`;
}

// ─── Featured event ────────────────────────────────────────────────────────────

function FeaturedEvent({ event, onEnter }) {
  const { h, m, s, pad } = useCountdown(event.endsAt);
  const urgent = h === 0;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!urgent) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [urgent]);

  return (
    <View style={styles.featuredCard}>
      {/* halftone dots */}
      <View style={styles.featuredDots} pointerEvents="none">
        {Array.from({ length: 20 }).map((_, i) => (
          <View key={i} style={styles.dot} />
        ))}
      </View>

      <View style={styles.featuredTopRow}>
        <View style={[styles.tag, { backgroundColor: event.tagColor }]}>
          <Text style={styles.tagText}>{event.tag}</Text>
        </View>
        <Text style={styles.featuredParticipants}>
          {event.participants.toLocaleString()} cooking
        </Text>
      </View>

      <Text style={styles.featuredTitle}>{event.title}</Text>
      <Text style={styles.featuredSubtitle}>{event.subtitle}</Text>

      <View style={styles.featuredMeta}>
        <View style={styles.xpBadge}>
          <Text style={styles.xpBadgeText}>+{event.xpReward} XP</Text>
        </View>
        <Text style={styles.featuredPrize}>{event.prizeLabel}</Text>
      </View>

      {/* countdown */}
      <View style={[styles.countdownRow, urgent && styles.countdownUrgent]}>
        <Text style={[styles.countdownLabel, urgent && { color: colors.primary }]}>
          ENDS IN
        </Text>
        <Animated.Text
          style={[
            styles.countdownValue,
            urgent && { color: colors.primary, transform: [{ scale: pulse }] },
          ]}
        >
          {`${pad(h)}:${pad(m)}:${pad(s)}`}
        </Animated.Text>
      </View>

      <TouchableOpacity style={styles.enterBtn} onPress={onEnter} activeOpacity={0.85}>
        <Text style={styles.enterBtnText}>ENTER NOW</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Upcoming event card ───────────────────────────────────────────────────────

function UpcomingCard({ event }) {
  return (
    <View style={styles.upcomingCard}>
      <View style={styles.upcomingTopRow}>
        <View style={[styles.tag, { backgroundColor: 'transparent', borderColor: event.tagColor, borderWidth: borders.thin }]}>
          <Text style={[styles.tagText, { color: event.tagColor }]}>{event.tag}</Text>
        </View>
        {event.minRank && (
          <View style={[styles.rankGate, { borderColor: event.minRankColor }]}>
            <Text style={[styles.rankGateText, { color: event.minRankColor }]}>
              {event.minRank}+
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.upcomingTitle}>{event.title}</Text>
      <Text style={styles.upcomingSubtitle}>{event.subtitle}</Text>

      <View style={styles.upcomingFooter}>
        <Text style={styles.startsIn}>{formatStartsIn(event.startsIn)}</Text>
        <View style={styles.xpBadgeSmall}>
          <Text style={styles.xpBadgeSmallText}>+{event.xpReward} XP</Text>
        </View>
        <Text style={styles.upcomingParticipants}>{event.participants} joined</Text>
      </View>
    </View>
  );
}

// ─── Past event card ───────────────────────────────────────────────────────────

function PastCard({ event }) {
  return (
    <View style={styles.pastCard}>
      <View style={styles.pastTopRow}>
        <Text style={styles.pastTitle}>{event.title}</Text>
        <View style={[styles.tag, { backgroundColor: event.tagColor }]}>
          <Text style={styles.tagText}>{event.tag}</Text>
        </View>
      </View>
      <View style={styles.pastFooter}>
        <Text style={styles.pastMeta}>{event.endedAgo} · {event.participants.toLocaleString()} cooks</Text>
        <Text style={styles.pastWinner}>🥇 @{event.winner}</Text>
      </View>
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

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function EventsScreen() {
  return (
    <View style={styles.root}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>Events</Text>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.livePillText}>3 LIVE</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader title="FEATURED" />
        <FeaturedEvent event={FEATURED} onEnter={() => {}} />

        <SectionHeader title="COMING UP" />
        {UPCOMING.map((e) => (
          <UpcomingCard key={e.id} event={e} />
        ))}

        <SectionHeader title="RECENTLY ENDED" />
        {PAST.map((e) => (
          <PastCard key={e.id} event={e} />
        ))}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // top bar
  topBar: {
    backgroundColor: colors.primary,
    paddingTop: 56,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
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
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    gap: 5,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  livePillText: {
    color: colors.white,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.black,
    letterSpacing: typography.letterSpacing.wider,
  },

  // scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.md, paddingTop: spacing.md },

  // section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.inactive,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.black,
    letterSpacing: typography.letterSpacing.wider,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#1f1f1f',
  },

  // tag
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
  },
  tagText: {
    color: '#000',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.black,
    letterSpacing: typography.letterSpacing.wider,
  },

  // featured card
  featuredCard: {
    backgroundColor: colors.surface,
    borderWidth: borders.medium,
    borderColor: colors.accent,
    borderRadius: 4,
    padding: spacing.md,
    overflow: 'hidden',
  },
  featuredDots: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 120,
    height: 120,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 10,
    opacity: 0.07,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  featuredTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  featuredParticipants: {
    color: colors.inactive,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  featuredTitle: {
    color: colors.accent,
    fontSize: typography.fontSize.display,
    fontWeight: typography.fontWeight.black,
    letterSpacing: typography.letterSpacing.tight,
    lineHeight: 38,
    marginBottom: 4,
  },
  featuredSubtitle: {
    color: '#888',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.md,
  },
  featuredMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  xpBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 3,
  },
  xpBadgeText: {
    color: '#000',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.black,
    letterSpacing: typography.letterSpacing.wide,
  },
  featuredPrize: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#1a1a1a',
    borderWidth: borders.thin,
    borderColor: '#2a2a2a',
    borderRadius: 4,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  countdownUrgent: {
    borderColor: colors.primary,
    backgroundColor: '#1a0000',
  },
  countdownLabel: {
    color: colors.inactive,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.black,
    letterSpacing: typography.letterSpacing.wider,
  },
  countdownValue: {
    color: colors.white,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.black,
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  enterBtn: {
    backgroundColor: colors.primary,
    borderWidth: borders.medium,
    borderColor: '#000',
    borderRadius: 4,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  enterBtnText: {
    color: colors.white,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.black,
    letterSpacing: typography.letterSpacing.wider,
  },

  // upcoming card
  upcomingCard: {
    backgroundColor: colors.surface,
    borderWidth: borders.thin,
    borderColor: '#2a2a2a',
    borderRadius: 4,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  upcomingTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  rankGate: {
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  rankGateText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.black,
    letterSpacing: typography.letterSpacing.wide,
  },
  upcomingTitle: {
    color: colors.white,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.black,
    letterSpacing: typography.letterSpacing.tight,
    marginBottom: 3,
  },
  upcomingSubtitle: {
    color: '#666',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.sm,
  },
  upcomingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  startsIn: {
    color: colors.inactive,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    flex: 1,
  },
  xpBadgeSmall: {
    backgroundColor: '#1a3a1a',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 3,
  },
  xpBadgeSmallText: {
    color: colors.success,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.black,
    letterSpacing: typography.letterSpacing.wide,
  },
  upcomingParticipants: {
    color: colors.inactive,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  // past card
  pastCard: {
    backgroundColor: '#0d0d0d',
    borderWidth: borders.thin,
    borderColor: '#1a1a1a',
    borderRadius: 4,
    padding: spacing.md,
    marginBottom: spacing.sm,
    opacity: 0.75,
  },
  pastTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  pastTitle: {
    color: '#666',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.black,
    letterSpacing: typography.letterSpacing.tight,
  },
  pastFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pastMeta: {
    color: '#444',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  pastWinner: {
    color: colors.gold,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.black,
  },
});
