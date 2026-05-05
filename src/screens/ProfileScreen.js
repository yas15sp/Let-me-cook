import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borders } from '../theme';

const { width: W } = Dimensions.get('window');

const USER = {
  username: 'yas15sp',
  level: 12,
  rank: 'CHEF DE PARTIE',
  nextRank: 'SOUS CHEF',
  xp: 3400,
  xpToNext: 5000,
  dishesCooked: 47,
  totalVotes: 8312,
  streak: 6,
  globalRank: 214,
};

const RANKS = [
  { name: 'KITCHEN HAND', color: '#555555', minLevel: 1 },
  { name: 'COMMIS CHEF',  color: '#AAAAAA', minLevel: 5 },
  { name: 'CHEF DE PARTIE', color: colors.accent, minLevel: 10 },
  { name: 'SOUS CHEF',    color: colors.primary, minLevel: 20 },
  { name: 'HEAD CHEF',    color: colors.gold,    minLevel: 35 },
  { name: 'EXECUTIVE CHEF', color: colors.success, minLevel: 50 },
];

const ACHIEVEMENTS = [
  { id: 'first_flame',    icon: 'flame',        label: 'FIRST FLAME',    desc: 'Cook your first dish',            unlocked: true  },
  { id: 'crowd_pleaser',  icon: 'heart',        label: 'CROWD PLEASER',  desc: 'Earn 100 votes on one dish',      unlocked: true  },
  { id: 'heat_seeker',    icon: 'trending-up',  label: 'HEAT SEEKER',    desc: '5-day cook streak',               unlocked: true  },
  { id: 'stage_master',   icon: 'camera',       label: 'STAGE MASTER',   desc: 'Complete all 3 stages perfectly', unlocked: true  },
  { id: 'event_winner',   icon: 'trophy',       label: 'EVENT WINNER',   desc: 'Win a weekly event',              unlocked: false },
  { id: 'iron_chef',      icon: 'restaurant',   label: 'IRON CHEF',      desc: 'Cook 50 dishes',                  unlocked: false },
  { id: 'social_fire',    icon: 'share-social', label: 'SOCIAL FIRE',    desc: 'Share 10 clips to social',        unlocked: false },
  { id: 'top_ten',        icon: 'podium',       label: 'TOP TEN',        desc: 'Reach global top 10',             unlocked: false },
];

const ALL_MEALS = [
  { id: '1',  dish: 'Spicy Korean Tacos',    votes: 412,  placement: '#3',  event: 'STREET FOOD SHOWDOWN', type: 'event', cookTime: '34:12', verified: true  },
  { id: '2',  dish: 'Smoked Brisket Slider', votes: 287,  placement: '#7',  event: 'BBQ WEEK',             type: 'event', cookTime: '58:44', verified: true  },
  { id: '3',  dish: 'Miso Ramen Bowl',       votes: 634,  placement: '#1',  event: 'NOODLE FEST',          type: 'event', cookTime: '47:20', verified: true  },
  { id: '4',  dish: 'Harissa Lamb Chops',    votes: 198,  placement: '#12', event: 'OPEN COOK',            type: 'open',  cookTime: '28:05', verified: true  },
  { id: '5',  dish: 'Truffle Arancini',      votes: 521,  placement: '#2',  event: 'ITALIAN WEEK',         type: 'event', cookTime: '1:12:08', verified: true  },
  { id: '6',  dish: 'Jerk Chicken Bowl',     votes: 143,  placement: '#18', event: 'OPEN COOK',            type: 'open',  cookTime: '22:33', verified: false },
  { id: '7',  dish: 'Lobster Bisque',        votes: 389,  placement: '#5',  event: 'SEAFOOD SLAM',         type: 'event', cookTime: '44:15', verified: true  },
  { id: '8',  dish: 'Shakshuka Deluxe',      votes: 276,  placement: '#8',  event: 'OPEN COOK',            type: 'open',  cookTime: '19:50', verified: true  },
  { id: '9',  dish: 'Wagyu Beef Tacos',      votes: 892,  placement: '#1',  event: 'TACO TUESDAY',         type: 'event', cookTime: '38:42', verified: true  },
  { id: '10', dish: 'Kimchi Fried Rice',     votes: 167,  placement: '#15', event: 'OPEN COOK',            type: 'open',  cookTime: '16:20', verified: true  },
];

const MEAL_FILTERS = ['ALL', 'EVENTS', 'OPEN', 'PODIUM'];

function isPodium(p) { return ['#1', '#2', '#3'].includes(p); }

const RANK_COLORS = RANKS.reduce((acc, r) => ({ ...acc, [r.name]: r.color }), {});

function pad(n) { return String(n).padStart(2, '0'); }

function StatBox({ value, label, accent }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, accent && { color: accent }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function RankLadder({ currentRank }) {
  const currentIdx = RANKS.findIndex(r => r.name === currentRank);
  return (
    <View style={styles.rankLadder}>
      {RANKS.map((r, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <View key={r.name} style={styles.rankLadderRow}>
            <View style={[styles.rankLadderDot, { backgroundColor: done || active ? r.color : colors.border }]}>
              {done && <Ionicons name="checkmark" size={10} color={colors.background} />}
              {active && <View style={styles.rankLadderPulse} />}
            </View>
            {i < RANKS.length - 1 && (
              <View style={[styles.rankLadderLine, done && { backgroundColor: RANKS[i].color }]} />
            )}
            <View style={styles.rankLadderInfo}>
              <Text style={[styles.rankLadderName, { color: done || active ? r.color : colors.inactive }]}>
                {r.name}
              </Text>
              <Text style={styles.rankLadderLevel}>LV {r.minLevel}+</Text>
            </View>
            {active && (
              <View style={[styles.rankCurrentChip, { borderColor: r.color }]}>
                <Text style={[styles.rankCurrentChipText, { color: r.color }]}>YOU</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function AchievementBadge({ item }) {
  return (
    <View style={[styles.badge, !item.unlocked && styles.badgeLocked]}>
      <View style={[styles.badgeIcon, { borderColor: item.unlocked ? colors.accent : colors.border }]}>
        <Ionicons name={item.icon} size={22} color={item.unlocked ? colors.accent : colors.inactive} />
      </View>
      <Text style={[styles.badgeLabel, !item.unlocked && { color: colors.inactive }]}>{item.label}</Text>
      <Text style={styles.badgeDesc}>{item.desc}</Text>
      {!item.unlocked && (
        <View style={styles.badgeLock}>
          <Ionicons name="lock-closed" size={10} color={colors.inactive} />
        </View>
      )}
    </View>
  );
}

const MEAL_CARD_W = (W - spacing.md * 2 - spacing.xs) / 2;

function MealCard({ item }) {
  const podium = isPodium(item.placement);
  const isFirst = item.placement === '#1';
  const placementColor = isFirst ? colors.gold : podium ? colors.inactive : colors.border;

  return (
    <View style={[styles.mealCard, podium && styles.mealCardPodium, isFirst && styles.mealCardFirst]}>
      {/* Image area with 3-stage clip strip */}
      <View style={styles.mealImage}>
        <Ionicons name="restaurant" size={32} color="#1a1a1a" />
        {/* Mini clip strip overlay */}
        <View style={styles.mealClipStrip}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[styles.mealClipFrame, i === 1 && styles.mealClipFrameMid]}>
              <Ionicons name="camera" size={8} color="#333" />
            </View>
          ))}
        </View>
        {/* Podium crown */}
        {podium && (
          <View style={[styles.mealPodiumBadge, { backgroundColor: isFirst ? colors.gold : colors.surface }]}>
            <Text style={[styles.mealPodiumText, { color: isFirst ? colors.background : colors.inactive }]}>
              {item.placement}
            </Text>
          </View>
        )}
        {/* Verified dot */}
        {item.verified && <View style={styles.mealVerifiedDot} />}
      </View>

      {/* Info area */}
      <View style={styles.mealInfo}>
        <Text style={styles.mealDish} numberOfLines={2}>{item.dish}</Text>
        <Text style={styles.mealEvent} numberOfLines={1}>{item.event}</Text>
        <View style={styles.mealMeta}>
          <View style={styles.mealVoteRow}>
            <Ionicons name="flame" size={10} color={colors.primary} />
            <Text style={styles.mealVotes}>{item.votes.toLocaleString()}</Text>
          </View>
          <View style={styles.mealTimeRow}>
            <Ionicons name="time-outline" size={10} color={colors.inactive} />
            <Text style={styles.mealTime}>{item.cookTime}</Text>
          </View>
        </View>
        {!podium && (
          <Text style={styles.mealPlacement}>{item.placement}</Text>
        )}
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const xpPct = (USER.xp / USER.xpToNext) * 100;
  const rankColor = RANK_COLORS[USER.rank] || colors.accent;
  const [mealFilter, setMealFilter] = useState('ALL');

  const filteredMeals = ALL_MEALS.filter(m => {
    if (mealFilter === 'EVENTS') return m.type === 'event';
    if (mealFilter === 'OPEN')   return m.type === 'open';
    if (mealFilter === 'PODIUM') return isPodium(m.placement);
    return true;
  });

  const leftCol  = filteredMeals.filter((_, i) => i % 2 === 0);
  const rightCol = filteredMeals.filter((_, i) => i % 2 === 1);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* App bar */}
        <View style={styles.appBar}>
          <Text style={styles.appBarTitle}>PROFILE</Text>
          <TouchableOpacity style={styles.settingsBtn}>
            <Ionicons name="settings-outline" size={20} color={colors.inactive} />
          </TouchableOpacity>
        </View>

        {/* Hero card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.avatarWrap}>
              <View style={[styles.avatar, { borderColor: rankColor }]}>
                <Text style={styles.avatarInitials}>
                  {USER.username.slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={[styles.levelBadge, { backgroundColor: rankColor }]}>
                <Text style={styles.levelBadgeText}>LV{USER.level}</Text>
              </View>
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.heroUsername}>{USER.username}</Text>
              <View style={[styles.rankChip, { borderColor: rankColor }]}>
                <Text style={[styles.rankChipText, { color: rankColor }]}>{USER.rank}</Text>
              </View>
              <View style={styles.globalRankRow}>
                <Ionicons name="earth" size={12} color={colors.inactive} />
                <Text style={styles.globalRankText}>#{USER.globalRank} GLOBAL</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.editBtn}>
              <Ionicons name="pencil" size={14} color={colors.accent} />
              <Text style={styles.editBtnText}>EDIT</Text>
            </TouchableOpacity>
          </View>

          {/* XP bar */}
          <View style={styles.xpSection}>
            <View style={styles.xpRow}>
              <Text style={styles.xpLabel}>XP TO {USER.nextRank}</Text>
              <Text style={styles.xpNums}>{USER.xp.toLocaleString()} / {USER.xpToNext.toLocaleString()}</Text>
            </View>
            <View style={styles.xpTrack}>
              <View style={[styles.xpFill, { width: `${xpPct}%` }]} />
              <View style={[styles.xpMarker, { left: `${xpPct}%` }]} />
            </View>
          </View>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <StatBox value={USER.dishesCooked} label="DISHES" />
          <View style={styles.statDivider} />
          <StatBox value={USER.totalVotes.toLocaleString()} label="VOTES" accent={colors.primary} />
          <View style={styles.statDivider} />
          <StatBox value={`${USER.streak}🔥`} label="STREAK" accent={colors.gold} />
          <View style={styles.statDivider} />
          <StatBox value={`#${USER.globalRank}`} label="RANK" accent={colors.accent} />
        </View>

        {/* Rank ladder */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>RANK LADDER</Text>
            <View style={styles.sectionLine} />
          </View>
          <View style={styles.card}>
            <RankLadder currentRank={USER.rank} />
          </View>
        </View>

        {/* Achievements */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>ACHIEVEMENTS</Text>
            <Text style={styles.sectionCount}>
              {ACHIEVEMENTS.filter(a => a.unlocked).length}/{ACHIEVEMENTS.length}
            </Text>
            <View style={styles.sectionLine} />
          </View>
          <View style={styles.badgeGrid}>
            {ACHIEVEMENTS.map(a => <AchievementBadge key={a.id} item={a} />)}
          </View>
        </View>

        {/* My Meals */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>MY MEALS</Text>
            <Text style={styles.sectionCount}>{ALL_MEALS.length}</Text>
            <View style={styles.sectionLine} />
          </View>
          {/* Filter strip */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
            {MEAL_FILTERS.map(f => {
              const active = mealFilter === f;
              return (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterBtn, active && styles.filterBtnActive]}
                  onPress={() => setMealFilter(f)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterBtnText, active && styles.filterBtnTextActive]}>{f}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {/* 2-column masonry grid */}
          {filteredMeals.length === 0 ? (
            <View style={styles.mealsEmpty}>
              <Ionicons name="restaurant-outline" size={32} color={colors.border} />
              <Text style={styles.mealsEmptyText}>NO MEALS YET</Text>
            </View>
          ) : (
            <View style={styles.mealsGrid}>
              <View style={styles.mealsCol}>
                {leftCol.map(m => <MealCard key={m.id} item={m} />)}
              </View>
              <View style={styles.mealsCol}>
                {rightCol.map(m => <MealCard key={m.id} item={m} />)}
              </View>
            </View>
          )}
        </View>

        {/* Account actions */}
        <View style={styles.accountActions}>
          <TouchableOpacity style={styles.accountRow}>
            <Ionicons name="share-outline" size={18} color={colors.inactive} />
            <Text style={styles.accountRowText}>SHARE PROFILE</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.border} />
          </TouchableOpacity>
          <View style={styles.accountDivider} />
          <TouchableOpacity style={styles.accountRow}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.inactive} />
            <Text style={styles.accountRowText}>VERIFICATION STATUS</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.border} />
          </TouchableOpacity>
          <View style={styles.accountDivider} />
          <TouchableOpacity style={styles.accountRow}>
            <Ionicons name="log-out-outline" size={18} color={colors.primary} />
            <Text style={[styles.accountRowText, { color: colors.primary }]}>SIGN OUT</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },

  appBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, paddingTop: spacing.sm },
  appBarTitle: { color: colors.white, fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  settingsBtn: { width: 38, height: 38, borderWidth: borders.thin, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },

  // Hero card
  heroCard: { backgroundColor: colors.surface, borderWidth: borders.medium, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  avatarWrap: { position: 'relative', marginRight: spacing.md },
  avatar: { width: 72, height: 72, borderWidth: borders.medium, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: colors.white, fontSize: typography.fontSize.xxl, fontWeight: typography.fontWeight.black },
  levelBadge: { position: 'absolute', bottom: -8, right: -8, paddingHorizontal: spacing.xs, paddingVertical: 2 },
  levelBadgeText: { color: colors.background, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black },
  heroInfo: { flex: 1, gap: spacing.xs },
  heroUsername: { color: colors.white, fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wide },
  rankChip: { borderWidth: borders.thin, paddingHorizontal: spacing.sm, paddingVertical: 2, alignSelf: 'flex-start' },
  rankChipText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  globalRankRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  globalRankText: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderWidth: borders.thin, borderColor: colors.accent, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  editBtnText: { color: colors.accent, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wide },
  xpSection: { gap: spacing.xs },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between' },
  xpLabel: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold, letterSpacing: typography.letterSpacing.wider },
  xpNums: { color: colors.accent, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },
  xpTrack: { height: 12, backgroundColor: colors.background, borderWidth: borders.thin, borderColor: colors.border, overflow: 'hidden', position: 'relative' },
  xpFill: { height: '100%', backgroundColor: colors.accent },
  xpMarker: { position: 'absolute', top: 0, width: 3, height: '100%', backgroundColor: colors.white, marginLeft: -1 },

  // Stats
  statsGrid: { flexDirection: 'row', borderWidth: borders.thin, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: spacing.md },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, gap: 2 },
  statValue: { color: colors.white, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.black },
  statLabel: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold, letterSpacing: typography.letterSpacing.wider },
  statDivider: { width: borders.thin, backgroundColor: colors.border },

  // Section
  section: { marginBottom: spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  sectionTitle: { color: colors.white, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  sectionLine: { flex: 1, height: 2, backgroundColor: colors.border },
  sectionCount: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },
  sectionAction: { color: colors.accent, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wide },
  card: { backgroundColor: colors.surface, borderWidth: borders.thin, borderColor: colors.border, padding: spacing.md },

  // Rank ladder
  rankLadder: { gap: 0 },
  rankLadderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, minHeight: 40 },
  rankLadderDot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginTop: 2, zIndex: 1 },
  rankLadderPulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.background },
  rankLadderLine: { position: 'absolute', left: 8, top: 20, width: 2, height: 28, backgroundColor: colors.border },
  rankLadderInfo: { flex: 1, paddingBottom: spacing.sm },
  rankLadderName: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wide },
  rankLadderLevel: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },
  rankCurrentChip: { borderWidth: borders.thin, paddingHorizontal: spacing.xs, paddingVertical: 1, marginTop: 2 },
  rankCurrentChipText: { fontSize: 9, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },

  // Achievements
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  badge: { width: (W - spacing.md * 2 - spacing.xs * 3) / 4, backgroundColor: colors.surface, borderWidth: borders.thin, borderColor: colors.border, padding: spacing.xs, alignItems: 'center', gap: 4 },
  badgeLocked: { opacity: 0.45 },
  badgeIcon: { width: 44, height: 44, borderWidth: borders.thin, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  badgeLabel: { color: colors.white, fontSize: 8, fontWeight: typography.fontWeight.black, letterSpacing: 0.5, textAlign: 'center' },
  badgeDesc: { color: colors.inactive, fontSize: 7, fontWeight: typography.fontWeight.bold, textAlign: 'center', lineHeight: 10 },
  badgeLock: { position: 'absolute', top: spacing.xs, right: spacing.xs },

  // Filter strip
  filterScroll: { marginBottom: spacing.sm },
  filterRow: { flexDirection: 'row', gap: spacing.xs },
  filterBtn: { borderWidth: borders.thin, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: colors.surface },
  filterBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterBtnText: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  filterBtnTextActive: { color: colors.background },

  // Meals grid
  mealsGrid: { flexDirection: 'row', gap: spacing.xs },
  mealsCol: { flex: 1, gap: spacing.xs },
  mealsEmpty: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  mealsEmptyText: { color: colors.border, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },

  // Meal card
  mealCard: { backgroundColor: colors.surface, borderWidth: borders.thin, borderColor: colors.border, overflow: 'hidden', marginBottom: 0 },
  mealCardPodium: { borderColor: colors.inactive },
  mealCardFirst: { borderColor: colors.gold, borderWidth: borders.medium },
  mealImage: { height: MEAL_CARD_W * 0.85, backgroundColor: '#0d0d0d', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  mealClipStrip: { position: 'absolute', top: spacing.xs, right: spacing.xs, flexDirection: 'column', gap: 2 },
  mealClipFrame: { width: 18, height: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  mealClipFrameMid: { borderColor: colors.accent },
  mealPodiumBadge: { position: 'absolute', top: spacing.xs, left: spacing.xs, paddingHorizontal: spacing.xs, paddingVertical: 2 },
  mealPodiumText: { fontSize: 10, fontWeight: typography.fontWeight.black },
  mealVerifiedDot: { position: 'absolute', bottom: spacing.xs, right: spacing.xs, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  mealInfo: { padding: spacing.sm, gap: 3 },
  mealDish: { color: colors.white, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.black, lineHeight: 16 },
  mealEvent: { color: colors.primary, fontSize: 8, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wide },
  mealMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mealVoteRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  mealVotes: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },
  mealTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  mealTime: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },
  mealPlacement: { color: colors.border, fontSize: 9, fontWeight: typography.fontWeight.black },

  // Account actions
  accountActions: { borderWidth: borders.thin, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: spacing.md },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  accountRowText: { flex: 1, color: colors.inactive, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  accountDivider: { height: borders.thin, backgroundColor: colors.border },
});
