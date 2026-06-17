import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borders } from '../theme';

const { width: W } = Dimensions.get('window');

export default function CookSuccessScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { dishName, xpEarned, rankUpParams, inspiredByUsername, xpBreakdown } = route.params ?? {};

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(32)).current;
  const xpScale   = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(checkScale, { toValue: 1, friction: 5, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]),
      Animated.spring(xpScale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!rankUpParams) return;
    const t = setTimeout(() => navigation.navigate('RankUp', rankUpParams), 2200);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
      {/* Halftone */}
      <View style={styles.halftone} pointerEvents="none">
        {Array.from({ length: 48 }).map((_, i) => (
          <View key={i} style={styles.dot} />
        ))}
      </View>

      {/* Check badge */}
      <Animated.View style={[styles.checkWrap, { transform: [{ scale: checkScale }] }]}>
        <View style={styles.checkBadge}>
          <Ionicons name="checkmark" size={36} color={colors.background} />
        </View>
      </Animated.View>

      {/* Title + dish name */}
      <Animated.View style={[styles.titleBlock, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Text style={styles.title}>COOKED!</Text>
        <View style={styles.dishRow}>
          <View style={styles.dishAccent} />
          <Text style={styles.dishName} numberOfLines={2}>{dishName?.toUpperCase()}</Text>
        </View>
        <Text style={styles.subtitle}>Shared to the feed · pending verification</Text>
        {inspiredByUsername && (
          <View style={styles.inspiredAttribution}>
            <Ionicons name="link-outline" size={12} color={colors.inactive} />
            <Text style={styles.inspiredAttributionText}>Inspired by @{inspiredByUsername}</Text>
          </View>
        )}
      </Animated.View>

      {/* XP card */}
      <Animated.View style={[styles.xpCard, { transform: [{ scale: xpScale }] }]}>
        <View style={styles.xpInner}>
          <Ionicons name="star" size={20} color={colors.accent} />
          <Text style={styles.xpValue}>+{xpEarned}</Text>
          <Text style={styles.xpLabel}>XP EARNED</Text>
        </View>
        {xpBreakdown?.length > 0 && (
          <View style={styles.xpBreakdown}>
            {xpBreakdown.map((row, i) => (
              <View key={i} style={styles.xpBreakdownRow}>
                <Text style={styles.xpBreakdownLabel}>{row.label}</Text>
                <Text style={styles.xpBreakdownVal}>+{row.xp}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={styles.xpStripes} pointerEvents="none">
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={styles.xpStripe} />
          ))}
        </View>
      </Animated.View>

      {/* Verification status */}
      <Animated.View style={[styles.verifyCard, { opacity: fadeAnim }]}>
        <View style={styles.verifyRow}>
          <Ionicons name="time-outline" size={14} color={colors.success} />
          <Text style={styles.verifyText}>Cook time recorded</Text>
          <View style={[styles.verifyDot, { backgroundColor: colors.success }]} />
        </View>
        <View style={styles.verifyDivider} />
        <View style={styles.verifyRow}>
          <Ionicons name="scan-outline" size={14} color={colors.inactive} />
          <Text style={styles.verifyText}>AI verification</Text>
          <Text style={styles.verifyPending}>PENDING</Text>
        </View>
        <View style={styles.verifyDivider} />
        <View style={styles.verifyRow}>
          <Ionicons name="people-outline" size={14} color={colors.inactive} />
          <Text style={styles.verifyText}>Community votes open</Text>
          <View style={[styles.verifyDot, { backgroundColor: colors.accent }]} />
        </View>
      </Animated.View>

      <Animated.View style={[styles.btnBlock, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={styles.feedBtn}
          onPress={() => navigation.dispatch(CommonActions.reset({
            index: 0,
            routes: [{ name: 'MainTabs', params: { screen: 'Feed' } }],
          }))}
          activeOpacity={0.85}
        >
          <Ionicons name="grid" size={16} color={colors.white} />
          <Text style={styles.feedBtnText}>VIEW FEED</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.cookAgainBtn}
          onPress={() => navigation.dispatch(CommonActions.reset({
            index: 0,
            routes: [{ name: 'MainTabs', params: { screen: 'Cook' } }],
          }))}
          activeOpacity={0.8}
        >
          <Text style={styles.cookAgainText}>COOK AGAIN</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },

  halftone: {
    position: 'absolute', bottom: 0, right: 0,
    width: 200, height: 200,
    flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 16, opacity: 0.06,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },

  checkWrap: { alignItems: 'center' },
  checkBadge: {
    width: 80, height: 80,
    backgroundColor: colors.success,
    borderWidth: borders.medium, borderColor: '#000',
    alignItems: 'center', justifyContent: 'center',
  },

  titleBlock: { alignItems: 'center', gap: spacing.sm, width: '100%' },
  title: {
    color: colors.white,
    fontSize: 52,
    fontWeight: typography.fontWeight.black,
    letterSpacing: typography.letterSpacing.wider,
  },
  dishRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.sm, width: '100%', justifyContent: 'center',
  },
  dishAccent: { width: 4, height: 28, backgroundColor: colors.success },
  dishName: {
    color: colors.white,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.black,
    letterSpacing: typography.letterSpacing.wide,
    flex: 1,
  },
  subtitle: {
    color: colors.inactive,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  inspiredAttribution: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderWidth: borders.thin, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  inspiredAttributionText: { color: colors.inactive, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },

  xpCard: {
    width: '100%',
    backgroundColor: colors.accent,
    borderWidth: borders.medium, borderColor: '#000',
    overflow: 'hidden',
    position: 'relative',
  },
  xpInner: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.sm, padding: spacing.md,
    zIndex: 1,
  },
  xpValue: {
    color: colors.background,
    fontSize: 40,
    fontWeight: typography.fontWeight.black,
    letterSpacing: typography.letterSpacing.wide,
  },
  xpLabel: {
    color: colors.background,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.black,
    letterSpacing: typography.letterSpacing.wider,
    opacity: 0.7,
  },
  xpBreakdown: {
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
    gap: 3, zIndex: 1,
  },
  xpBreakdownRow: { flexDirection: 'row', justifyContent: 'space-between' },
  xpBreakdownLabel: {
    color: 'rgba(0,0,0,0.55)', fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold, letterSpacing: typography.letterSpacing.wide,
  },
  xpBreakdownVal: {
    color: colors.background, fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wide,
  },

  xpStripes: {
    position: 'absolute', top: -20, right: -20, bottom: -20, width: 120,
    flexDirection: 'row', gap: 8, transform: [{ rotate: '-20deg' }],
  },
  xpStripe: { width: 10, flex: 1, backgroundColor: colors.background, opacity: 0.12 },

  verifyCard: {
    width: '100%',
    borderWidth: borders.thin, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  verifyRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.sm, padding: spacing.sm,
  },
  verifyText: { flex: 1, color: colors.inactive, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },
  verifyPending: { color: colors.gold, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wide },
  verifyDot: { width: 8, height: 8, borderRadius: 4 },
  verifyDivider: { height: borders.thin, backgroundColor: colors.border },

  btnBlock: { width: '100%', gap: spacing.sm },
  feedBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: colors.primary,
    borderWidth: borders.medium, borderColor: '#000',
    paddingVertical: spacing.md,
  },
  feedBtnText: {
    color: colors.white, fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider,
  },
  cookAgainBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  cookAgainText: {
    color: colors.inactive, fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold, letterSpacing: typography.letterSpacing.wide,
  },
});
