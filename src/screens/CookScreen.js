import { View, Text, StyleSheet, TouchableOpacity, Dimensions, StatusBar, Animated, TextInput, Alert, ActivityIndicator, AppState } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, spacing, typography, borders } from '../theme';
import { submitCook, getProfile, getMyDuels, getDuelCooks } from '../lib/api';
import { rankFromXp, RANK_COLORS } from '../lib/xp';
import { supabase } from '../lib/supabase';
import VoteNotifBell from '../components/VoteNotifBell';

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


function pad(n) { return String(n).padStart(2, '0'); }

// ─── Stopwatch ────────────────────────────────────────────────────────────────

function useStopwatch() {
  const [elapsed, setElapsed] = useState(0);
  const running = useRef(false);
  const startTimeRef = useRef(null); // wall-clock ms when timer last started
  const interval = useRef(null);

  // elapsed is always derived from wall clock, not a counter
  const calcElapsed = () =>
    startTimeRef.current !== null
      ? Math.floor((Date.now() - startTimeRef.current) / 1000)
      : 0;

  const start = () => {
    if (running.current) return;
    running.current = true;
    // shift start back by any already-elapsed time (supports resume)
    startTimeRef.current = Date.now() - elapsed * 1000;
    interval.current = setInterval(() => setElapsed(calcElapsed()), 500);
  };

  const stop = () => {
    if (!running.current) return;
    running.current = false;
    clearInterval(interval.current);
    const final = calcElapsed();
    setElapsed(final);
    startTimeRef.current = null;
    return final;
  };

  const reset = () => {
    running.current = false;
    clearInterval(interval.current);
    startTimeRef.current = null;
    setElapsed(0);
  };

  // Snap display immediately when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active' && running.current && startTimeRef.current !== null) {
        setElapsed(calcElapsed());
      }
    });
    return () => {
      sub.remove();
      clearInterval(interval.current);
    };
  }, []);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return { display: `${pad(mins)}:${pad(secs)}`, elapsed, start, stop, reset };
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

function IdleScreen({ onStart, eventTitle, eventXpReward, duelOpponentName, duelSubmitted, rank, level, rankColor, inspiredByDishName, inspiredByUsername }) {
  return (
    <SafeAreaView style={styles.idleContainer} edges={['top', 'bottom']}>
      <View style={styles.idleHalftone} pointerEvents="none">
        {Array.from({ length: 40 }).map((_, i) => (
          <View key={i} style={styles.idleHalftoneDot} />
        ))}
      </View>

      <View style={styles.idleInner}>
        <View style={styles.idleRankRow}>
          <View style={[styles.idleRankChip, { borderColor: rankColor }]}>
            <Text style={[styles.idleRankChipText, { color: rankColor }]}>{rank}</Text>
          </View>
          <View style={styles.idleLevelChip}>
            <Text style={styles.idleLevelText}>LV{level}</Text>
          </View>
          <VoteNotifBell />
        </View>

        {/* Duel banner */}
        {duelOpponentName && (
          <View style={styles.duelBanner}>
            <Ionicons name="flash" size={13} color={colors.primary} />
            <Text style={styles.duelBannerText} numberOfLines={1}>
              DUEL vs @{duelOpponentName}
            </Text>
            {duelSubmitted ? (
              <View style={styles.duelBannerSubmitted}>
                <Text style={styles.duelBannerSubmittedText}>SUBMITTED</Text>
              </View>
            ) : (
              <View style={styles.duelBannerActive}>
                <Text style={styles.duelBannerActiveText}>ACTIVE</Text>
              </View>
            )}
          </View>
        )}

        {inspiredByDishName && (
          <View style={styles.inspireBanner}>
            <Ionicons name="flame" size={13} color={colors.accent} />
            <Text style={styles.inspireBannerText} numberOfLines={1}>
              Inspired by @{inspiredByUsername} · {inspiredByDishName}
            </Text>
            <View style={styles.inspireBannerXp}>
              <Text style={styles.inspireBannerXpText}>+30 XP</Text>
            </View>
          </View>
        )}

        {/* Event banner */}
        {eventTitle && (
          <View style={styles.eventBanner}>
            <Ionicons name="star" size={13} color={colors.gold} />
            <Text style={styles.eventBannerText} numberOfLines={1}>{eventTitle}</Text>
            <View style={styles.eventBannerXp}>
              <Text style={styles.eventBannerXpText}>+{eventXpReward} XP</Text>
            </View>
          </View>
        )}

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

        {duelSubmitted ? (
          <View style={styles.duelSubmittedBtn}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.duelSubmittedBtnText}>COOK SUBMITTED</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.startBtn} onPress={onStart} activeOpacity={0.85}>
            <Ionicons name="flame" size={18} color={colors.white} />
            <Text style={styles.startBtnText}>START COOKING</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Video capture overlay ────────────────────────────────────────────────────

function VideoOverlay({ cameraRef, insets, onRecorded, onSkip, cameraReady }) {
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
      <TouchableOpacity onPress={handleRecord} activeOpacity={0.85} disabled={!cameraReady || isRecording === null}>
        <View style={[styles.videoRecordRing, isRecording && styles.videoRecordRingActive, !cameraReady && styles.videoRecordRingWaiting]}>
          {!cameraReady
            ? <ActivityIndicator color={colors.white} size="large" />
            : isRecording
              ? <View style={styles.videoStopIcon} />
              : <View style={styles.videoRecordIcon} />
          }
        </View>
      </TouchableOpacity>
      <Text style={styles.videoHint}>{!cameraReady ? 'GETTING READY...' : isRecording ? 'TAP TO STOP' : 'TAP TO RECORD'}</Text>

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

function ReviewScreen({ captures, elapsed, activeBoosts, videoUri, dishName, setDishName, caption, setCaption, sharing, onShare, onDiscard, onVideoRetake, rank, level, ingredients, onAddIngredient, onRemoveIngredient }) {
  const insets = useSafeAreaInsets();
  const baseXP = 120;
  const boostXP = BOOSTS.filter(b => activeBoosts.includes(b.label)).reduce((s, b) => s + b.xp, 0);
  const videoXP = videoUri ? 30 : 0;
  const ingredientsXP = ingredients.length > 0 ? 20 : 0;
  const totalXP = baseXP + boostXP + videoXP + ingredientsXP;

  const [ingredientInput, setIngredientInput] = useState('');
  function handleAddIngredient() {
    const trimmed = ingredientInput.trim();
    if (!trimmed) return;
    onAddIngredient(trimmed);
    setIngredientInput('');
  }

  return (
    <View style={[styles.reviewContainer, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md }]}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewDoneBadge}>
          <Ionicons name="checkmark" size={12} color={colors.background} />
          <Text style={styles.reviewDoneBadgeText}>COOK COMPLETE</Text>
        </View>
        <Text style={styles.reviewTitle}>AUTO-CLIP{'\n'}READY</Text>
      </View>

      <TextInput
        style={styles.dishInput}
        placeholder="NAME YOUR DISH..."
        placeholderTextColor={colors.inactive}
        value={dishName}
        onChangeText={setDishName}
        autoCapitalize="characters"
        returnKeyType="done"
        maxLength={60}
      />
      {activeBoosts.includes('CAPTION') && (
        <TextInput
          style={styles.captionInput}
          placeholder="ADD A CAPTION..."
          placeholderTextColor={colors.inactive}
          value={caption}
          onChangeText={setCaption}
          autoCapitalize="sentences"
          returnKeyType="done"
          maxLength={120}
        />
      )}

      {/* Ingredients */}
      <View style={styles.ingredientsSection}>
        <View style={styles.ingredientsSectionHeader}>
          <Text style={styles.ingredientsSectionTitle}>INGREDIENTS</Text>
          <Text style={styles.ingredientsSectionOptional}>optional · +20 XP</Text>
        </View>
        {ingredients.map((ing, i) => (
          <View key={i} style={styles.ingredientItem}>
            <Text style={styles.ingredientBullet}>•</Text>
            <Text style={styles.ingredientItemText} numberOfLines={1}>{ing}</Text>
            <TouchableOpacity onPress={() => onRemoveIngredient(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={13} color={colors.inactive} />
            </TouchableOpacity>
          </View>
        ))}
        <View style={styles.ingredientInputRow}>
          <TextInput
            style={styles.ingredientInput}
            placeholder="Add ingredient..."
            placeholderTextColor={colors.inactive}
            value={ingredientInput}
            onChangeText={setIngredientInput}
            onSubmitEditing={handleAddIngredient}
            returnKeyType="done"
            autoCapitalize="sentences"
          />
          <TouchableOpacity style={styles.ingredientAddBtn} onPress={handleAddIngredient} activeOpacity={0.8}>
            <Ionicons name="add" size={18} color={colors.background} />
          </TouchableOpacity>
        </View>
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
              <Text style={styles.reviewWatermarkRank}>{rank}</Text>
              <Text style={styles.reviewWatermarkLevel}>LV{level}</Text>
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
          <TouchableOpacity
            style={[styles.reviewFrame, styles.reviewNoVideoFrame]}
            onPress={onVideoRetake}
            activeOpacity={0.75}
          >
            <View style={styles.reviewFrameInner}>
              <Ionicons name="videocam-outline" size={22} color={colors.inactive} />
              <Text style={styles.reviewRetakeLabel}>TAP TO{'\n'}RECORD</Text>
            </View>
            <Text style={styles.reviewFrameLabel}>NO CLIP</Text>
          </TouchableOpacity>
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

      <TouchableOpacity style={[styles.shareBtn, sharing && { opacity: 0.7 }]} onPress={onShare} activeOpacity={0.85} disabled={sharing}>
        {sharing
          ? <ActivityIndicator color={colors.background} size="small" />
          : <Ionicons name="share-social" size={18} color={colors.background} />
        }
        <Text style={styles.shareBtnText}>{sharing ? 'UPLOADING...' : 'SHARE TO FEED'}</Text>
      </TouchableOpacity>
      {!sharing && (
        <TouchableOpacity style={styles.discardBtn} onPress={onDiscard}>
          <Text style={styles.discardBtnText}>DISCARD</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CookScreen({ navigation }) {
  const route = useRoute();
  const eventId = route.params?.eventId ?? null;
  const eventTitle = route.params?.eventTitle ?? null;
  const eventXpReward = route.params?.eventXpReward ?? 0;
  const inspiredByCookId   = route.params?.inspiredByCookId   ?? null;
  const inspiredByUserId   = route.params?.inspiredByUserId   ?? null;
  const inspiredByUsername = route.params?.inspiredByUsername ?? null;
  const inspiredByDishName = route.params?.inspiredByDishName ?? null;

  const [profile, setProfile] = useState(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState('idle'); // idle | session | video | review
  const [stage, setStage] = useState(0);
  const [captures, setCaptures] = useState([null, null, null]);
  const [activeBoosts, setActiveBoosts] = useState([]);
  const [videoUri, setVideoUri] = useState(null);
  const [facing, setFacing] = useState('back');
  const [takingSelfie, setTakingSelfie] = useState(false);
  const [dishName, setDishName] = useState('');
  const [caption, setCaption] = useState('');
  const [sharing, setSharing] = useState(false);
  const [ingredients, setIngredients] = useState([]);
  const [activeDuel, setActiveDuel] = useState(null);
  const [duelOpponentName, setDuelOpponentName] = useState(null);
  const [duelSubmitted, setDuelSubmitted] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const activeDuelIdRef = useRef(null);
  const shutterScale = useRef(new Animated.Value(1)).current;
  const modeTransitionOpacity = useRef(new Animated.Value(0)).current;
  const stopwatch = useStopwatch();
  const cameraRef = useRef(null);
  const insets = useSafeAreaInsets();

  useFocusEffect(useCallback(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const uid = session.user.id;
      try {
        const prof = await getProfile(uid);
        setProfile(prof);
        const duels = await getMyDuels(uid);
        const active = duels.find(d => d.status === 'active') || null;
        setActiveDuel(active);
        activeDuelIdRef.current = active?.id ?? null;
        if (active) {
          const isChallenger = active.challenger_id === uid;
          const opp = isChallenger ? active.opponent : active.challenger;
          setDuelOpponentName(opp?.username ?? null);
          const cooks = await getDuelCooks(active.id);
          setDuelSubmitted(cooks.some(c => c.user_id === uid));
        } else {
          setDuelOpponentName(null);
          setDuelSubmitted(false);
        }
      } catch {}
    });
  }, []));

  const handleStart = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) return;
    }
    setCameraReady(false);
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
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.8 });
    if (!photo?.uri) return; // camera not ready — let user tap again
    if (takingSelfie) {
      setTakingSelfie(false);
      setFacing('back');
      setActiveBoosts(prev => prev.includes('SELFIE') ? prev : [...prev, 'SELFIE']);
      return;
    }
    const next = captures.map((c, i) => i === stage ? photo.uri : c);
    setCaptures(next);
    if (stage < 2) {
      setStage(s => s + 1);
    } else {
      stopwatch.stop();
      // Fade to black briefly to mask the picture→video mode restart
      setCameraReady(false);
      modeTransitionOpacity.setValue(1);
      setPhase('video');
      Animated.timing(modeTransitionOpacity, {
        toValue: 0, duration: 400, delay: 200, useNativeDriver: true,
      }).start();
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

  const handleRetakeVideo = () => {
    setVideoUri(null);
    setCameraReady(false);
    setPhase('video');
  };

  const toggleBoost = (label) => {
    setActiveBoosts(prev =>
      prev.includes(label) ? prev.filter(b => b !== label) : [...prev, label]
    );
  };

  const handleDiscard = () => {
    setPhase('idle');
    setStage(0);
    setCaptures([null, null, null]);
    setActiveBoosts([]);
    setVideoUri(null);
    setFacing('back');
    setTakingSelfie(false);
    setDishName('');
    setCaption('');
    setIngredients([]);
    stopwatch.reset();
  };

  const handleShare = async () => {
    if (!dishName.trim()) {
      Alert.alert('Name your dish', 'Enter a dish name before sharing.');
      return;
    }
    setSharing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not logged in');

      const baseXP = 120;
      const boostXP = BOOSTS.filter(b => activeBoosts.includes(b.label)).reduce((s, b) => s + b.xp, 0);
      const videoXP = videoUri ? 30 : 0;
      const ingredientsXP = ingredients.length > 0 ? 20 : 0;
      const inspirationXP = inspiredByCookId ? 30 : 0;
      const baseAmount = baseXP + boostXP + videoXP + ingredientsXP + inspirationXP;

      const profile = await getProfile(session.user.id);
      const oldXp = profile.xp ?? 0;
      const before = rankFromXp(oldXp);

      const cookResult = await submitCook({
        userId: session.user.id,
        dishName: dishName.trim(),
        caption: caption.trim() || null,
        photoUris: captures.filter(Boolean),
        videoUri,
        cookTimeSecs: stopwatch.elapsed,
        boosts: activeBoosts,
        baseAmount,
        eventId,
        duelId: activeDuelIdRef.current,
        ingredients,
        inspiredByCookId,
        inspiredByUserId,
        inspiredByDishName,
      });

      const actualXp = cookResult?.xp_earned ?? baseAmount;
      const after = rankFromXp(oldXp + actualXp);
      const rankUpParams = (before.rank !== after.rank || before.tier !== after.tier)
        ? { fromRank: before.rank, fromLevel: before.tier, toRank: after.rank, toLevel: after.tier, xpEarned: actualXp }
        : null;

      const bonusXP = actualXp - baseAmount;
      const xpBreakdown = [
        { label: 'BASE COOK', xp: baseXP },
        ...(boostXP > 0 ? [{ label: 'BOOSTS', xp: boostXP }] : []),
        ...(videoXP > 0 ? [{ label: 'VIDEO CLIP', xp: videoXP }] : []),
        ...(ingredientsXP > 0 ? [{ label: 'INGREDIENTS', xp: ingredientsXP }] : []),
        ...(inspirationXP > 0 ? [{ label: 'INSPIRED BY', xp: inspirationXP }] : []),
        ...(bonusXP > 0 ? [{ label: 'STREAK / EVENT BONUS', xp: bonusXP }] : []),
      ];

      const name = dishName.trim();
      handleDiscard();
      navigation.navigate('CookSuccess', { dishName: name, xpEarned: actualXp, rankUpParams, inspiredByUsername, xpBreakdown });
    } catch (e) {
      Alert.alert('Upload failed', e.message);
      setSharing(false);
    }
  };

  const userRank = profile?.rank ?? '—';
  const userLevel = profile?.level ?? '—';
  const userRankColor = RANK_COLORS[profile?.rank] || colors.primary;

  if (phase === 'idle') return <IdleScreen onStart={handleStart} eventTitle={eventTitle} eventXpReward={eventXpReward} duelOpponentName={duelOpponentName} duelSubmitted={duelSubmitted} rank={userRank} level={userLevel} rankColor={userRankColor} inspiredByDishName={inspiredByDishName} inspiredByUsername={inspiredByUsername} />;

  if (phase === 'review') {
    return (
      <ReviewScreen
        captures={captures}
        elapsed={stopwatch.elapsed}
        activeBoosts={activeBoosts}
        videoUri={videoUri}
        dishName={dishName}
        setDishName={setDishName}
        caption={caption}
        setCaption={setCaption}
        sharing={sharing}
        onShare={handleShare}
        onDiscard={handleDiscard}
        onVideoRetake={handleRetakeVideo}
        rank={userRank}
        level={userLevel}
        ingredients={ingredients}
        onAddIngredient={(ing) => setIngredients(prev => [...prev, ing])}
        onRemoveIngredient={(i) => setIngredients(prev => prev.filter((_, idx) => idx !== i))}
      />
    );
  }

  // session + video — camera stays mounted for both
  const viewfinderPad = 48;
  const cameraMode = phase === 'video' ? 'video' : 'picture';

  return (
    <View style={styles.sessionContainer}>
      <StatusBar barStyle="light-content" />
      <CameraView
        key={phase === 'video' ? 'video-mode' : 'picture-mode'}
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode={cameraMode}
        onCameraReady={() => setCameraReady(true)}
      />
      <View style={styles.sessionDim} />
      {/* Masks the camera restart when switching picture→video mode */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: modeTransitionOpacity }]} pointerEvents="none" />

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
          cameraReady={cameraReady}
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
  eventBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: '#1a1400',
    borderWidth: borders.thin, borderColor: colors.gold,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  eventBannerText: {
    flex: 1, color: colors.white,
    fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.black,
    letterSpacing: typography.letterSpacing.wide,
  },
  eventBannerXp: { backgroundColor: colors.gold, paddingHorizontal: spacing.xs, paddingVertical: 2 },
  eventBannerXpText: { color: colors.background, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black },
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
  duelBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: '#1a0000',
    borderWidth: borders.thin, borderColor: colors.primary,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  duelBannerText: {
    flex: 1, color: colors.white,
    fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.black,
    letterSpacing: typography.letterSpacing.wide,
  },
  duelBannerActive: { backgroundColor: colors.primary, paddingHorizontal: spacing.xs, paddingVertical: 2 },
  duelBannerActiveText: { color: colors.white, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black },
  duelBannerSubmitted: { backgroundColor: colors.success, paddingHorizontal: spacing.xs, paddingVertical: 2 },
  duelBannerSubmittedText: { color: colors.background, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black },
  duelSubmittedBtn: { borderWidth: borders.medium, borderColor: colors.success, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  duelSubmittedBtnText: { color: colors.success, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  startBtn: { backgroundColor: colors.primary, borderWidth: borders.medium, borderColor: '#000', paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  startBtnText: { color: colors.white, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  inspireBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: '#0a0a00',
    borderWidth: borders.thin, borderColor: colors.accent,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  inspireBannerText: {
    flex: 1, color: colors.white,
    fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.black,
    letterSpacing: typography.letterSpacing.wide,
  },
  inspireBannerXp: { backgroundColor: colors.accent, paddingHorizontal: spacing.xs, paddingVertical: 2 },
  inspireBannerXpText: { color: colors.background, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black },

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
  videoRecordRingWaiting: { borderColor: 'rgba(255,255,255,0.3)', opacity: 0.7 },
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
  reviewNoVideoFrame: { borderColor: colors.inactive, borderStyle: 'dashed' },
  reviewRetakeLabel: { color: colors.inactive, fontSize: 7, fontWeight: typography.fontWeight.black, letterSpacing: 0.5, textAlign: 'center', marginTop: 4 },

  reviewStats: { flexDirection: 'row', borderWidth: borders.thin, borderColor: colors.border, marginBottom: spacing.md },
  reviewStat: { flex: 1, alignItems: 'center', padding: spacing.sm, gap: 2 },
  reviewStatVal: { color: colors.white, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.black },
  reviewStatLabel: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold, letterSpacing: typography.letterSpacing.wider },
  reviewStatDivider: { width: borders.thin, backgroundColor: colors.border },
  reviewVerifyDot: { width: 10, height: 10, borderRadius: 5 },

  dishInput: { borderWidth: borders.thin, borderColor: colors.border, backgroundColor: colors.surface, color: colors.white, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wide, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.sm },
  captionInput: { borderWidth: borders.thin, borderColor: colors.accent, backgroundColor: colors.surface, color: colors.white, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.sm },
  reviewVerification: { borderWidth: borders.thin, borderColor: colors.border, padding: spacing.sm, marginBottom: spacing.lg, gap: spacing.sm },
  reviewVerifyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reviewVerifyText: { flex: 1, color: colors.inactive, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },
  reviewVerifyStatus: { color: colors.gold, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wide },

  ingredientsSection: { marginBottom: spacing.sm, borderWidth: borders.thin, borderColor: colors.border, backgroundColor: colors.surface },
  ingredientsSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: borders.thin, borderColor: colors.border },
  ingredientsSectionTitle: { color: colors.white, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  ingredientsSectionOptional: { color: colors.accent, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },
  ingredientItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: 6, borderBottomWidth: borders.thin, borderColor: colors.border },
  ingredientBullet: { color: colors.accent, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.black },
  ingredientItemText: { flex: 1, color: colors.white, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },
  ingredientInputRow: { flexDirection: 'row', alignItems: 'center' },
  ingredientInput: { flex: 1, color: colors.white, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  ingredientAddBtn: { backgroundColor: colors.accent, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, borderWidth: borders.thin, borderColor: '#000', paddingVertical: spacing.md, marginBottom: spacing.sm },
  shareBtnText: { color: colors.white, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  discardBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  discardBtnText: { color: colors.inactive, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, letterSpacing: typography.letterSpacing.wide },
});
