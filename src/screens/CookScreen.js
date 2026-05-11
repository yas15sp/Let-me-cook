import { View, Text, StyleSheet, TouchableOpacity, Dimensions, StatusBar, Animated } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, spacing, typography, borders } from '../theme';

const { width: W } = Dimensions.get('window');
const BRACKET = 28;
const BRACKET_THICK = 3;
const MAX_VIDEO_SECS = 30;

const STAGES = ['PRE-COOK', 'MID-COOK', 'FINALE'];
const STAGE_HINTS = [
  'Set the scene — show your ingredients & workspace',
  'Action shot — capture the cook in progress',
  'The reveal — plate up & show your finished dish',
];

const BOOSTS = [
  { label: 'SELFIE', xp: 15, icon: 'camera-reverse' },
  { label: 'CAPTION', xp: 10, icon: 'text' },
];

const USER = { rank: 'Chef', level: 12, rankColor: '#E8001C' };

function pad(n) { return String(n).padStart(2, '0'); }

// ─── Stopwatch ────────────────────────────────────────────────────────────────

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

// ─── Corner brackets ──────────────────────────────────────────────────────────

function CornerBrackets() {
  return (
    <>
      <View style={[styles.bracketCorner, { top: 0, left: 0 }]}>
        <View style={[styles.bracketH, { top: 0, left: 0 }]} />
        <View style={[styles.bracketV, { top: 0, left: 0 }]} />
      </View>
      <View style={[styles.bracketCorner, { top: 0, right: 0 }]}>
        <View style={[styles.bracketH, { top: 0, right: 0 }]} />
        <View style={[styles.bracketV, { top: 0, right: 0 }]} />
      </View>
      <View style={[styles.bracketCorner, { bottom: 0, left: 0 }]}>
        <View style={[styles.bracketH, { bottom: 0, left: 0 }]} />
        <View style={[styles.bracketV, { bottom: 0, left: 0 }]} />
      </View>
      <View style={[styles.bracketCorner, { bottom: 0, right: 0 }]}>
        <View style={[styles.bracketH, { bottom: 0, right: 0 }]} />
        <View style={[styles.bracketV, { bottom: 0, right: 0 }]} />
      </View>
    </>
  );
}

// ─── Photo strip ──────────────────────────────────────────────────────────────

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

// ─── Idle screen ──────────────────────────────────────────────────────────────

function IdleScreen({ onStart }) {
  return (
    <SafeAreaView style={styles.idleContainer} edges={['top', 'bottom']}>
      <View style={styles.idleHalftone} pointerEvents="none">
        {Array.from({ length: 40 }).map((_, i) => (
          <View key={i} style={styles.idleHalftoneDot} />
        ))}
      </View>

      <View style={styles.idleInner}>
        <View style={styles.idleRankRow}>
          <View style={[styles.idleRankChip, { borderColor: USER.rankColor }]}>
            <Text style={[styles.idleRankChipText, { color: USER.rankColor }]}>{USER.rank}</Text>
          </View>
          <View style={styles.idleLevelChip}>
            <Text style={styles.idleLevelText}>LV{USER.level}</Text>
          </View>
        </View>

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
              <View style={{ flex: 1 }}>
                <Text style={styles.idleStageName}>{s}</Text>
                <Text style={styles.idleStageHint}>{STAGE_HINTS[i]}</Text>
              </View>
            </View>
          ))}
          {/* Video stage */}
          <View style={styles.idleStageRow}>
            <View style={[styles.idleStageNum, { backgroundColor: colors.accent }]}>
              <Ionicons name="videocam" size={14} color={colors.background} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.idleStageName}>VIDEO CLIP <Text style={styles.idleOptional}>optional</Text></Text>
              <Text style={styles.idleStageHint}>Record a short clip after your shots for +30 XP</Text>
            </View>
          </View>
        </View>

        <View style={styles.idleXpRow}>
          <Ionicons name="star" size={12} color={colors.accent} />
          <Text style={styles.idleXpText}>Base cook earns</Text>
          <Text style={styles.idleXpValue}>+120 XP</Text>
          <Text style={styles.idleXpText}>· boosts</Text>
          <Text style={styles.idleXpValue}>+25 XP</Text>
          <Text style={styles.idleXpText}>· video clip</Text>
          <Text style={styles.idleXpValue}>+30 XP</Text>
        </View>

        <TouchableOpacity style={styles.startBtn} onPress={onStart} activeOpacity={0.85}>
          <Ionicons name="flame" size={18} color={colors.white} />
          <Text style={styles.startBtnText}>START COOKING</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Video capture overlay ────────────────────────────────────────────────────

function VideoOverlay({ cameraRef, insets, onRecorded, onSkip }) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.2, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  // Auto-stop at MAX_VIDEO_SECS
  useEffect(() => {
    if (seconds >= MAX_VIDEO_SECS && isRecording) {
      cameraRef.current?.stopRecording();
    }
  }, [seconds, isRecording]);

  const handleRecord = async () => {
    if (isRecording) {
      cameraRef.current?.stopRecording();
      return;
    }
    setIsRecording(true);
    setSeconds(0);
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: MAX_VIDEO_SECS * 1000,
      useNativeDriver: false,
    }).start();
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);

    try {
      const result = await cameraRef.current?.recordAsync({ maxDuration: MAX_VIDEO_SECS });
      clearInterval(timerRef.current);
      progressAnim.stopAnimation();
      setIsRecording(false);
      onRecorded(result?.uri ?? null);
    } catch {
      clearInterval(timerRef.current);
      progressAnim.stopAnimation();
      setIsRecording(false);
      onSkip();
    }
  };

  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={[styles.videoOverlay, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md }]}>
      {/* Top info */}
      {isRecording ? (
        <View style={styles.recRow}>
          <Animated.View style={[styles.recDot, { opacity: pulseAnim }]} />
          <Text style={styles.recText}>REC</Text>
          <Text style={styles.recTimer}>{pad(Math.floor(seconds / 60))}:{pad(seconds % 60)}</Text>
          <Text style={styles.recMax}>/ 00:{pad(MAX_VIDEO_SECS)}</Text>
        </View>
      ) : (
        <View style={styles.videoTitleBox}>
          <View style={styles.videoOptionalTag}>
            <Text style={styles.videoOptionalTagText}>OPTIONAL</Text>
          </View>
          <Text style={styles.videoTitle}>RECORD YOUR CLIP</Text>
          <Text style={styles.videoSubtitle}>Up to {MAX_VIDEO_SECS}s · earns +30 XP boost</Text>
        </View>
      )}

      <View style={{ flex: 1 }} />

      {/* Record button */}
      <TouchableOpacity onPress={handleRecord} activeOpacity={0.85}>
        <View style={[styles.videoRecordRing, isRecording && styles.videoRecordRingActive]}>
          {isRecording
            ? <View style={styles.videoStopIcon} />
            : <View style={styles.videoRecordIcon} />
          }
        </View>
      </TouchableOpacity>
      <Text style={styles.videoHint}>{isRecording ? 'TAP TO STOP' : 'TAP TO RECORD'}</Text>

      {/* Progress bar */}
      <View style={styles.videoProgressTrack}>
        <Animated.View style={[styles.videoProgressFill, { width: progressWidth }]} />
      </View>

      <View style={{ height: spacing.lg }} />

      {/* Skip — hidden while recording */}
      {!isRecording && (
        <TouchableOpacity style={styles.videoSkipBtn} onPress={onSkip} activeOpacity={0.8}>
          <Text style={styles.videoSkipText}>SKIP</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.inactive} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Review screen ────────────────────────────────────────────────────────────

const FRAME_COLORS = ['#FFB800', '#E8001C', '#00C47A'];

function ReviewScreen({ captures, elapsed, activeBoosts, videoUri, onShare, onDiscard }) {
  const insets = useSafeAreaInsets();
  const baseXP = 120;
  const boostXP = BOOSTS.filter(b => activeBoosts.includes(b.label)).reduce((s, b) => s + b.xp, 0);
  const totalXP = baseXP + boostXP;

  return (
    <View style={[styles.reviewContainer, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md }]}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewDoneBadge}>
          <Ionicons name="checkmark" size={12} color={colors.background} />
          <Text style={styles.reviewDoneBadgeText}>COOK COMPLETE</Text>
        </View>
        <Text style={styles.reviewTitle}>AUTO-CLIP{'\n'}READY</Text>
      </View>

      {/* Frames — 3 photos + optional video */}
      <View style={styles.reviewClip}>
        {STAGES.map((stage, i) => (
          <View key={stage} style={[styles.reviewFrame, { borderColor: FRAME_COLORS[i] }]}>
            <View style={styles.reviewFrameStripes} pointerEvents="none">
              {Array.from({ length: 5 }).map((_, j) => (
                <View key={j} style={[styles.reviewFrameStripe, { backgroundColor: FRAME_COLORS[i] }]} />
              ))}
            </View>
            <View style={styles.reviewFrameInner}>
              <Ionicons name="restaurant" size={28} color={FRAME_COLORS[i]} style={{ opacity: 0.4 }} />
            </View>
            <View style={[styles.reviewWatermark, { backgroundColor: `${FRAME_COLORS[i]}CC` }]}>
              <Text style={styles.reviewWatermarkRank}>{USER.rank}</Text>
              <Text style={styles.reviewWatermarkLevel}>LV{USER.level}</Text>
            </View>
            <Text style={styles.reviewFrameLabel}>{stage}</Text>
          </View>
        ))}

        {/* Video frame */}
        {videoUri ? (
          <View style={[styles.reviewFrame, styles.reviewVideoFrame]}>
            <View style={styles.reviewVideoStripes} pointerEvents="none">
              {Array.from({ length: 5 }).map((_, j) => (
                <View key={j} style={styles.reviewVideoStripe} />
              ))}
            </View>
            <View style={styles.reviewFrameInner}>
              <Ionicons name="play-circle" size={30} color={colors.primary} style={{ opacity: 0.7 }} />
            </View>
            <View style={[styles.reviewWatermark, { backgroundColor: `${colors.primary}CC` }]}>
              <Text style={styles.reviewWatermarkRank}>VIDEO</Text>
              <Text style={styles.reviewWatermarkLevel}>+30 XP</Text>
            </View>
            <Text style={styles.reviewFrameLabel}>CLIP</Text>
          </View>
        ) : (
          <View style={[styles.reviewFrame, styles.reviewNoVideoFrame]}>
            <View style={styles.reviewFrameInner}>
              <Ionicons name="videocam-off-outline" size={22} color={colors.border} />
            </View>
            <Text style={styles.reviewFrameLabel}>NO CLIP</Text>
          </View>
        )}
      </View>

      {/* Stats */}
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
          <View style={[styles.reviewVerifyDot, { backgroundColor: videoUri ? colors.primary : boostXP > 0 ? colors.success : colors.gold }]} />
          <Text style={styles.reviewStatLabel}>{videoUri ? 'VIDEO ✓' : boostXP > 0 ? `+${boostXP} BOOST` : 'NO BOOST'}</Text>
        </View>
      </View>

      {/* Verification */}
      <View style={styles.reviewVerification}>
        <View style={styles.reviewVerifyRow}>
          <Ionicons name="scan" size={14} color={colors.inactive} />
          <Text style={styles.reviewVerifyText}>AI dish recognition</Text>
          <Text style={styles.reviewVerifyStatus}>PENDING</Text>
        </View>
        <View style={styles.reviewVerifyRow}>
          <Ionicons name="time" size={14} color={colors.success} />
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

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CookScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState('idle'); // idle | session | video | review
  const [stage, setStage] = useState(0);
  const [captures, setCaptures] = useState([false, false, false]);
  const [activeBoosts, setActiveBoosts] = useState([]);
  const [videoUri, setVideoUri] = useState(null);
  const [facing, setFacing] = useState('back');
  const [takingSelfie, setTakingSelfie] = useState(false);
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

  const handleCapture = () => {
    animateShutter();
    if (takingSelfie) {
      setTakingSelfie(false);
      setFacing('back');
      setActiveBoosts(prev => prev.includes('SELFIE') ? prev : [...prev, 'SELFIE']);
      return;
    }
    const next = captures.map((c, i) => i === stage ? true : c);
    setCaptures(next);
    if (stage < 2) {
      setStage(s => s + 1);
    } else {
      setPhase('video');
    }
  };

  const handleSelfieBoostPress = () => {
    if (activeBoosts.includes('SELFIE')) {
      setActiveBoosts(prev => prev.filter(b => b !== 'SELFIE'));
    } else {
      setFacing('front');
      setTakingSelfie(true);
    }
  };

  const handleCancelSelfie = () => {
    setTakingSelfie(false);
    setFacing('back');
  };

  const handleVideoRecorded = (uri) => {
    setVideoUri(uri);
    if (uri) {
      // auto-apply video boost
      setActiveBoosts(prev => prev.includes('VIDEO') ? prev : [...prev, 'VIDEO']);
    }
    setPhase('review');
  };

  const handleSkipVideo = () => {
    setPhase('review');
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
    setVideoUri(null);
    setFacing('back');
    setTakingSelfie(false);
    stopwatch.reset();
  };

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

  if (phase === 'idle') return <IdleScreen onStart={handleStart} />;

  if (phase === 'review') {
    return (
      <ReviewScreen
        captures={captures}
        elapsed={stopwatch.elapsed}
        activeBoosts={activeBoosts}
        videoUri={videoUri}
        onShare={handleShare}
        onDiscard={handleDiscard}
      />
    );
  }

  // session + video — camera stays mounted for both
  const viewfinderPad = 48;
  const cameraMode = phase === 'video' ? 'video' : 'picture';

  return (
    <View style={styles.sessionContainer}>
      <StatusBar barStyle="light-content" />
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} mode={cameraMode} />
      <View style={styles.sessionDim} />

      {/* ── Session overlay ── */}
      {phase === 'session' && (
        <>
          <View style={[styles.viewfinder, { top: insets.top + 80, bottom: 220, left: viewfinderPad, right: viewfinderPad }]}>
            <CornerBrackets />
          </View>

          {/* Top HUD */}
          <View style={[styles.topHud, { top: insets.top + spacing.md }]}>
            <TouchableOpacity style={styles.exitBtn} onPress={takingSelfie ? handleCancelSelfie : handleDiscard}>
              <Ionicons name={takingSelfie ? 'arrow-back' : 'close'} size={20} color={colors.white} />
            </TouchableOpacity>
            <View style={styles.timerBox}>
              <Text style={styles.timerText}>{stopwatch.display}</Text>
            </View>
            {takingSelfie ? (
              <View style={[styles.selfieHudBadge]}>
                <Ionicons name="camera-reverse" size={14} color={colors.accent} />
                <Text style={styles.selfieHudText}>FRONT</Text>
              </View>
            ) : (
              <View style={styles.stageIndicator}>
                {STAGES.map((s, i) => (
                  <View key={s} style={[styles.stageDot, i === stage && styles.stageDotActive, i < stage && styles.stageDotDone]} />
                ))}
              </View>
            )}
          </View>

          {/* Stage / selfie label */}
          <View style={[styles.stageLabelBox, { top: insets.top + 70 }]}>
            {takingSelfie ? (
              <>
                <View style={styles.selfiePill}>
                  <Ionicons name="camera-reverse" size={12} color={colors.background} />
                  <Text style={styles.selfiePillText}>SELFIE BOOST</Text>
                </View>
                <Text style={styles.stageHintText}>Strike a pose · +15 XP</Text>
              </>
            ) : (
              <>
                <View style={styles.stagePill}>
                  <Text style={styles.stagePillText}>{STAGES[stage]}</Text>
                </View>
                <Text style={styles.stageHintText}>{STAGE_HINTS[stage]}</Text>
              </>
            )}
          </View>

          {/* Bottom controls */}
          <View style={[styles.bottomControls, { paddingBottom: insets.bottom + spacing.md }]}>
            {/* Boost strip — hidden during selfie */}
            {!takingSelfie && (
              <View style={styles.boostStrip}>
                {BOOSTS.map(b => {
                  const active = activeBoosts.includes(b.label);
                  const isSelfie = b.label === 'SELFIE';
                  return (
                    <TouchableOpacity
                      key={b.label}
                      style={[styles.boostBtn, active && styles.boostBtnActive]}
                      onPress={isSelfie ? handleSelfieBoostPress : () => toggleBoost(b.label)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name={b.icon} size={14} color={active ? colors.background : colors.accent} />
                      <Text style={[styles.boostLabel, active && { color: colors.background }]}>{b.label}</Text>
                      <Text style={[styles.boostXP, active && { color: colors.background }]}>+{b.xp} XP</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <View style={styles.captureRow}>
              {takingSelfie ? (
                <View style={styles.captureRowSpacer} />
              ) : (
                <PhotoStrip captures={captures} />
              )}
              <Animated.View style={{ transform: [{ scale: shutterScale }] }}>
                <TouchableOpacity
                  style={[styles.shutterBtn, takingSelfie && styles.shutterBtnSelfie]}
                  onPress={handleCapture}
                  activeOpacity={1}
                >
                  <View style={[styles.shutterInner, takingSelfie && styles.shutterInnerSelfie]} />
                </TouchableOpacity>
              </Animated.View>
              <View style={styles.captureRowSpacer} />
            </View>
          </View>
        </>
      )}

      {/* ── Video overlay ── */}
      {phase === 'video' && (
        <VideoOverlay
          cameraRef={cameraRef}
          insets={insets}
          onRecorded={handleVideoRecorded}
          onSkip={handleSkipVideo}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Idle ──────────────────────────────────────────
  idleContainer: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },
  idleHalftone: { position: 'absolute', bottom: 0, right: 0, width: 180, height: 180, flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 12, opacity: 0.06 },
  idleHalftoneDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  idleInner: { flex: 1, padding: spacing.md, justifyContent: 'center' },
  idleRankRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  idleRankChip: { borderWidth: borders.thin, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  idleRankChipText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  idleLevelChip: { backgroundColor: colors.surface, borderWidth: borders.thin, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  idleLevelText: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  idleTitleRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: spacing.lg },
  idleAccentBar: { width: 6, height: 70, backgroundColor: colors.primary, marginRight: spacing.md },
  idleTitle: { color: colors.white, fontSize: 44, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider, lineHeight: 46 },
  idleSubtitle: { color: colors.inactive, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold, marginBottom: spacing.xl, lineHeight: 22 },
  idleStageList: { marginBottom: spacing.lg, gap: spacing.md },
  idleStageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  idleStageNum: { width: 28, height: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0 },
  idleStageNumText: { color: colors.white, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.black },
  idleStageName: { color: colors.white, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  idleOptional: { color: colors.inactive, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, letterSpacing: 0 },
  idleStageHint: { color: colors.inactive, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, lineHeight: 18 },
  idleXpRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: spacing.lg, backgroundColor: colors.surface, borderWidth: borders.thin, borderColor: colors.border, padding: spacing.sm },
  idleXpText: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },
  idleXpValue: { color: colors.accent, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black },
  startBtn: { backgroundColor: colors.primary, borderWidth: borders.medium, borderColor: '#000', paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  startBtnText: { color: colors.white, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },

  // ── Session + Video (shared camera container) ──────
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

  // Selfie HUD
  selfieHudBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: borders.thin, borderColor: colors.accent, paddingHorizontal: spacing.sm, paddingVertical: 4, backgroundColor: 'rgba(0,0,0,0.6)' },
  selfieHudText: { color: colors.accent, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wide },
  selfiePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.accent, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  selfiePillText: { color: colors.background, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  shutterBtnSelfie: { borderColor: colors.accent },
  shutterInnerSelfie: { backgroundColor: colors.accent },

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

  // ── Video overlay ──────────────────────────────────
  videoOverlay: { ...StyleSheet.absoluteFillObject, paddingHorizontal: spacing.md, alignItems: 'center' },
  videoTitleBox: { alignItems: 'center', gap: spacing.xs },
  videoOptionalTag: { backgroundColor: colors.accent, paddingHorizontal: spacing.sm, paddingVertical: 3, marginBottom: 4 },
  videoOptionalTagText: { color: colors.background, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  videoTitle: { color: colors.white, fontSize: typography.fontSize.xxl, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wide, textAlign: 'center' },
  videoSubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, textAlign: 'center' },

  // REC indicator
  recRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderWidth: borders.thin, borderColor: colors.primary },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  recText: { color: colors.primary, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  recTimer: { color: colors.white, fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.black, fontVariant: ['tabular-nums'] },
  recMax: { color: colors.inactive, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },

  // Record button
  videoRecordRing: { width: 88, height: 88, borderRadius: 44, borderWidth: 4, borderColor: colors.white, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  videoRecordRingActive: { borderColor: colors.primary },
  videoRecordIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary },
  videoStopIcon: { width: 28, height: 28, borderRadius: 4, backgroundColor: colors.white },
  videoHint: { color: 'rgba(255,255,255,0.6)', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider, marginBottom: spacing.md },

  // Progress bar
  videoProgressTrack: { width: '100%', height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden', marginTop: spacing.sm },
  videoProgressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 2 },

  // Skip
  videoSkipBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  videoSkipText: { color: colors.inactive, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },

  // ── Review ────────────────────────────────────────
  reviewContainer: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  reviewHeader: { marginBottom: spacing.md },
  reviewDoneBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.success, alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 3, marginBottom: spacing.sm },
  reviewDoneBadgeText: { color: colors.background, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  reviewTitle: { color: colors.white, fontSize: typography.fontSize.xxl, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider, lineHeight: 30 },
  reviewClip: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  reviewFrame: { flex: 1, aspectRatio: 0.75, backgroundColor: colors.surface, borderWidth: borders.thin, borderColor: colors.border, overflow: 'hidden', position: 'relative' },
  reviewFrameStripes: { position: 'absolute', top: -20, left: -20, right: -20, bottom: -20, flexDirection: 'row', gap: 12, transform: [{ rotate: '-20deg' }] },
  reviewFrameStripe: { width: 10, flex: 1, opacity: 0.08 },
  reviewFrameInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  reviewWatermark: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 4, alignItems: 'center' },
  reviewWatermarkRank: { color: colors.white, fontSize: 7, fontWeight: typography.fontWeight.black, letterSpacing: 1 },
  reviewWatermarkLevel: { color: colors.white, fontSize: 8, fontWeight: typography.fontWeight.black, opacity: 0.8 },
  reviewFrameLabel: { position: 'absolute', top: spacing.xs, left: spacing.xs, color: colors.white, fontSize: 8, fontWeight: typography.fontWeight.black, backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 4, paddingVertical: 2 },
  reviewVideoFrame: { borderColor: colors.primary },
  reviewVideoStripes: { position: 'absolute', top: -20, left: -20, right: -20, bottom: -20, flexDirection: 'row', gap: 12, transform: [{ rotate: '-20deg' }] },
  reviewVideoStripe: { width: 10, flex: 1, backgroundColor: colors.primary, opacity: 0.08 },
  reviewNoVideoFrame: { borderColor: colors.border, borderStyle: 'dashed', opacity: 0.4 },

  reviewStats: { flexDirection: 'row', borderWidth: borders.thin, borderColor: colors.border, marginBottom: spacing.md },
  reviewStat: { flex: 1, alignItems: 'center', padding: spacing.sm, gap: 2 },
  reviewStatVal: { color: colors.white, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.black },
  reviewStatLabel: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold, letterSpacing: typography.letterSpacing.wider },
  reviewStatDivider: { width: borders.thin, backgroundColor: colors.border },
  reviewVerifyDot: { width: 10, height: 10, borderRadius: 5 },

  reviewVerification: { borderWidth: borders.thin, borderColor: colors.border, padding: spacing.sm, marginBottom: spacing.lg, gap: spacing.sm },
  reviewVerifyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reviewVerifyText: { flex: 1, color: colors.inactive, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },
  reviewVerifyStatus: { color: colors.gold, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wide },

  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, borderWidth: borders.thin, borderColor: '#000', paddingVertical: spacing.md, marginBottom: spacing.sm },
  shareBtnText: { color: colors.white, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  discardBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  discardBtnText: { color: colors.inactive, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, letterSpacing: typography.letterSpacing.wide },
});
