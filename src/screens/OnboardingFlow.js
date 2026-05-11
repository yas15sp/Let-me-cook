import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  Animated, ScrollView, StatusBar, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borders } from '../theme';

const { width: W, height: H } = Dimensions.get('window');
const TOTAL_QUIZ = 3;

// ─── Quiz data ────────────────────────────────────────────────────────────────

const QUESTIONS = [
  {
    id: 'cookingLevel',
    question: "What's your cooking level?",
    multi: false,
    options: [
      { key: 'beginner',     emoji: '🔰', label: 'Beginner',      sub: 'Still learning the basics' },
      { key: 'home_cook',    emoji: '🏠', label: 'Home Cook',     sub: 'I cook regularly at home' },
      { key: 'experienced',  emoji: '⭐', label: 'Experienced',   sub: 'I can handle complex recipes' },
      { key: 'professional', emoji: '👨‍🍳', label: 'Professional',  sub: 'Culinary background' },
    ],
  },
  {
    id: 'cuisineStyle',
    question: 'What do you cook most?',
    hint: 'Pick all that apply',
    multi: true,
    options: [
      { key: 'quick_meals',   emoji: '⚡', label: 'Quick Meals' },
      { key: 'comfort_food',  emoji: '🍲', label: 'Comfort Food' },
      { key: 'world_cuisine', emoji: '🌍', label: 'World Cuisine' },
      { key: 'experimental',  emoji: '🧪', label: 'Experimental' },
      { key: 'healthy',       emoji: '🥗', label: 'Healthy' },
      { key: 'baking',        emoji: '🍞', label: 'Baking' },
    ],
  },
  {
    id: 'goal',
    question: "What's your goal?",
    multi: false,
    options: [
      { key: 'climb_ranks',  emoji: '🏆', label: 'Climb the Ranks',    sub: 'Be the best cook online' },
      { key: 'beat_friends', emoji: '👥', label: 'Beat my Friends',    sub: 'Dominate my rivals' },
      { key: 'cook_more',    emoji: '📅', label: 'Cook Consistently',  sub: 'Build the habit' },
    ],
  },
];

// ─── Sauce bottle progress bar ────────────────────────────────────────────────

function SauceBottle({ quizStep }) {
  const fillAnim = useRef(new Animated.Value((quizStep - 1) / TOTAL_QUIZ)).current;
  const BODY_H = 64;
  const NECK_H = 16;
  const progress = quizStep / TOTAL_QUIZ;
  const done = quizStep >= TOTAL_QUIZ;

  useEffect(() => {
    Animated.spring(fillAnim, {
      toValue: progress,
      damping: 12,
      stiffness: 80,
      useNativeDriver: false,
    }).start();
  }, [quizStep]);

  const bodyFill  = fillAnim.interpolate({ inputRange: [0, 1], outputRange: [0, BODY_H] });
  const neckFill  = fillAnim.interpolate({ inputRange: [0.85, 1], outputRange: [0, NECK_H], extrapolate: 'clamp' });
  const fillColor = done ? colors.success : colors.primary;

  return (
    <View style={s.bottle}>
      <Text style={[s.bottleLabel, done && { color: colors.success }]}>
        {done ? 'READY!' : quizStep === 1 ? 'PREP' : 'COOKING'}
      </Text>
      <View style={[s.bottleCap, { backgroundColor: fillColor }]} />
      <View style={s.bottleNeck}>
        <Animated.View style={[s.bottleFillSlice, { height: neckFill, backgroundColor: fillColor }]} />
      </View>
      <View style={s.bottleBody}>
        <Animated.View style={[s.bottleFillSlice, { height: bodyFill, backgroundColor: fillColor }]} />
        <View style={s.bottleShine} />
      </View>
    </View>
  );
}

// ─── Welcome screen ───────────────────────────────────────────────────────────

function WelcomeStep({ onNext }) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, damping: 18, stiffness: 100, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[s.welcomeWrap, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
      {/* Background dots */}
      <View style={s.welcomeDots} pointerEvents="none">
        {Array.from({ length: 60 }).map((_, i) => (
          <View key={i} style={[s.dot, {
            left: (i % 10) * (W / 9),
            top: Math.floor(i / 10) * 90,
          }]} />
        ))}
      </View>

      {/* Wordmark */}
      <View style={s.wordmarkWrap}>
        <View style={s.wordmarkAccentBar} />
        <View>
          <Text style={s.wordmarkTop}>LET-ME-</Text>
          <Text style={s.wordmarkBottom}>COOK!</Text>
          <View style={s.wordmarkUnderline} />
        </View>
      </View>

      <Text style={s.welcomeTagline}>Cook. Rank. Repeat.</Text>

      {/* Feature pills */}
      <View style={s.featureList}>
        {[
          { icon: 'trophy',        text: 'Earn XP with every cook' },
          { icon: 'flash',         text: 'Challenge friends to duels' },
          { icon: 'calendar',      text: 'Weekly events with prizes' },
        ].map(({ icon, text }) => (
          <View key={text} style={s.featureRow}>
            <View style={s.featureIconBox}>
              <Ionicons name={icon} size={14} color={colors.accent} />
            </View>
            <Text style={s.featureText}>{text}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={s.letsGoBtn} onPress={onNext} activeOpacity={0.85}>
        <Text style={s.letsGoBtnText}>LET'S GO</Text>
        <Ionicons name="arrow-forward" size={18} color={colors.white} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Quiz step ────────────────────────────────────────────────────────────────

function QuizStep({ question, quizStep, answers, onSelect, onContinue, canContinue, onBack }) {
  const isGrid = question.multi && question.options.length >= 4;
  const selected = question.multi
    ? (answers.cuisineStyle || [])
    : answers[question.id];

  const isSelected = (key) =>
    question.multi ? selected.includes(key) : selected === key;

  return (
    <View style={s.quizWrap}>
      {/* Header row */}
      <View style={s.quizHeader}>
        <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={20} color={colors.white} />
        </TouchableOpacity>
        <View style={s.quizStepInfo}>
          <Text style={s.quizStepLabel}>QUESTION {quizStep} OF {TOTAL_QUIZ}</Text>
        </View>
        <SauceBottle quizStep={quizStep} />
      </View>

      {/* Question */}
      <View style={s.questionBlock}>
        <Text style={s.questionText}>{question.question}</Text>
        {question.hint && <Text style={s.questionHint}>{question.hint}</Text>}
      </View>

      {/* Options */}
      <ScrollView
        style={s.optionsScroll}
        contentContainerStyle={[s.optionsList, isGrid && s.optionsGrid]}
        showsVerticalScrollIndicator={false}
      >
        {question.options.map(opt => (
          <TouchableOpacity
            key={opt.key}
            style={[
              s.optionCard,
              isGrid && s.optionCardGrid,
              isSelected(opt.key) && s.optionCardSelected,
            ]}
            onPress={() => onSelect(question.id, opt.key, question.multi)}
            activeOpacity={0.8}
          >
            <Text style={s.optionEmoji}>{opt.emoji}</Text>
            <Text style={[s.optionLabel, isSelected(opt.key) && s.optionLabelSelected]}>
              {opt.label}
            </Text>
            {opt.sub && !isGrid && (
              <Text style={s.optionSub}>{opt.sub}</Text>
            )}
            {isSelected(opt.key) && !question.multi && (
              <View style={s.optionCheck}>
                <Ionicons name="checkmark" size={12} color={colors.background} />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Continue */}
      <TouchableOpacity
        style={[s.continueBtn, !canContinue && s.continueBtnDisabled]}
        onPress={canContinue ? onContinue : undefined}
        activeOpacity={0.85}
      >
        <Text style={[s.continueBtnText, !canContinue && s.continueBtnTextDisabled]}>
          {quizStep === TOTAL_QUIZ ? 'SEE MY RANK' : 'CONTINUE'}
        </Text>
        {canContinue && <Ionicons name="arrow-forward" size={16} color={colors.white} />}
      </TouchableOpacity>
    </View>
  );
}

// ─── Rank reveal ─────────────────────────────────────────────────────────────

function RankRevealStep({ onComplete }) {
  const badgeScale = useRef(new Animated.Value(0)).current;
  const badgeOp    = useRef(new Animated.Value(0)).current;
  const labelOp    = useRef(new Animated.Value(0)).current;
  const descOp     = useRef(new Animated.Value(0)).current;
  const ctaOp      = useRef(new Animated.Value(0)).current;
  const glowScale  = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.spring(badgeScale, { toValue: 1, damping: 9, stiffness: 120, useNativeDriver: true }),
        Animated.timing(badgeOp,   { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(glowScale, { toValue: 1.4, duration: 700, useNativeDriver: true }),
      ]),
      Animated.timing(labelOp, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(descOp,  { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.delay(200),
      Animated.timing(ctaOp,   { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={s.revealWrap}>
      <Text style={s.revealEyebrow}>YOUR STARTING RANK</Text>

      {/* Badge + glow */}
      <View style={s.revealBadgeArea}>
        <Animated.View style={[s.revealGlow, { transform: [{ scale: glowScale }] }]} />
        <Animated.View style={[s.revealBadgeAnim, { opacity: badgeOp, transform: [{ scale: badgeScale }] }]}>
          <View style={s.revealBadge}>
            <View style={s.revealBadgeInner}>
              <Text style={s.revealBadgeLevel}>I</Text>
              <Text style={s.revealBadgeName}>GOLD COOK</Text>
            </View>
          </View>
        </Animated.View>
      </View>

      <Animated.View style={{ opacity: labelOp, alignItems: 'center', gap: 4 }}>
        <Text style={s.revealRankName}>Gold Cook</Text>
        <Text style={s.revealRankLevel}>Level I</Text>
      </Animated.View>

      <Animated.View style={[s.revealDesc, { opacity: descOp }]}>
        <Text style={s.revealDescText}>
          Every cook earns XP. Post recipes and earn passive XP when others cook them.
          Consistency beats difficulty — cook more, climb faster.
        </Text>
      </Animated.View>

      {/* Rank ladder preview */}
      <Animated.View style={[s.rankLadder, { opacity: descOp }]}>
        {[
          { name: 'Gold Cook',   color: '#FFB800', active: true },
          { name: 'Emerald Cook', color: '#00C47A', active: false },
          { name: 'Diamond Cook', color: '#88CCFF', active: false },
          { name: 'Chef',        color: '#E8001C', active: false },
        ].map(({ name, color, active }) => (
          <View key={name} style={s.ladderRow}>
            <View style={[s.ladderDot, { backgroundColor: active ? color : colors.border }]} />
            <Text style={[s.ladderName, { color: active ? color : colors.inactive }]}>{name}</Text>
            {active && <View style={[s.ladderYouChip, { borderColor: color }]}>
              <Text style={[s.ladderYouText, { color }]}>YOU</Text>
            </View>}
          </View>
        ))}
        <Text style={s.ladderEllipsis}>• • •</Text>
      </Animated.View>

      <Animated.View style={[{ width: '100%' }, { opacity: ctaOp }]}>
        <TouchableOpacity style={s.revealBtn} onPress={onComplete} activeOpacity={0.85}>
          <Text style={s.revealBtnText}>START COOKING</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.background} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── Main flow ────────────────────────────────────────────────────────────────

export default function OnboardingFlow({ onComplete }) {
  const [step, setStep]       = useState(0);
  const [answers, setAnswers] = useState({ cookingLevel: null, cuisineStyle: [], goal: null });

  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const transition = (nextStep, direction = 1) => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: direction * -24, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      slideAnim.setValue(direction * 24);
      setStep(nextStep);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleSelect = (id, key, isMulti) => {
    if (isMulti) {
      setAnswers(prev => ({
        ...prev,
        cuisineStyle: prev.cuisineStyle.includes(key)
          ? prev.cuisineStyle.filter(k => k !== key)
          : [...prev.cuisineStyle, key],
      }));
    } else {
      setAnswers(prev => ({ ...prev, [id]: key }));
    }
  };

  const canContinue = () => {
    const q = QUESTIONS[step - 1];
    if (!q) return false;
    return q.multi ? answers.cuisineStyle.length > 0 : !!answers[q.id];
  };

  const handleComplete = async () => {
    const payload = { ...answers, completedAt: new Date().toISOString() };
    try {
      // Answers stored locally — sync to Supabase/backend when auth is set up
      await AsyncStorage.setItem('onboarding_answers',  JSON.stringify(payload));
      await AsyncStorage.setItem('onboarding_complete', 'true');
    } catch (_) {}
    onComplete();
  };

  const renderStep = () => {
    if (step === 0) return <WelcomeStep onNext={() => transition(1)} />;
    if (step >= 1 && step <= 3) {
      return (
        <QuizStep
          question={QUESTIONS[step - 1]}
          quizStep={step}
          answers={answers}
          onSelect={handleSelect}
          onContinue={() => transition(step < 3 ? step + 1 : 4)}
          canContinue={canContinue()}
          onBack={() => transition(step - 1, -1)}
        />
      );
    }
    if (step === 4) return <RankRevealStep onComplete={handleComplete} />;
    return null;
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" />
      <Animated.View style={[s.flex, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
        {renderStep()}
      </Animated.View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },

  // Sauce bottle
  bottle: { alignItems: 'center', gap: 2 },
  bottleLabel: {
    color: colors.inactive, fontSize: 7, fontWeight: '900', letterSpacing: 1.5, marginBottom: 2,
  },
  bottleCap: { width: 20, height: 7, borderRadius: 2 },
  bottleNeck: {
    width: 14, height: 16, borderWidth: 2, borderColor: colors.border,
    overflow: 'hidden', justifyContent: 'flex-end',
  },
  bottleBody: {
    width: 34, height: 64, borderWidth: 2, borderColor: colors.border,
    borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
    overflow: 'hidden', justifyContent: 'flex-end',
  },
  bottleFillSlice: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  bottleShine: {
    position: 'absolute', top: 8, left: 6, width: 6, height: 16,
    borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.09)', zIndex: 2,
  },

  // Welcome
  welcomeWrap: { flex: 1, paddingHorizontal: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.md },
  welcomeDots: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  dot: { position: 'absolute', width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.05)' },

  wordmarkWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginBottom: spacing.md, marginTop: H * 0.04 },
  wordmarkAccentBar: { width: 6, height: 80, backgroundColor: colors.primary },
  wordmarkTop: {
    color: colors.white,
    fontSize: 52,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    letterSpacing: -1,
    lineHeight: 52,
  },
  wordmarkBottom: {
    color: colors.accent,
    fontSize: 52,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    letterSpacing: -1,
    lineHeight: 52,
  },
  wordmarkUnderline: { height: 4, backgroundColor: colors.primary, marginTop: 4 },
  welcomeTagline: {
    color: colors.inactive, fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold, marginBottom: spacing.xl,
  },

  featureList: { gap: spacing.sm, marginBottom: spacing.xl, flex: 1 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  featureIconBox: {
    width: 32, height: 32, borderWidth: borders.thin, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface,
  },
  featureText: {
    color: colors.white, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold,
  },

  letsGoBtn: {
    backgroundColor: colors.primary, borderWidth: borders.thin, borderColor: colors.border,
    paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: spacing.sm,
  },
  letsGoBtnText: { color: colors.white, fontSize: typography.fontSize.lg, fontWeight: '900', letterSpacing: 3 },

  // Quiz
  quizWrap: { flex: 1, paddingTop: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  quizHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginBottom: spacing.lg, paddingTop: spacing.xs,
  },
  backBtn: {
    width: 36, height: 36, borderWidth: borders.thin, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  quizStepInfo: { flex: 1 },
  quizStepLabel: {
    color: colors.inactive, fontSize: 10, fontWeight: '900', letterSpacing: 2,
  },

  questionBlock: { marginBottom: spacing.lg, gap: spacing.xs },
  questionText: {
    color: colors.white, fontSize: typography.fontSize.xxl,
    fontWeight: '900', lineHeight: 34,
  },
  questionHint: {
    color: colors.accent, fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold, letterSpacing: 0.5,
  },

  optionsScroll: { flex: 1 },
  optionsList: { gap: spacing.sm, paddingBottom: spacing.sm },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  optionCard: {
    backgroundColor: colors.surface, borderWidth: borders.thin, borderColor: colors.border,
    padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
  },
  optionCardGrid: {
    width: (W - spacing.md * 2 - spacing.sm) / 2,
    flexDirection: 'column', alignItems: 'flex-start', gap: spacing.xs,
    padding: spacing.sm,
  },
  optionCardSelected: { borderColor: colors.accent, backgroundColor: colors.accent + '14' },
  optionEmoji: { fontSize: 22 },
  optionLabel: {
    flex: 1, color: colors.white, fontSize: typography.fontSize.md, fontWeight: '900',
  },
  optionLabelSelected: { color: colors.accent },
  optionSub: {
    color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold, flex: 1,
  },
  optionCheck: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },

  continueBtn: {
    backgroundColor: colors.primary, paddingVertical: spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, marginTop: spacing.md, borderWidth: borders.thin, borderColor: colors.border,
  },
  continueBtnDisabled: { backgroundColor: colors.surface, borderColor: colors.border },
  continueBtnText: { color: colors.white, fontSize: typography.fontSize.md, fontWeight: '900', letterSpacing: 3 },
  continueBtnTextDisabled: { color: colors.inactive },

  // Rank reveal
  revealWrap: {
    flex: 1, paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.lg,
  },
  revealEyebrow: {
    color: colors.inactive, fontSize: 10, fontWeight: '900', letterSpacing: 3,
  },
  revealBadgeArea: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center' },
  revealGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 90,
    backgroundColor: '#FFB80018',
    borderWidth: 1,
    borderColor: '#FFB80040',
  },
  revealBadgeAnim: { alignItems: 'center', justifyContent: 'center' },
  revealBadge: {
    width: 148, height: 148, borderRadius: 74,
    borderWidth: 4, borderColor: '#FFB800',
    backgroundColor: '#FFB80018',
    alignItems: 'center', justifyContent: 'center',
  },
  revealBadgeInner: {
    width: 132, height: 132, borderRadius: 66,
    borderWidth: 2, borderColor: '#FFB80050',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  revealBadgeLevel: { color: '#FFB800', fontSize: 34, fontWeight: '900', letterSpacing: -1 },
  revealBadgeName:  { color: '#FFB800', fontSize: 9,  fontWeight: '900', letterSpacing: 1.5, textAlign: 'center' },

  revealRankName: { color: colors.white, fontSize: typography.fontSize.xxl, fontWeight: '900' },
  revealRankLevel: { color: '#FFB800', fontSize: typography.fontSize.md, fontWeight: '700', letterSpacing: 2 },

  revealDesc: { borderWidth: borders.thin, borderColor: colors.border, padding: spacing.md },
  revealDescText: {
    color: colors.inactive, fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold, lineHeight: 20, textAlign: 'center',
  },

  rankLadder: {
    width: '100%', backgroundColor: colors.surface,
    borderWidth: borders.thin, borderColor: colors.border,
    padding: spacing.sm, gap: spacing.sm,
  },
  ladderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ladderDot: { width: 8, height: 8, borderRadius: 4 },
  ladderName: { flex: 1, fontSize: typography.fontSize.sm, fontWeight: '700' },
  ladderYouChip: { borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 3 },
  ladderYouText: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  ladderEllipsis: { color: colors.inactive, textAlign: 'center', letterSpacing: 4, fontSize: 10 },

  revealBtn: {
    backgroundColor: colors.accent, paddingVertical: spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, borderWidth: borders.thin, borderColor: colors.border,
  },
  revealBtnText: {
    color: colors.background, fontSize: typography.fontSize.md, fontWeight: '900', letterSpacing: 3,
  },
});
