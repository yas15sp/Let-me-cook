import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Alert, Image, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { getProfile, getUserCooks, deleteCook, uploadAvatar } from '../lib/api';
import { xpProgress, nextLevelName, rankFromXp } from '../lib/xp';
import { colors, spacing, typography, borders } from '../theme';
import ActiveDuelBanner from '../components/ActiveDuelBanner';

const { width: W } = Dimensions.get('window');

const RANKS = [
  { name: 'Gold Cook',        color: '#FFB800', tier: 'I–III'  },
  { name: 'Emerald Cook',     color: '#00C47A', tier: 'I–III'  },
  { name: 'Diamond Cook',     color: '#88CCFF', tier: 'I–III'  },
  { name: 'Chef',             color: '#E8001C', tier: 'I–III'  },
  { name: 'Exec Chef',        color: '#A855F7', tier: 'I–III'  },
  { name: 'Master Chef',      color: '#FF6B00', tier: 'I–III'  },
  { name: 'World Class Chef', color: '#FFFFFF', tier: 'I–III'  },
];

const ACHIEVEMENTS = [
  { id: 'let_me_cook',   icon: 'flame',       label: 'LET ME COOK!',  desc: 'Submit your very first cook',         xp: 50,  check: d => d.cookCount >= 1 },
  { id: 'hired',         icon: 'people',      label: 'HIRED!',        desc: 'Add your first friend',               xp: 50,  check: d => d.friendsCount >= 1 },
  { id: 'sous_me',       icon: 'ribbon',      label: 'SOUS ME',       desc: 'Reach Emerald Cook I',                xp: 100, check: d => RANKS.findIndex(r => r.name === d.rank) >= 1 },
  { id: 'on_a_roll',     icon: 'trending-up', label: 'ON A ROLL',     desc: 'Cook 3 days in a row',                xp: 75,  check: d => d.streak >= 3 },
  { id: 'heat_check',    icon: 'flash',       label: 'HEAT CHECK',    desc: 'Submit 5 cooks in a single day',      xp: 100, check: d => d.heatCheckDone },
  { id: 'throw_down',    icon: 'medal',       label: 'THROW DOWN',    desc: 'Complete your first duel',            xp: 75,  check: d => d.completedDuelsCount >= 1 },
  { id: 'fan_favourite', icon: 'heart',       label: 'FAN FAVOURITE', desc: 'Receive 10 votes across all cooks',  xp: 100, check: d => d.totalVotes >= 10 },
  { id: 'clocked_in',    icon: 'time',        label: 'CLOCKED IN',    desc: 'Submit 10 total cooks',               xp: 50,  check: d => d.cookCount >= 10 },
];
const achievementSeenKey = (uid) => `@achievements_seen_${uid}`;

function cookToMeal(cook) {
  const secs = cook.cook_time_secs ?? 0;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const cookTime = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  const photos = cook.photo_urls ?? [];
  return {
    id: cook.id,
    dish: cook.dish_name,
    votes: cook.votes?.length ?? 0,
    placement: null,
    event: cook.event_id ? 'EVENT COOK' : 'OPEN COOK',
    type: cook.event_id ? 'event' : 'open',
    cookTime,
    verified: cook.verified,
    finalePhoto: photos.length ? photos[photos.length - 1] : null,
  };
}

const MEAL_FILTERS = ['ALL', 'EVENTS', 'OPEN', 'PODIUM'];

function isPodium(p) { return p != null && ['#1', '#2', '#3'].includes(p); }

const RANK_COLORS = RANKS.reduce((acc, r) => ({ ...acc, [r.name]: r.color }), {});

function pad(n) { return String(n).padStart(2, '0'); }

function StatBox({ value, label, accent, streak }) {
  return (
    <View style={styles.statBox}>
      <View style={styles.statValueRow}>
        <Text style={[styles.statValue, accent && { color: accent }]}>{value}</Text>
        {streak && <Ionicons name="flame" size={14} color={colors.gold} />}
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function RankLadder({ xp }) {
  const { rank: currentRank } = rankFromXp(xp ?? 0);
  const currentIdx = RANKS.findIndex(r => r.name === currentRank);
  const isMaxRank = currentRank === 'World Class Chef';
  return (
    <View style={styles.rankLadder}>
      {isMaxRank && (
        <View style={styles.maxRankBanner}>
          <Ionicons name="trophy" size={14} color="#FFFFFF" />
          <Text style={styles.maxRankBannerText}>MAXIMUM RANK ACHIEVED</Text>
          <Ionicons name="trophy" size={14} color="#FFFFFF" />
        </View>
      )}
      {RANKS.map((r, i) => {
        const done = isMaxRank ? true : i < currentIdx;
        const active = !isMaxRank && i === currentIdx;
        const isWC = r.name === 'World Class Chef';
        return (
          <View key={r.name} style={styles.rankLadderRow}>
            <View style={[
              styles.rankLadderDot,
              { backgroundColor: done || active ? r.color : colors.border },
              isWC && isMaxRank && styles.rankLadderDotWC,
            ]}>
              {(done && !isWC) && <Ionicons name="checkmark" size={10} color={colors.background} />}
              {isWC && isMaxRank && <Ionicons name="trophy" size={10} color={colors.background} />}
              {active && <View style={styles.rankLadderPulse} />}
            </View>
            {i < RANKS.length - 1 && (
              <View style={[styles.rankLadderLine, (done || active) && { backgroundColor: r.color }]} />
            )}
            <View style={styles.rankLadderInfo}>
              <Text style={[styles.rankLadderName, { color: done || active ? r.color : colors.inactive }]}>
                {r.name}
              </Text>
              <Text style={styles.rankLadderLevel}>TIER {r.tier}</Text>
            </View>
            {active && (
              <View style={[styles.rankCurrentChip, { borderColor: r.color }]}>
                <Text style={[styles.rankCurrentChipText, { color: r.color }]}>YOU</Text>
              </View>
            )}
            {isWC && isMaxRank && (
              <View style={styles.maxRankChip}>
                <Text style={styles.maxRankChipText}>👑 MAX</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function AchievementBadge({ item, unlocked }) {
  return (
    <View style={[styles.badge, !unlocked && styles.badgeLocked, unlocked && styles.badgeUnlocked]}>
      <View style={[styles.badgeIcon, { borderColor: unlocked ? colors.success : colors.border }]}>
        <Ionicons name={item.icon} size={22} color={unlocked ? colors.success : colors.inactive} />
      </View>
      <Text style={[styles.badgeLabel, { color: unlocked ? colors.white : colors.inactive }]}>{item.label}</Text>
      <Text style={styles.badgeDesc}>{item.desc}</Text>
      <Text style={[styles.badgeXp, { color: unlocked ? colors.success : '#333' }]}>+{item.xp} XP</Text>
      {!unlocked && (
        <View style={styles.badgeLock}>
          <Ionicons name="lock-closed" size={10} color={colors.inactive} />
        </View>
      )}
    </View>
  );
}

const MEAL_CARD_W = (W - spacing.md * 2 - spacing.xs) / 2;

function MealCard({ item, onDelete }) {
  const navigation = useNavigation();
  const podium = isPodium(item.placement);
  const isFirst = item.placement === '#1';

  return (
    <TouchableOpacity
      style={[styles.mealCard, podium && styles.mealCardPodium, isFirst && styles.mealCardFirst]}
      onPress={() => navigation.navigate('PostDetail', { cookId: item.id })}
      activeOpacity={0.88}
    >
      <TouchableOpacity
        style={styles.mealDeleteBtn}
        onPress={() => onDelete(item.id)}
        hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
      >
        <Ionicons name="trash-outline" size={11} color={colors.primary} />
      </TouchableOpacity>

      {/* Finale photo */}
      <View style={styles.mealImage}>
        {item.finalePhoto ? (
          <Image source={{ uri: item.finalePhoto }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <>
            <View style={styles.mealImageStripes} pointerEvents="none">
              {Array.from({ length: 6 }).map((_, i) => (
                <View key={i} style={[styles.mealImageStripe, { opacity: isFirst ? 0.12 : 0.05 }]} />
              ))}
            </View>
            <Ionicons name="restaurant" size={28} color={isFirst ? colors.gold : '#222'} />
          </>
        )}
        {podium && (
          <View style={[styles.mealPodiumBadge, { backgroundColor: isFirst ? colors.gold : colors.surface }]}>
            <Text style={[styles.mealPodiumText, { color: isFirst ? colors.background : colors.inactive }]}>
              {item.placement}
            </Text>
          </View>
        )}
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
      </View>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const navigation = useNavigation();
  const [profile, setProfile] = useState(null);
  const [meals, setMeals] = useState([]);
  const [mealFilter, setMealFilter] = useState('ALL');
  const [userId, setUserId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [friendsCount, setFriendsCount] = useState(0);
  const [completedDuelsCount, setCompletedDuelsCount] = useState(0);
  const [heatCheckDone, setHeatCheckDone] = useState(false);
  const [achievementNotif, setAchievementNotif] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUserId(session.user.id);
    });
  }, []);

  async function handlePickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    setUploading(true);
    try {
      const url = await uploadAvatar(userId, uri);
      setProfile(prev => prev ? { ...prev, avatar_url: url } : prev);
    } catch (e) {
      Alert.alert('Upload failed', e?.message ?? 'Could not update avatar. Try again.');
    } finally {
      setUploading(false);
    }
  }

  useFocusEffect(useCallback(() => {
    if (!userId) return;
    getProfile(userId).then(setProfile).catch(() => {});
    getUserCooks(userId).then(cooks => {
      setMeals(cooks.map(cookToMeal));
      const byDay = {};
      cooks.forEach(c => {
        const day = (c.created_at || '').slice(0, 10);
        if (day) byDay[day] = (byDay[day] || 0) + 1;
      });
      setHeatCheckDone(Object.values(byDay).some(n => n >= 5));
    }).catch(() => {});
    supabase.from('friendships')
      .select('*', { count: 'exact', head: true })
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .eq('status', 'accepted')
      .then(({ count }) => setFriendsCount(count ?? 0))
      .catch(() => {});
    supabase.from('duels')
      .select('*', { count: 'exact', head: true })
      .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
      .eq('status', 'completed')
      .then(({ count }) => setCompletedDuelsCount(count ?? 0))
      .catch(() => {});
  }, [userId]));

  const { rank: computedRank, tier: computedTier } = rankFromXp(profile?.xp ?? 0);

  const achievementData = {
    cookCount: meals.length,
    friendsCount,
    rank: computedRank,
    streak: profile?.streak ?? 0,
    heatCheckDone,
    completedDuelsCount,
    totalVotes: profile?.total_votes ?? 0,
  };

  const unlockedSet = useMemo(() => {
    return new Set(ACHIEVEMENTS.filter(a => a.check(achievementData)).map(a => a.id));
  }, [meals.length, friendsCount, computedRank, profile?.streak, profile?.total_votes, heatCheckDone, completedDuelsCount]);

  useEffect(() => {
    if (!userId || !profile) return;
    if (!unlockedSet.size) return;
    const key = achievementSeenKey(userId);
    AsyncStorage.getItem(key).then(async raw => {
      const seen = new Set(JSON.parse(raw || '[]'));
      const newOnes = ACHIEVEMENTS.filter(a => unlockedSet.has(a.id) && !seen.has(a.id));
      if (!newOnes.length) return;
      const first = newOnes[0];
      try {
        await supabase.rpc('increment_xp', {
          p_user_id: userId,
          base_amount: first.xp,
          p_apply_bonuses: false,
        });
      } catch {}
      setAchievementNotif(first);
      AsyncStorage.setItem(key, JSON.stringify([...seen, ...newOnes.map(a => a.id)]));
    }).catch(() => {});
  }, [unlockedSet.size, userId, !!profile]);

  const { current: xpInLevel, needed: xpNeeded, pct: xpPct } = xpProgress(profile?.xp ?? 0);
  const rankColor = RANK_COLORS[computedRank] || colors.accent;
  const nextLevel = nextLevelName(profile?.xp ?? 0);

  const handleDeleteMeal = (mealId) => {
    Alert.alert(
      'Delete Cook',
      'This will permanently remove this cook from the feed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'DELETE',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCook(mealId);
              setMeals(prev => prev.filter(m => m.id !== mealId));
            } catch {
              Alert.alert('Error', 'Could not delete. Try again.');
            }
          },
        },
      ]
    );
  };

  const filteredMeals = meals.filter(m => {
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
          <Text style={styles.appBarTitle}>Profile</Text>
          <TouchableOpacity style={styles.settingsBtn} onPress={() => navigation.navigate('Settings')}>
            <Ionicons name="settings-outline" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
        <ActiveDuelBanner />

        {/* Hero card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <TouchableOpacity style={styles.avatarWrap} onPress={handlePickAvatar} activeOpacity={0.8} disabled={uploading}>
              <View style={[styles.avatar, { borderColor: rankColor }]}>
                {profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={[StyleSheet.absoluteFill, styles.avatarImg]} resizeMode="cover" />
                ) : (
                  <Text style={styles.avatarInitials}>
                    {(profile?.username ?? '?').slice(0, 2).toUpperCase()}
                  </Text>
                )}
                <View style={styles.avatarEditOverlay}>
                  <Ionicons name={uploading ? 'hourglass-outline' : 'camera'} size={10} color={colors.white} />
                </View>
              </View>
              <View style={[styles.levelBadge, { backgroundColor: rankColor }]}>
                <Text style={styles.levelBadgeText}>{computedTier}</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.heroInfo}>
              <Text style={styles.heroUsername}>{profile?.username ?? '...'}</Text>
              <View style={styles.globalRankRow}>
                <Ionicons name="earth" size={12} color={colors.inactive} />
                <Text style={styles.globalRankText}>
                  {profile?.global_rank ? `#${profile.global_rank} GLOBAL` : 'UNRANKED'}
                </Text>
              </View>
            </View>
          </View>

          {/* Rank banner */}
          <View style={[styles.rankBanner, { borderColor: rankColor, backgroundColor: rankColor + '14' }]}>
            <View style={[styles.rankBannerAccent, { backgroundColor: rankColor }]} />
            <View style={styles.rankBannerBody}>
              <Text style={[styles.rankBannerName, { color: rankColor }]}>
                {profile ? computedRank.toUpperCase() : '...'}
              </Text>
              <View style={[styles.rankBannerTierPill, { backgroundColor: rankColor }]}>
                <Text style={[styles.rankBannerTierText, { color: computedRank === 'World Class Chef' ? '#000' : colors.background }]}>
                  TIER {computedTier}
                </Text>
              </View>
            </View>
            {computedRank === 'World Class Chef' && (
              <Text style={styles.rankBannerCrown}>👑</Text>
            )}
          </View>

          {/* XP bar */}
          <View style={styles.xpSection}>
            <View style={styles.xpRow}>
              <Text style={styles.xpLabel}>XP TO {nextLevel ?? 'MAX RANK'}</Text>
              <Text style={styles.xpNums}>
                {nextLevel ? `${xpInLevel.toLocaleString()} / ${xpNeeded.toLocaleString()}` : 'MAX'}
              </Text>
            </View>
            <View style={styles.xpTrack}>
              <View style={[styles.xpFill, { width: `${xpPct}%`, backgroundColor: rankColor }]} />
              <View style={[styles.xpMarker, { left: `${xpPct}%` }]} />
            </View>
          </View>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <StatBox value={meals.length} label="COOKS" />
          <View style={styles.statDivider} />
          <StatBox value={(profile?.total_votes ?? 0).toLocaleString()} label="VOTES" accent={colors.primary} />
          <View style={styles.statDivider} />
          <StatBox value={`${profile?.streak ?? 0}`} label="STREAK" accent={colors.gold} streak />
          <View style={styles.statDivider} />
          <StatBox value={profile?.global_rank ? `#${profile.global_rank}` : '—'} label="RANK" accent={colors.accent} />
        </View>

        {/* Rank ladder */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>RANK LADDER</Text>
            <View style={styles.sectionLine} />
          </View>
          <View style={styles.card}>
            <RankLadder xp={profile?.xp ?? 0} />
          </View>
        </View>

        {/* Achievements */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>ACHIEVEMENTS</Text>
            <Text style={styles.sectionCount}>{unlockedSet.size}/{ACHIEVEMENTS.length}</Text>
            <View style={styles.sectionLine} />
          </View>
          <View style={styles.badgeGrid}>
            {ACHIEVEMENTS.map(a => <AchievementBadge key={a.id} item={a} unlocked={unlockedSet.has(a.id)} />)}
          </View>
        </View>

        {/* My Meals */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>MY MEALS</Text>
            <Text style={styles.sectionCount}>{meals.length}</Text>
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
                {leftCol.map(m => <MealCard key={m.id} item={m} onDelete={handleDeleteMeal} />)}
              </View>
              <View style={styles.mealsCol}>
                {rightCol.map(m => <MealCard key={m.id} item={m} onDelete={handleDeleteMeal} />)}
              </View>
            </View>
          )}
        </View>

        {/* Account actions */}
        <View style={styles.accountActions}>
          <TouchableOpacity style={styles.accountRow} onPress={() => navigation.navigate('Settings')}>
            <Ionicons name="settings-outline" size={18} color={colors.inactive} />
            <Text style={styles.accountRowText}>SETTINGS</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.border} />
          </TouchableOpacity>
          <View style={styles.accountDivider} />
          <TouchableOpacity style={styles.accountRow} onPress={async () => {
            try {
              await AsyncStorage.removeItem('@seen_winner_events');
              await supabase.auth.signOut();
            } catch {
              await supabase.auth.signOut({ scope: 'local' });
            }
          }}>
            <Ionicons name="log-out-outline" size={18} color={colors.primary} />
            <Text style={[styles.accountRowText, { color: colors.primary }]}>SIGN OUT</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      <Modal visible={!!achievementNotif} animationType="fade" transparent onRequestClose={() => setAchievementNotif(null)}>
        <View style={styles.achieveOverlay}>
          <View style={styles.achieveCard}>
            <View style={styles.achieveHeader}>
              <Ionicons name="trophy" size={13} color={colors.background} />
              <Text style={styles.achieveHeaderText}>ACHIEVEMENT UNLOCKED!</Text>
            </View>
            <View style={styles.achieveBody}>
              <View style={styles.achieveIconWrap}>
                <Ionicons name={achievementNotif?.icon || 'star'} size={38} color={colors.success} />
              </View>
              <Text style={styles.achieveName}>{achievementNotif?.label}</Text>
              <Text style={styles.achieveDesc}>{achievementNotif?.desc}</Text>
              <View style={styles.achieveXpPill}>
                <Text style={styles.achieveXpText}>+{achievementNotif?.xp} XP</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.achieveDismiss} onPress={() => setAchievementNotif(null)} activeOpacity={0.85}>
              <Text style={styles.achieveDismissText}>LET'S GO!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, paddingTop: 0 },

  appBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.primary, paddingTop: spacing.md, paddingBottom: spacing.md, paddingHorizontal: spacing.md, borderBottomWidth: borders.medium, borderBottomColor: '#000', marginHorizontal: -spacing.md, marginBottom: spacing.md },
  appBarTitle: { color: colors.white, fontSize: typography.fontSize.xxl, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wide, textTransform: 'uppercase' },
  settingsBtn: { width: 36, height: 36, borderWidth: borders.thin, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },

  // Hero card
  heroCard: { backgroundColor: colors.surface, borderWidth: borders.medium, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  avatarWrap: { position: 'relative', marginRight: spacing.md },
  avatar: { width: 72, height: 72, borderWidth: borders.medium, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 72, height: 72 },
  avatarInitials: { color: colors.white, fontSize: typography.fontSize.xxl, fontWeight: typography.fontWeight.black },
  avatarEditOverlay: { position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  levelBadge: { position: 'absolute', bottom: -8, right: -8, paddingHorizontal: spacing.xs, paddingVertical: 2 },
  levelBadgeText: { color: colors.background, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black },
  heroInfo: { flex: 1, gap: spacing.xs },
  heroUsername: { color: colors.white, fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wide },
  globalRankRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  globalRankText: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },
  rankBanner: { flexDirection: 'row', alignItems: 'center', borderWidth: borders.medium, marginBottom: spacing.md, overflow: 'hidden' },
  rankBannerAccent: { width: 5, alignSelf: 'stretch' },
  rankBannerBody: { flex: 1, flexDirection: 'column', paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  rankBannerName: { fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider, marginBottom: 4 },
  rankBannerTierPill: { paddingHorizontal: spacing.sm, paddingVertical: 3, alignSelf: 'flex-start' },
  rankBannerTierText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  rankBannerCrown: { fontSize: 22, paddingRight: spacing.sm },
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
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
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
  rankLadderDotWC: { borderWidth: 2, borderColor: '#aaaaaa' },
  maxRankBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: '#1a1a1a', borderWidth: borders.thin, borderColor: '#FFFFFF', paddingVertical: spacing.sm, marginBottom: spacing.md },
  maxRankBannerText: { color: '#FFFFFF', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  maxRankChip: { backgroundColor: '#1a1a1a', borderWidth: borders.thin, borderColor: '#FFFFFF', paddingHorizontal: spacing.xs, paddingVertical: 1 },
  maxRankChipText: { color: '#FFFFFF', fontSize: 9, fontWeight: typography.fontWeight.black, letterSpacing: 0.5 },

  // Achievements
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  badge: { width: (W - spacing.md * 2 - spacing.xs * 3) / 4, backgroundColor: colors.surface, borderWidth: borders.thin, borderColor: colors.border, padding: spacing.xs, alignItems: 'center', gap: 4 },
  badgeLocked: { opacity: 0.4 },
  badgeUnlocked: { borderColor: colors.success, backgroundColor: '#0a1f0a' },
  badgeIcon: { width: 44, height: 44, borderWidth: borders.thin, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  badgeLabel: { fontSize: 8, fontWeight: typography.fontWeight.black, letterSpacing: 0.5, textAlign: 'center' },
  badgeDesc: { color: colors.inactive, fontSize: 7, fontWeight: typography.fontWeight.bold, textAlign: 'center', lineHeight: 10 },
  badgeXp: { fontSize: 7, fontWeight: typography.fontWeight.black, letterSpacing: 0.5 },
  badgeLock: { position: 'absolute', top: spacing.xs, right: spacing.xs },

  // Achievement unlock modal
  achieveOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  achieveCard: { backgroundColor: colors.surface, borderWidth: borders.medium, borderColor: colors.success, width: '100%', overflow: 'hidden' },
  achieveHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.success, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  achieveHeaderText: { color: colors.background, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  achieveBody: { alignItems: 'center', padding: spacing.lg, gap: spacing.sm },
  achieveIconWrap: { width: 72, height: 72, borderWidth: borders.medium, borderColor: colors.success, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a1f0a' },
  achieveName: { color: colors.white, fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider, textAlign: 'center' },
  achieveDesc: { color: colors.inactive, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, textAlign: 'center' },
  achieveXpPill: { backgroundColor: '#1a3a1a', borderWidth: borders.thin, borderColor: colors.success, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, marginTop: spacing.xs },
  achieveXpText: { color: colors.success, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  achieveDismiss: { backgroundColor: colors.success, paddingVertical: spacing.md, alignItems: 'center' },
  achieveDismissText: { color: colors.background, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },

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
  mealDeleteBtn: { position: 'absolute', top: spacing.xs, right: spacing.xs, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.75)', borderWidth: borders.thin, borderColor: colors.primary, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  mealCardPodium: { borderColor: colors.inactive },
  mealCardFirst: { borderColor: colors.gold, borderWidth: borders.medium },
  mealImage: { height: MEAL_CARD_W * 0.85, alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', backgroundColor: '#0d0d0d' },
  mealImageStripes: { position: 'absolute', top: -10, left: -10, right: -10, bottom: -10, flexDirection: 'row', gap: 10, transform: [{ rotate: '-25deg' }] },
  mealImageStripe: { width: 12, flex: 1, backgroundColor: colors.white },
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
