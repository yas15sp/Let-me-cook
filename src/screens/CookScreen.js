import { View, Text, StyleSheet, TouchableOpacity, Dimensions, StatusBar, Animated } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, spacing, typography, borders } from '../theme';

const { width: W, height: H } = Dimensions.get('window');
const BRACKET = 28;
const BRACKET_THICK = 3;

const STAGES = ['PRE-COOK', 'MID-COOK', 'FINALE'];
const STAGE_HINTS = [
  'Set the scene — show your ingredients & workspace',
  'Action shot — capture the cook in progress',
  'The reveal — plate up & show your finished dish',
];

const BOOSTS = [
  { label: 'VIDEO', xp: 30, icon: 'videocam' },
  { label: 'SELFIE', xp: 15, icon: 'camera-reverse' },
  { label: 'CAPTION', xp: 10, icon: 'text' },
];

const USER = { rank: 'CHEF DE PARTIE', level: 12 };

function pad(n) { return String(n).padStart(2, '0'); }

function useStopwatch() {
  const [elapsed, setElapsed] = useState(0);
  const running = useRef(false);
  const interval = useRef(null);
  const start = () => {
    if (running.current) return;
    running.current = true;
    interval.current = setInterval(() => setElapsed(s => s + 1), 1000);
  };
  const reset = () => {
    running.current = false;
    clearInterval(interval.current);
    setElapsed(0);
  };
  useEffect(() => () => clearInterval(interval.current), []);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return { display: `${pad(mins)}:${pad(secs)}`, elapsed, start, reset };
}

function CornerBrackets() {
  return (
    <>
      {/* TL */}
      <View style={[styles.bracketCorner, { top: 0, left: 0 }]}>
        <View style={[styles.bracketH, { top: 0, left: 0 }]} />
        <View style={[styles.bracketV, { top: 0, left: 0 }]} />
      </View>
      {/* TR */}
      <View style={[styles.bracketCorner, { top: 0, right: 0 }]}>
        <View style={[styles.bracketH, { top: 0, right: 0 }]} />
        <View style={[styles.bracketV, { top: 0, right: 0 }]} />
      </View>
      {/* BL */}
      <View style={[styles.bracketCorner, { bottom: 0, left: 0 }]}>
        <View style={[styles.bracketH, { bottom: 0, left: 0 }]} />
        <View style={[styles.bracketV, { bottom: 0, left: 0 }]} />
      </View>
      {/* BR */}
      <View style={[styles.bracketCorner, { bottom: 0, right: 0 }]}>
        <View style={[styles.bracketH, { bottom: 0, right: 0 }]} />
        <View style={[styles.bracketV, { bottom: 0, right: 0 }]} />
      </View>
    </>
  );
}

function PhotoStrip({ captures }) {
  return (
    <View style={styles.photoStrip}>
      {STAGES.map((stage, i) => {
        const captured = captures[i];
        return (
          <View key={stage} style={[styles.photoSlot, captured && styles.photoSlotFilled]}>
            {captured ? (
              <View style={styles.photoThumb}>
                <Ionicons name="checkmark" size={14} color={colors.background} />
              </View>
            ) : (
              <Text style={styles.photoSlotNum}>{i + 1}</Text>
            )}
            <Text style={styles.photoSlotLabel}>{stage}</Text>
          </View>
        );
      })}
    </View>
  );
}

function IdleScreen({ onStart }) {
  return (
    <SafeAreaView style={styles.idleContainer} edges={['top', 'bottom']}>
      <View style={styles.idleInner}>
        <View style={styles.idleTitleRow}>
          <View style={styles.idleAccentBar} />
          <Text style={styles.idleTitle}>COOK{'\n'}SESSION</Text>
        </View>
        <Text style={styles.idleSubtitle}>
          Three stages. One dish.{'\n'}Prove you can cook.
        </Text>
        <View style={styles.idleStageList}>
          {STAGES.map((s, i) => (
            <View key={s} style={styles.idleStageRow}>
              <View style={styles.idleStageNum}>
                <Text style={styles.idleStageNumText}>{i + 1}</Text>
              </View>
              <View>
                <Text style={styles.idleStageName}>{s}</Text>
                <Text style={styles.idleStageHint}>{STAGE_HINTS[i]}</Text>
              </View>
            </View>
          ))}
        </View>
        <TouchableOpacity style={styles.startBtn} onPress={onStart} activeOpacity={0.85}>
          <Text style={styles.startBtnText}>START COOKING</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function ReviewScreen({ captures, elapsed, onShare, onDiscard }) {
  const insets = useSafeAreaInsets();
  const totalXP = 120;
  return (
    <View style={[styles.reviewContainer, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md }]}>
      <Text style={styles.reviewTitle}>AUTO-CLIP READY</Text>
      <View style={styles.reviewClip}>
        {STAGES.map((stage, i) => (
          <View key={stage} style={styles.reviewFrame}>
            <View style={styles.reviewFrameInner}>
              <Ionicons name="restaurant" size={32} color="#1e1e1e" />
            </View>
            <View style={styles.reviewWatermark}>
              <Text style={styles.reviewWatermarkRank}>{USER.rank}</Text>
              <Text style={styles.reviewWatermarkLevel}>LV{USER.level}</Text>
            </View>
            <Text style={styles.reviewFrameLabel}>{stage}</Text>
          </View>
        ))}
      </View>

      <View style={styles.reviewStats}>
        <View style={styles.reviewStat}>
          <Text style={styles.reviewStatVal}>{pad(Math.floor(elapsed / 60))}:{pad(elapsed % 60)}</Text>
          <Text style={styles.reviewStatLabel}>COOK TIME</Text>
        </View>
        <View style={styles.reviewStatDivider} />
        <View style={styles.reviewStat}>
          <Text style={[styles.reviewStatVal, { color: colors.accent }]}>+{totalXP}</Text>
          <Text style={styles.reviewStatLabel}>XP EARNED</Text>
        </View>
        <View style={styles.reviewStatDivider} />
        <View style={styles.reviewStat}>
          <View style={styles.reviewVerifyDot} />
          <Text style={styles.reviewStatLabel}>VERIFYING</Text>
        </View>
      </View>

      <View style={styles.reviewVerification}>
        <View style={styles.reviewVerifyRow}>
          <Ionicons name="scan" size={14} color={colors.inactive} />
          <Text style={styles.reviewVerifyText}>AI dish recognition</Text>
          <Text style={styles.reviewVerifyStatus}>PENDING</Text>
        </View>
        <View style={styles.reviewVerifyRow}>
          <Ionicons name="time" size={14} color={colors.inactive} />
          <Text style={styles.reviewVerifyText}>Timestamp window</Text>
          <Text style={[styles.reviewVerifyStatus, { color: colors.success }]}>PASSED</Text>
        </View>
        <View style={styles.reviewVerifyRow}>
          <Ionicons name="people" size={14} color={colors.inactive} />
          <Text style={styles.reviewVerifyText}>Community jury</Text>
          <Text style={styles.reviewVerifyStatus}>OPEN</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.shareBtn} onPress={onShare} activeOpacity={0.85}>
        <Ionicons name="share-social" size={18} color={colors.background} />
        <Text style={styles.shareBtnText}>SHARE TO FEED</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.discardBtn} onPress={onDiscard}>
        <Text style={styles.discardBtnText}>DISCARD</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function CookScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState('idle'); // idle | session | review
  const [stage, setStage] = useState(0);
  const [captures, setCaptures] = useState([false, false, false]);
  const [activeBoosts, setActiveBoosts] = useState([]);
  const shutterScale = useRef(new Animated.Value(1)).current;
  const stopwatch = useStopwatch();
  const cameraRef = useRef(null);
  const insets = useSafeAreaInsets();

  const handleStart = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) return;
    }
    setPhase('session');
    stopwatch.start();
  };

  const animateShutter = () => {
    Animated.sequence([
      Animated.timing(shutterScale, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.timing(shutterScale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  const handleCapture = async () => {
    animateShutter();
    const next = captures.map((c, i) => i === stage ? true : c);
    setCaptures(next);
    if (stage < 2) {
      setStage(s => s + 1);
    } else {
      setPhase('review');
    }
  };

  const toggleBoost = (label) => {
    setActiveBoosts(prev =>
      prev.includes(label) ? prev.filter(b => b !== label) : [...prev, label]
    );
  };

  const handleDiscard = () => {
    setPhase('idle');
    setStage(0);
    setCaptures([false, false, false]);
    setActiveBoosts([]);
    stopwatch.reset();
  };

  if (phase === 'idle') return <IdleScreen onStart={handleStart} />;

  const handleShare = () => {
    handleDiscard();
    navigation.navigate('RankUp', {
      fromRank: 'Gold Cook',
      fromLevel: 'II',
      toRank: 'Chef',
      toLevel: 'I',
      xpEarned: 240,
    });
  };

  if (phase === 'review') {
    return (
      <ReviewScreen
        captures={captures}
        elapsed={stopwatch.elapsed}
        onShare={handleShare}
        onDiscard={handleDiscard}
      />
    );
  }

  // session — full screen camera
  const viewfinderPad = 48;
  return (
    <View style={styles.sessionContainer}>
      <StatusBar barStyle="light-content" />
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      {/* Dim overlay */}
      <View style={styles.sessionDim} />

      {/* Viewfinder */}
      <View style={[styles.viewfinder, { top: insets.top + 80, bottom: 220, left: viewfinderPad, right: viewfinderPad }]}>
        <CornerBrackets />
      </View>

      {/* Top HUD */}
      <View style={[styles.topHud, { top: insets.top + spacing.md }]}>
        <TouchableOpacity style={styles.exitBtn} onPress={handleDiscard}>
          <Ionicons name="close" size={20} color={colors.white} />
        </TouchableOpacity>
        <View style={styles.timerBox}>
          <Text style={styles.timerText}>{stopwatch.display}</Text>
        </View>
        <View style={styles.stageIndicator}>
          {STAGES.map((s, i) => (
            <View key={s} style={[styles.stageDot, i === stage && styles.stageDotActive, i < stage && styles.stageDotDone]} />
          ))}
        </View>
      </View>

      {/* Stage label */}
      <View style={[styles.stageLabelBox, { top: insets.top + 52 }]}>
        <View style={styles.stagePill}>
          <Text style={styles.stagePillText}>{STAGES[stage]}</Text>
        </View>
        <Text style={styles.stageHintText}>{STAGE_HINTS[stage]}</Text>
      </View>

      {/* Bottom controls */}
      <View style={[styles.bottomControls, { paddingBottom: insets.bottom + spacing.md }]}>
        {/* Boost strip */}
        <View style={styles.boostStrip}>
          {BOOSTS.map(b => {
            const active = activeBoosts.includes(b.label);
            return (
              <TouchableOpacity
                key={b.label}
                style={[styles.boostBtn, active && styles.boostBtnActive]}
                onPress={() => toggleBoost(b.label)}
                activeOpacity={0.8}
              >
                <Ionicons name={b.icon} size={14} color={active ? colors.background : colors.accent} />
                <Text style={[styles.boostLabel, active && { color: colors.background }]}>{b.label}</Text>
                <Text style={[styles.boostXP, active && { color: colors.background }]}>+{b.xp} XP</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Photo strip + shutter row */}
        <View style={styles.captureRow}>
          <PhotoStrip captures={captures} />
          <Animated.View style={{ transform: [{ scale: shutterScale }] }}>
            <TouchableOpacity style={styles.shutterBtn} onPress={handleCapture} activeOpacity={1}>
              <View style={styles.shutterInner} />
            </TouchableOpacity>
          </Animated.View>
          <View style={styles.captureRowSpacer} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Idle ──────────────────────────────────────────
  idleContainer: { flex: 1, backgroundColor: colors.background },
  idleInner: { flex: 1, padding: spacing.md, justifyContent: 'center' },
  idleTitleRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: spacing.lg },
  idleAccentBar: { width: 6, height: 70, backgroundColor: colors.primary, marginRight: spacing.md },
  idleTitle: { color: colors.white, fontSize: 44, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider, lineHeight: 46 },
  idleSubtitle: { color: colors.inactive, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold, marginBottom: spacing.xl, lineHeight: 22 },
  idleStageList: { marginBottom: spacing.xl, gap: spacing.md },
  idleStageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  idleStageNum: { width: 28, height: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  idleStageNumText: { color: colors.white, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.black },
  idleStageName: { color: colors.white, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  idleStageHint: { color: colors.inactive, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, lineHeight: 18 },
  startBtn: { backgroundColor: colors.primary, borderWidth: borders.medium, borderColor: colors.border, paddingVertical: spacing.md, alignItems: 'center' },
  startBtnText: { color: colors.white, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },

  // ── Session ───────────────────────────────────────
  sessionContainer: { flex: 1, backgroundColor: '#000' },
  sessionDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },

  // Viewfinder brackets
  viewfinder: { position: 'absolute' },
  bracketCorner: { position: 'absolute', width: BRACKET, height: BRACKET },
  bracketH: { position: 'absolute', width: BRACKET, height: BRACKET_THICK, backgroundColor: colors.accent },
  bracketV: { position: 'absolute', width: BRACKET_THICK, height: BRACKET, backgroundColor: colors.accent },

  // Top HUD
  topHud: { position: 'absolute', left: spacing.md, right: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  exitBtn: { width: 38, height: 38, backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: borders.thin, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  timerBox: { backgroundColor: 'rgba(0,0,0,0.7)', borderWidth: borders.thin, borderColor: colors.accent, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  timerText: { color: colors.accent, fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.black, fontVariant: ['tabular-nums'] },
  stageIndicator: { flexDirection: 'row', gap: spacing.xs },
  stageDot: { width: 8, height: 8, backgroundColor: colors.inactive },
  stageDotActive: { backgroundColor: colors.accent, width: 20 },
  stageDotDone: { backgroundColor: colors.success },

  // Stage label
  stageLabelBox: { position: 'absolute', left: spacing.md, right: spacing.md, alignItems: 'center', gap: spacing.xs },
  stagePill: { backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  stagePillText: { color: colors.white, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  stageHintText: { color: 'rgba(255,255,255,0.6)', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, textAlign: 'center' },

  // Bottom controls
  bottomControls: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: spacing.md, gap: spacing.sm },
  boostStrip: { flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' },
  boostBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderWidth: borders.thin, borderColor: colors.accent, paddingHorizontal: spacing.sm, paddingVertical: 6, backgroundColor: 'rgba(0,0,0,0.7)' },
  boostBtnActive: { backgroundColor: colors.accent },
  boostLabel: { color: colors.accent, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wide },
  boostXP: { color: colors.accent, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },

  captureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  captureRowSpacer: { width: 72 },

  // Photo strip
  photoStrip: { flexDirection: 'row', gap: spacing.xs },
  photoSlot: { width: 52, height: 68, borderWidth: borders.thin, borderColor: colors.border, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', gap: 4 },
  photoSlotFilled: { borderColor: colors.success },
  photoThumb: { width: 32, height: 32, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  photoSlotNum: { color: colors.inactive, fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.black },
  photoSlotLabel: { color: colors.inactive, fontSize: 8, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wide, textAlign: 'center' },

  // Shutter
  shutterBtn: { width: 72, height: 72, borderRadius: 36, borderWidth: borders.thick, borderColor: colors.white, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },

  // ── Review ────────────────────────────────────────
  reviewContainer: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  reviewTitle: { color: colors.white, fontSize: typography.fontSize.xxl, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider, marginBottom: spacing.lg },
  reviewClip: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.lg },
  reviewFrame: { flex: 1, aspectRatio: 0.75, backgroundColor: colors.surface, borderWidth: borders.thin, borderColor: colors.border, overflow: 'hidden', position: 'relative' },
  reviewFrameInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  reviewWatermark: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(232,0,28,0.9)', padding: 4, alignItems: 'center' },
  reviewWatermarkRank: { color: colors.white, fontSize: 7, fontWeight: typography.fontWeight.black, letterSpacing: 1 },
  reviewWatermarkLevel: { color: colors.accent, fontSize: 8, fontWeight: typography.fontWeight.black },
  reviewFrameLabel: { position: 'absolute', top: spacing.xs, left: spacing.xs, color: colors.white, fontSize: 8, fontWeight: typography.fontWeight.black, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 4, paddingVertical: 2 },

  reviewStats: { flexDirection: 'row', borderWidth: borders.thin, borderColor: colors.border, marginBottom: spacing.md },
  reviewStat: { flex: 1, alignItems: 'center', padding: spacing.sm, gap: 2 },
  reviewStatVal: { color: colors.white, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.black },
  reviewStatLabel: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold, letterSpacing: typography.letterSpacing.wider },
  reviewStatDivider: { width: borders.thin, backgroundColor: colors.border },
  reviewVerifyDot: { width: 10, height: 10, backgroundColor: colors.gold, borderRadius: 5 },

  reviewVerification: { borderWidth: borders.thin, borderColor: colors.border, padding: spacing.sm, marginBottom: spacing.lg, gap: spacing.sm },
  reviewVerifyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reviewVerifyText: { flex: 1, color: colors.inactive, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },
  reviewVerifyStatus: { color: colors.gold, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wide },

  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, borderWidth: borders.thin, borderColor: colors.border, paddingVertical: spacing.md, marginBottom: spacing.sm },
  shareBtnText: { color: colors.white, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  discardBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  discardBtnText: { color: colors.inactive, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, letterSpacing: typography.letterSpacing.wide },
});
