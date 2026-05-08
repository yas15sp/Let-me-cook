import React, { useEffect, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, Dimensions, TouchableOpacity,
  StatusBar, Animated, Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

const { width: W, height: H } = Dimensions.get('window');

// ─── Rank data ────────────────────────────────────────────────────────────────

const RANK_CONFIG = {
  'Gold Cook':         { color: '#FFB800', word: 'SIZZLE!',      tier: 0 },
  'Emerald Cook':      { color: '#00C47A', word: 'CRISPY!',      tier: 1 },
  'Diamond Cook':      { color: '#88CCFF', word: 'FLAWLESS!',    tier: 2 },
  'Chef':              { color: '#E8001C', word: 'CHEF UP!',     tier: 3 },
  'Exec Chef':         { color: '#A855F7', word: 'ELITE!',       tier: 4 },
  'Master Chef':       { color: '#FF6B00', word: 'LEGENDARY!',   tier: 5 },
  'World Class Chef':  { color: '#E8C840', word: 'WORLD CLASS!', tier: 6 },
};

const CONFETTI_COLORS = ['#E8001C', '#FFE500', '#00C47A', '#88CCFF', '#A855F7', '#FF6B00', '#FFF'];

// ─── Sub-components ───────────────────────────────────────────────────────────

function HalftoneBackground({ opacity }) {
  const dots = useMemo(() => {
    const GAP = 44;
    const out = [];
    const cols = Math.ceil(W / GAP) + 1;
    const rows = Math.ceil(H / GAP) + 1;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        out.push({ key: `${r}-${c}`, x: c * GAP, y: r * GAP });
    return out;
  }, []);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      {dots.map(({ key, x, y }) => (
        <View key={key} style={{
          position: 'absolute', width: 3, height: 3, borderRadius: 1.5,
          backgroundColor: 'rgba(255,255,255,0.07)', left: x, top: y,
        }} />
      ))}
    </Animated.View>
  );
}

function SpeedLines({ opacity }) {
  const LINE_LEN = Math.max(W, H) * 1.6;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      {Array.from({ length: 18 }).map((_, i) => (
        <View key={i} style={{
          position: 'absolute',
          width: i % 3 === 0 ? 2 : 1,
          height: LINE_LEN,
          left: W / 2 - (i % 3 === 0 ? 1 : 0.5),
          top: H / 2 - LINE_LEN / 2,
          backgroundColor: `rgba(255,255,255,${i % 3 === 0 ? 0.22 : 0.09})`,
          transform: [{ rotate: `${(i / 18) * 360}deg` }],
        }} />
      ))}
    </Animated.View>
  );
}

function DrippyOverlay({ rankColor, translateY }) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, {
        top: -H * 0.12, height: H * 0.62,
        backgroundColor: rankColor + '22',
        borderBottomLeftRadius: W * 0.55,
        borderBottomRightRadius: W * 0.55,
        transform: [{ translateY }],
      }]}
    />
  );
}

function ConfettiPiece({ index, start }) {
  const cfg = useRef({
    dx: (Math.random() - 0.5) * W * 1.3,
    dy: H * 0.35 + Math.random() * H * 0.55,
    delay: 3500 + Math.random() * 700,
    dur: 1400 + Math.random() * 900,
    color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    w: 5 + Math.random() * 7,
    h: 3 + Math.random() * 4,
    rot: (Math.random() - 0.5) * 580,
  }).current;

  const x   = useRef(new Animated.Value(0)).current;
  const y   = useRef(new Animated.Value(0)).current;
  const op  = useRef(new Animated.Value(0)).current;
  const rot = useRef(new Animated.Value(0)).current;

  const rotInterp = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${cfg.rot}deg`] });

  useEffect(() => {
    if (!start) return;
    Animated.parallel([
      Animated.sequence([
        Animated.delay(cfg.delay),
        Animated.timing(x, { toValue: cfg.dx, duration: cfg.dur, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(cfg.delay),
        Animated.timing(y, { toValue: cfg.dy, duration: cfg.dur, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(cfg.delay),
        Animated.timing(op, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(op, { toValue: 1, duration: cfg.dur - 260, useNativeDriver: true }),
        Animated.timing(op, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(cfg.delay),
        Animated.timing(rot, { toValue: 1, duration: cfg.dur, useNativeDriver: true }),
      ]),
    ]).start();
  }, [start]);

  return (
    <Animated.View style={[{
      position: 'absolute', left: W / 2, top: H * 0.45,
      width: cfg.w, height: cfg.h, borderRadius: 1,
      backgroundColor: cfg.color,
    }, { opacity: op, transform: [{ translateX: x }, { translateY: y }, { rotate: rotInterp }] }]} />
  );
}

function PanShape({ rankColor }) {
  return (
    <View style={styles.pan}>
      <View style={[styles.panBowl, { borderColor: rankColor }]}>
        <View style={styles.panBowlInner} />
        <View style={styles.panReflect} />
      </View>
      <View style={styles.panShaft}>
        <View style={[styles.panCap, { backgroundColor: rankColor }]} />
      </View>
    </View>
  );
}

function RankBadge({ rankName, level, rankColor, size = 'large' }) {
  const dim = size === 'large' ? 148 : 96;
  const isWC = rankName === 'World Class Chef';
  return (
    <View style={[styles.badge, {
      width: dim, height: dim, borderRadius: dim / 2,
      borderColor: rankColor, backgroundColor: rankColor + '18',
    }]}>
      <View style={[styles.badgeInner, {
        width: dim - 16, height: dim - 16, borderRadius: (dim - 16) / 2, borderColor: rankColor + '50',
      }]}>
        {isWC
          ? <Text style={{ fontSize: size === 'large' ? 38 : 24, marginBottom: 4 }}>💎</Text>
          : <Text style={[styles.badgeLevel, { color: rankColor, fontSize: size === 'large' ? 30 : 20 }]}>{level}</Text>
        }
        <Text style={[styles.badgeName, { color: rankColor, fontSize: size === 'large' ? 9 : 7 }]} numberOfLines={2}>
          {rankName.toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function RankUpScreen({ route, navigation }) {
  const {
    fromRank = 'Gold Cook', fromLevel = 'II',
    toRank   = 'Chef',      toLevel   = 'I',
    xpEarned = 240,
  } = route?.params ?? {};

  const insets   = useSafeAreaInsets();
  const cfg      = RANK_CONFIG[toRank]   ?? RANK_CONFIG['Chef'];
  const fromCfg  = RANK_CONFIG[fromRank] ?? RANK_CONFIG['Gold Cook'];
  const rankColor   = cfg.color;
  const isChefPlus  = cfg.tier >= 3;
  const isExecPlus  = cfg.tier >= 4;
  const isWorldClass = cfg.tier === 6;
  const confettiCount = isWorldClass ? 50 : isExecPlus ? 22 : 0;

  // ── Animated Values ───────────────────────────────────────────────────────
  const dotsOp      = useRef(new Animated.Value(0)).current;
  const speedLinesOp = useRef(new Animated.Value(0)).current;

  const oldBadgeOp  = useRef(new Animated.Value(0)).current;
  const oldBadgeY   = useRef(new Animated.Value(0)).current;
  const oldBadgeSc  = useRef(new Animated.Value(1)).current;
  const oldBadgeRotVal = useRef(new Animated.Value(0)).current;
  const oldBadgeRot = oldBadgeRotVal.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '46deg'] });

  const panX       = useRef(new Animated.Value(W + 140)).current;
  const panRotVal  = useRef(new Animated.Value(0)).current;
  const panRot     = panRotVal.interpolate({ inputRange: [-13, 0, 2], outputRange: ['-13deg', '0deg', '2deg'] });

  const bgOp       = useRef(new Animated.Value(0)).current;
  const flashOp    = useRef(new Animated.Value(0)).current;
  const flash2Op   = useRef(new Animated.Value(0)).current;

  const comicSc    = useRef(new Animated.Value(0)).current;
  const comicOp    = useRef(new Animated.Value(0)).current;

  const newBadgeSc = useRef(new Animated.Value(0)).current;
  const newBadgeOp = useRef(new Animated.Value(0)).current;

  const xpOp       = useRef(new Animated.Value(0)).current;
  const xpY        = useRef(new Animated.Value(22)).current;

  const ctaOp      = useRef(new Animated.Value(0)).current;
  const ctaY       = useRef(new Animated.Value(88)).current;

  const dripY      = useRef(new Animated.Value(-H * 0.5)).current;

  const [confettiStarted, setConfettiStarted] = React.useState(false);

  useEffect(() => {
    const T = (val, toValue, duration, delay = 0, easing) => Animated.sequence([
      ...(delay > 0 ? [Animated.delay(delay)] : []),
      Animated.timing(val, { toValue, duration, ...(easing ? { easing } : {}), useNativeDriver: true }),
    ]);

    const S = (val, toValue, delay = 0, config = {}) => Animated.sequence([
      ...(delay > 0 ? [Animated.delay(delay)] : []),
      Animated.spring(val, { toValue, ...config, useNativeDriver: true }),
    ]);

    Animated.parallel([
      // ① Halftone dots
      T(dotsOp, 1, 400, 800),

      // ② Speed lines flash
      Animated.sequence([
        Animated.delay(1700),
        Animated.timing(speedLinesOp, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(speedLinesOp, { toValue: 0, duration: 380, useNativeDriver: true }),
      ]),

      // ③ Old badge: appear → toss away
      Animated.sequence([
        Animated.delay(200),
        Animated.timing(oldBadgeOp, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.delay(480),
        Animated.timing(oldBadgeOp, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]),
      T(oldBadgeY,      190, 270, 1000, Easing.in(Easing.quad)),
      T(oldBadgeSc,    0.18, 270, 1000),
      T(oldBadgeRotVal,   1, 270, 1000),

      // ④ Pan: slide in → catch tilt → exit
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(panX, { toValue: -18, duration: 420, easing: Easing.out(Easing.back(1.3)), useNativeDriver: true }),
        Animated.delay(900),
        Animated.timing(panX, { toValue: W + 160, duration: 340, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(1260),
        Animated.timing(panRotVal, { toValue: -13, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(panRotVal, { toValue: 2,   duration: 100, useNativeDriver: true }),
        Animated.spring(panRotVal,  { toValue: 0, damping: 10, stiffness: 240, useNativeDriver: true }),
      ]),

      // ⑤ Background colour flood
      T(bgOp, 1, 550, 1400, Easing.out(Easing.cubic)),

      // ⑥ White flash
      Animated.sequence([
        Animated.delay(1620),
        Animated.timing(flashOp, { toValue: 0.88, duration: 75,  useNativeDriver: true }),
        Animated.timing(flashOp, { toValue: 0,    duration: 320, useNativeDriver: true }),
      ]),

      // World Class second gold flash
      ...(isWorldClass ? [Animated.sequence([
        Animated.delay(1860),
        Animated.timing(flash2Op, { toValue: 0.65, duration: 80,  useNativeDriver: true }),
        Animated.timing(flash2Op, { toValue: 0,    duration: 360, useNativeDriver: true }),
      ])] : []),

      // ⑦ Comic word burst
      Animated.sequence([
        Animated.delay(2020),
        Animated.timing(comicOp, { toValue: 1, duration: 40,  useNativeDriver: true }),
        Animated.timing(comicOp, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(comicOp, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]),
      S(comicSc, 1, 2020, { damping: 7, stiffness: 210 }),

      // ⑧ New rank badge
      T(newBadgeOp, 1, 250, 2580),
      S(newBadgeSc, 1, 2580, { damping: 10, stiffness: 160 }),

      // ⑨ XP badge
      T(xpOp, 1, 240, 3060),
      S(xpY,  0, 3060, { damping: 14, stiffness: 180 }),

      // ⑩ CTA tray
      T(ctaOp, 1, 300, 3820),
      S(ctaY,  0, 3820, { damping: 13, stiffness: 160 }),

      // ⑪ Drip (Chef+)
      ...(isChefPlus ? [T(dripY, 0, 700, 2700, Easing.out(Easing.cubic))] : []),

    ]).start();

    // Confetti trigger
    if (isExecPlus) {
      setTimeout(() => setConfettiStarted(true), 3500);
    }
  }, []);

  const handleKeepCooking = () => navigation.goBack();
  const handleViewRank    = () => { navigation.goBack(); navigation.getParent()?.navigate('Profile'); };

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      <HalftoneBackground opacity={dotsOp} />

      {/* Rank colour flood */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { opacity: bgOp, backgroundColor: rankColor + '2A' }]}
      />

      {/* White flash */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: '#fff', opacity: flashOp }]}
      />

      {/* World Class gold flash */}
      {isWorldClass && (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: rankColor, opacity: flash2Op }]}
        />
      )}

      <SpeedLines opacity={speedLinesOp} />

      {isChefPlus && <DrippyOverlay rankColor={rankColor} translateY={dripY} />}

      {/* Confetti */}
      {isExecPlus && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {Array.from({ length: confettiCount }).map((_, i) => (
            <ConfettiPiece key={i} index={i} start={confettiStarted} />
          ))}
        </View>
      )}

      {/* Old badge */}
      <Animated.View style={[styles.oldBadgeArea, {
        opacity: oldBadgeOp,
        transform: [{ translateY: oldBadgeY }, { rotate: oldBadgeRot }, { scale: oldBadgeSc }],
      }]}>
        <Text style={styles.prevLabel}>PREVIOUS RANK</Text>
        <RankBadge rankName={fromRank} level={fromLevel} rankColor={fromCfg.color} size="small" />
      </Animated.View>

      {/* Pan */}
      <Animated.View style={[styles.panArea, {
        transform: [{ translateX: panX }, { rotate: panRot }],
      }]}>
        <PanShape rankColor={rankColor} />
      </Animated.View>

      {/* Comic word */}
      <Animated.View style={[styles.comicArea, { opacity: comicOp, transform: [{ scale: comicSc }] }]} pointerEvents="none">
        <Text style={[styles.comicWord, { color: rankColor }]}>{cfg.word}</Text>
        <View style={[styles.comicUnderline, { backgroundColor: rankColor }]} />
      </Animated.View>

      {/* New rank + XP */}
      <View style={styles.newBadgeArea}>
        <Animated.View style={{ opacity: xpOp, transform: [{ translateY: xpY }] }}>
          <View style={[styles.xpBadge, { borderColor: rankColor }]}>
            <Text style={[styles.xpBadgeText, { color: rankColor }]}>+{xpEarned} XP</Text>
          </View>
        </Animated.View>
        <Animated.View style={{ opacity: newBadgeOp, transform: [{ scale: newBadgeSc }], alignItems: 'center' }}>
          <RankBadge rankName={toRank} level={isWorldClass ? null : toLevel} rankColor={rankColor} size="large" />
          <Text style={[styles.rankUpBanner, { color: rankColor }]}>RANK UP!</Text>
          <Text style={styles.newRankLabel}>
            {toRank.toUpperCase()}{!isWorldClass ? ` · LEVEL ${toLevel}` : ''}
          </Text>
        </Animated.View>
      </View>

      {/* CTA */}
      <Animated.View style={[styles.ctaTray, { paddingBottom: insets.bottom + 16, opacity: ctaOp, transform: [{ translateY: ctaY }] }]}>
        <TouchableOpacity style={[styles.ctaPrimary, { backgroundColor: rankColor, borderColor: rankColor }]} onPress={handleKeepCooking} activeOpacity={0.85}>
          <Text style={styles.ctaPrimaryText}>KEEP COOKING</Text>
        </TouchableOpacity>
        <View style={styles.ctaRow}>
          <TouchableOpacity style={styles.ctaSecondary} onPress={handleViewRank} activeOpacity={0.8}>
            <Text style={styles.ctaSecondaryText}>VIEW RANK</Text>
          </TouchableOpacity>
          <View style={styles.ctaDivider} />
          <TouchableOpacity style={styles.ctaSecondary} onPress={handleKeepCooking} activeOpacity={0.8}>
            <Text style={styles.ctaSecondaryText}>SHARE CLIP</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  oldBadgeArea: {
    position: 'absolute', top: H * 0.10, left: 0, right: 0,
    alignItems: 'center', gap: 8,
  },
  prevLabel: { color: colors.inactive, fontSize: 10, fontWeight: '700', letterSpacing: 2 },

  panArea: { position: 'absolute', top: H * 0.35, left: 0, right: 0, alignItems: 'center' },
  pan: { flexDirection: 'row', alignItems: 'center' },
  panBowl: {
    width: 132, height: 92, borderRadius: 46, borderWidth: 4,
    backgroundColor: '#1c1c1c', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  panBowlInner: { width: 100, height: 68, borderRadius: 36, backgroundColor: '#252525' },
  panReflect: {
    position: 'absolute', top: 10, left: 18, width: 28, height: 12,
    borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.07)',
  },
  panShaft: {
    width: 108, height: 15, backgroundColor: '#2c2c2c', borderRadius: 8, marginLeft: -3,
    justifyContent: 'flex-end', flexDirection: 'row', alignItems: 'center',
  },
  panCap: { width: 16, height: 15, borderRadius: 8 },

  comicArea: { position: 'absolute', top: H * 0.22, left: 0, right: 0, alignItems: 'center' },
  comicWord: { fontSize: 52, fontWeight: '900', letterSpacing: -1 },
  comicUnderline: { width: '65%', height: 4, marginTop: -2 },

  badge: { borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  badgeInner: { borderWidth: 2, alignItems: 'center', justifyContent: 'center', gap: 4, padding: 6 },
  badgeLevel: { fontWeight: '900', letterSpacing: -1 },
  badgeName: { fontWeight: '900', letterSpacing: 1.2, textAlign: 'center' },

  newBadgeArea: {
    position: 'absolute', top: H * 0.36, left: 0, right: 0,
    alignItems: 'center', gap: 6,
  },
  xpBadge: { borderWidth: 2, paddingHorizontal: 16, paddingVertical: 5, backgroundColor: colors.background, marginBottom: 4 },
  xpBadgeText: { fontSize: 14, fontWeight: '900', letterSpacing: 2 },
  rankUpBanner: { fontSize: 12, fontWeight: '900', letterSpacing: 4, marginTop: 10 },
  newRankLabel: { color: colors.inactive, fontSize: 10, fontWeight: '700', letterSpacing: 2, marginTop: 2 },

  ctaTray: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, gap: 10 },
  ctaPrimary: { paddingVertical: 16, alignItems: 'center', borderWidth: 2 },
  ctaPrimaryText: { color: colors.background, fontSize: 15, fontWeight: '900', letterSpacing: 3 },
  ctaRow: { flexDirection: 'row', borderWidth: 2, borderColor: colors.border },
  ctaSecondary: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  ctaSecondaryText: { color: colors.inactive, fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  ctaDivider: { width: 2, backgroundColor: colors.border },
});
