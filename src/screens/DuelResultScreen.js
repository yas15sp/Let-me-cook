import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borders } from '../theme';

const { width: W, height: H } = Dimensions.get('window');

const DUEL_COMPLETION_XP = 150;

const RANK_COLORS = {
  'Gold Cook':        '#FFB800',
  'Emerald Cook':     '#00C47A',
  'Diamond Cook':     '#88CCFF',
  'Chef':             '#E8001C',
  'Exec Chef':        '#A855F7',
  'Master Chef':      '#FF6B00',
  'World Class Chef': '#FFFFFF',
};

function pad(n) { return String(n).padStart(2, '0'); }
function formatTime(secs) {
  if (secs == null) return '—';
  return `${pad(Math.floor(secs / 60))}:${pad(secs % 60)}`;
}

function PlayerHalf({ player, cook, translateY, onPress }) {
  const rankColor = RANK_COLORS[player?.rank] || colors.accent;
  const finalePhoto = cook?.photo_urls?.length
    ? cook.photo_urls[cook.photo_urls.length - 1]
    : null;

  const inner = (
    <Animated.View style={[styles.half, { transform: [{ translateY }] }]}>
      {finalePhoto
        ? <Image source={{ uri: finalePhoto }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        : <View style={[StyleSheet.absoluteFill, styles.halfPlaceholder]}>
            <Ionicons name="restaurant" size={48} color={colors.border} />
          </View>
      }
      <View style={[styles.rankAccent, { backgroundColor: rankColor }]} />
      <View style={styles.scrim} />
      <View style={styles.halfInfo}>
        <View style={[styles.rankPill, { backgroundColor: rankColor }]}>
          <Text style={styles.rankPillText}>{(player?.rank || '').toUpperCase()}</Text>
        </View>
        <Text style={styles.halfUsername} numberOfLines={1}>@{player?.username}</Text>
        <Text style={styles.halfDish} numberOfLines={1}>{cook?.dish_name || '—'}</Text>
        <View style={styles.halfMeta}>
          <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.6)" />
          <Text style={styles.halfTime}>{formatTime(cook?.cook_time_secs)}</Text>
          <View style={styles.halfXp}>
            <Text style={styles.halfXpText}>+{DUEL_COMPLETION_XP} XP</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={styles.halfTouch} onPress={onPress} activeOpacity={0.88}>
        {inner}
      </TouchableOpacity>
    );
  }
  return inner;
}

export default function DuelResultScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { duel, cooks } = route.params ?? {};

  const challenger = duel.challenger || {};
  const opponent   = duel.opponent   || {};
  const challengerCook = (cooks || []).find(c => c.user_id === duel.challenger_id);
  const opponentCook   = (cooks || []).find(c => c.user_id === duel.opponent_id);

  const topY    = useRef(new Animated.Value(-H * 0.5)).current;
  const bottomY = useRef(new Animated.Value(H * 0.5)).current;
  const vsScale = useRef(new Animated.Value(0)).current;
  const vsRot   = useRef(new Animated.Value(0)).current;
  const stripY  = useRef(new Animated.Value(40)).current;
  const stripOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(topY,    { toValue: 0, tension: 70, friction: 10, useNativeDriver: true }),
        Animated.spring(bottomY, { toValue: 0, tension: 70, friction: 10, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(vsScale, { toValue: 1, tension: 120, friction: 5, useNativeDriver: true }),
        Animated.timing(vsRot,   { toValue: 1, duration: 250, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(stripOp, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(stripY,  { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const vsRotInterp = vsRot.interpolate({ inputRange: [0, 1], outputRange: ['-20deg', '-6deg'] });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>

      <View style={styles.header}>
        <View style={styles.completeBadge}>
          <Ionicons name="checkmark-circle" size={11} color={colors.background} />
          <Text style={styles.completeBadgeText}>DUEL COMPLETE</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* Arena — stacked top/bottom */}
      <View style={styles.arena}>
        <PlayerHalf
          player={challenger}
          cook={challengerCook}
          translateY={topY}
          onPress={challengerCook?.id ? () => navigation.push('PostDetail', { cookId: challengerCook.id }) : undefined}
        />

        {/* Horizontal centre divider */}
        <View style={styles.centerDivider} />

        <PlayerHalf
          player={opponent}
          cook={opponentCook}
          translateY={bottomY}
          onPress={opponentCook?.id ? () => navigation.push('PostDetail', { cookId: opponentCook.id }) : undefined}
        />

        {/* VS badge — rendered last so it sits above both halves */}
        <View style={styles.vsAnchor} pointerEvents="none">
          <Animated.View style={{ transform: [{ scale: vsScale }, { rotate: vsRotInterp }], alignItems: 'center' }}>
            <View style={styles.vsGlow} />
            <View style={styles.vsBox}>
              <Text style={styles.vsText}>VS</Text>
            </View>
          </Animated.View>
        </View>
      </View>

      {/* Stats strip */}
      <Animated.View style={[styles.statsStrip, { opacity: stripOp, transform: [{ translateY: stripY }] }]}>
        <View style={styles.statsCell}>
          <Text style={styles.statsCellVal}>{formatTime(challengerCook?.cook_time_secs)}</Text>
          <Text style={styles.statsCellLabel}>COOK TIME</Text>
        </View>
        <View style={styles.statsDivider} />
        <View style={styles.statsCell}>
          <Text style={[styles.statsCellVal, { color: colors.accent }]}>+{DUEL_COMPLETION_XP} XP</Text>
          <Text style={styles.statsCellLabel}>EACH</Text>
        </View>
        <View style={styles.statsDivider} />
        <View style={styles.statsCell}>
          <Text style={styles.statsCellVal}>{formatTime(opponentCook?.cook_time_secs)}</Text>
          <Text style={styles.statsCellLabel}>COOK TIME</Text>
        </View>
      </Animated.View>

      <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
        <Text style={styles.doneBtnText}>BACK TO RIVALS</Text>
      </TouchableOpacity>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: borders.thin, borderColor: colors.border,
  },
  completeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.success, paddingHorizontal: spacing.sm, paddingVertical: 4,
  },
  completeBadgeText: {
    color: colors.background, fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider,
  },
  closeBtn: { padding: spacing.xs },

  // ── Arena ──────────────────────────────────────────
  arena: { flex: 1, flexDirection: 'column', overflow: 'hidden' },

  halfTouch: { flex: 1 },
  half: { flex: 1, width: '100%', overflow: 'hidden', backgroundColor: colors.surface },
  halfPlaceholder: { alignItems: 'center', justifyContent: 'center' },

  rankAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },

  // Thin scrim only at the very bottom so info is readable but photo shows through
  scrim: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 90,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  halfInfo: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: spacing.sm, gap: 2,
  },
  rankPill: {
    alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, marginBottom: 2,
  },
  rankPillText: {
    color: colors.background, fontSize: 7,
    fontWeight: typography.fontWeight.black, letterSpacing: 0.8,
  },
  halfUsername: {
    color: colors.white, fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wide,
  },
  halfDish: {
    color: 'rgba(255,255,255,0.8)', fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  halfMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  halfTime: {
    color: 'rgba(255,255,255,0.65)', fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.black, fontVariant: ['tabular-nums'], flex: 1,
  },
  halfXp: { backgroundColor: colors.accent, paddingHorizontal: 5, paddingVertical: 2 },
  halfXpText: {
    color: colors.background, fontSize: 9,
    fontWeight: typography.fontWeight.black, letterSpacing: 0.8,
  },

  centerDivider: {
    height: 2, backgroundColor: colors.background,
  },
  vsAnchor: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
  },
  vsGlow: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#FFB800', opacity: 0.35,
  },
  vsBox: {
    backgroundColor: colors.primary,
    borderWidth: 3, borderColor: '#FFB800',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  vsText: {
    color: '#FFB800', fontSize: 42,
    fontWeight: typography.fontWeight.black, letterSpacing: 6,
  },

  // ── Stats strip ────────────────────────────────────
  statsStrip: {
    flexDirection: 'row',
    borderTopWidth: borders.thin, borderColor: colors.border,
  },
  statsCell: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, gap: 3 },
  statsCellVal: {
    color: colors.white, fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.black, fontVariant: ['tabular-nums'],
  },
  statsCellLabel: {
    color: colors.inactive, fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold, letterSpacing: typography.letterSpacing.wider,
  },
  statsDivider: { width: borders.thin, backgroundColor: colors.border },

  // ── Done button ────────────────────────────────────
  doneBtn: {
    backgroundColor: colors.primary,
    borderTopWidth: borders.thin, borderColor: '#000',
    paddingVertical: spacing.md,
    alignItems: 'center', justifyContent: 'center',
  },
  doneBtnText: {
    color: colors.white, fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider,
  },
});
