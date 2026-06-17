import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import {
  getProfile, getUserCooks, getFriendshipStatus,
  sendFriendRequest, acceptFriendRequest, declineFriendRequest, removeFriend,
  sendDuelChallenge, timeAgo,
} from '../lib/api';
import { colors, spacing, typography, borders } from '../theme';
import AvatarImage from '../components/AvatarImage';
import { xpProgress, RANK_COLORS, rankFromXp } from '../lib/xp';

function initials(username) {
  return (username || '??').slice(0, 2).toUpperCase();
}

// ─── Friend action button ──────────────────────────────────────────────────────

function FriendButton({ status, onAdd, onCancel, onAccept, onDecline, onRemove, loading }) {
  if (loading) {
    return (
      <View style={styles.friendBtnLoading}>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    );
  }

  if (status === 'none') {
    return (
      <TouchableOpacity style={styles.addBtn} onPress={onAdd} activeOpacity={0.85}>
        <Ionicons name="person-add" size={15} color="#000" />
        <Text style={styles.addBtnText}>ADD FRIEND</Text>
      </TouchableOpacity>
    );
  }

  if (status === 'pending_sent') {
    return (
      <TouchableOpacity style={styles.pendingBtn} onPress={onCancel} activeOpacity={0.85}>
        <Ionicons name="time-outline" size={15} color={colors.gold} />
        <Text style={styles.pendingBtnText}>REQUEST SENT</Text>
      </TouchableOpacity>
    );
  }

  if (status === 'pending_received') {
    return (
      <View style={styles.incomingRow}>
        <TouchableOpacity style={styles.acceptBtn} onPress={onAccept} activeOpacity={0.85}>
          <Text style={styles.acceptBtnText}>ACCEPT</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.declineBtn} onPress={onDecline} activeOpacity={0.85}>
          <Text style={styles.declineBtnText}>DECLINE</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (status === 'friends') {
    return (
      <View style={styles.friendsRow}>
        <View style={styles.friendsChip}>
          <Ionicons name="checkmark" size={13} color={colors.success} />
          <Text style={styles.friendsChipText}>FRIENDS</Text>
        </View>
        <TouchableOpacity style={styles.removeBtn} onPress={onRemove} activeOpacity={0.85}>
          <Text style={styles.removeBtnText}>REMOVE</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}

// ─── Cook row ──────────────────────────────────────────────────────────────────

function CookRow({ cook, onPress }) {
  const voteCount = cook.votes?.length ?? 0;
  return (
    <TouchableOpacity style={styles.cookRow} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cookLeft}>
        {cook.verified && (
          <View style={styles.verifiedDot} />
        )}
        <Text style={styles.cookName} numberOfLines={1}>{cook.dish_name}</Text>
      </View>
      <View style={styles.cookRight}>
        <Ionicons name="flame" size={12} color={colors.primary} />
        <Text style={styles.cookVotes}>{voteCount}</Text>
        <Text style={styles.cookTime}>{timeAgo(cook.created_at)}</Text>
        <Ionicons name="chevron-forward" size={12} color={colors.border} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function UserProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { userId: targetUserId } = useRoute().params;

  const [myUserId, setMyUserId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [cooks, setCooks] = useState([]);
  const [friendship, setFriendship] = useState({ status: 'none', friendshipId: null });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [challenging, setChallenging] = useState(false);
  const [challengeSent, setChallengeSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setMyUserId(session.user.id);
    });
  }, []);

  useEffect(() => {
    if (!myUserId) return;
    const isOwn = myUserId === targetUserId;
    Promise.all([
      getProfile(targetUserId),
      getUserCooks(targetUserId),
      isOwn ? null : getFriendshipStatus(myUserId, targetUserId),
    ]).then(([prof, userCooks, fs]) => {
      setProfile(prof);
      setCooks(userCooks.slice(0, 6));
      if (fs) setFriendship(fs);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [myUserId, targetUserId]);

  async function handleAdd() {
    setActionLoading(true);
    try {
      await sendFriendRequest(myUserId, targetUserId);
      setFriendship({ status: 'pending_sent', friendshipId: null });
    } catch {}
    setActionLoading(false);
  }

  async function handleCancel() {
    setActionLoading(true);
    try {
      let fid = friendship.friendshipId;
      if (!fid) {
        const fs = await getFriendshipStatus(myUserId, targetUserId);
        fid = fs.friendshipId;
      }
      if (fid) await declineFriendRequest(fid);
      setFriendship({ status: 'none', friendshipId: null });
    } catch {}
    setActionLoading(false);
  }

  async function handleAccept() {
    if (!friendship.friendshipId) return;
    setActionLoading(true);
    try {
      await acceptFriendRequest(friendship.friendshipId);
      setFriendship(f => ({ ...f, status: 'friends' }));
    } catch {}
    setActionLoading(false);
  }

  async function handleDecline() {
    if (!friendship.friendshipId) return;
    setActionLoading(true);
    try {
      await declineFriendRequest(friendship.friendshipId);
      setFriendship({ status: 'none', friendshipId: null });
    } catch {}
    setActionLoading(false);
  }

  async function handleRemove() {
    if (!friendship.friendshipId) return;
    setActionLoading(true);
    try {
      await removeFriend(friendship.friendshipId);
      setFriendship({ status: 'none', friendshipId: null });
    } catch {}
    setActionLoading(false);
  }

  async function handleChallenge() {
    if (!myUserId || challenging || challengeSent) return;
    setChallenging(true);
    try {
      await sendDuelChallenge(myUserId, targetUserId);
      setChallengeSent(true);
    } catch {}
    setChallenging(false);
  }

  const isOwn = myUserId === targetUserId;
  const { rank: computedRank, tier: computedTier } = rankFromXp(profile?.xp ?? 0);
  const rankColor = RANK_COLORS[computedRank] || colors.accent;
  const { current: xpInLevel, needed: xpNeeded, pct: xpPct } = xpProgress(profile?.xp ?? 0);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          @{profile?.username ?? '...'}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Profile card */}
          <View style={[styles.profileCard, { borderColor: rankColor }]}>
            <View style={styles.profileTop}>
              {/* Avatar */}
              <AvatarImage
                uri={profile?.avatar_url}
                letters={initials(profile?.username)}
                rankColor={rankColor}
                size={60}
              />

              {/* Name + rank */}
              <View style={styles.profileInfo}>
                <Text style={styles.profileUsername}>{profile?.username}</Text>
                <View style={[styles.rankBadge, { borderColor: rankColor }]}>
                  <View style={[styles.rankTierDot, { backgroundColor: rankColor }]}>
                    <Text style={styles.rankTierText}>{profile ? computedTier : 'I'}</Text>
                  </View>
                  <Text style={[styles.rankName, { color: rankColor }]}>{profile ? computedRank : '—'}</Text>
                </View>
              </View>
            </View>

            {/* XP bar */}
            <View style={styles.xpSection}>
              <View style={styles.xpLabelRow}>
                <Text style={styles.xpLabel}>XP TO NEXT LEVEL</Text>
                <Text style={styles.xpNums}>
                  {xpNeeded > 0 ? `${xpInLevel.toLocaleString()} / ${xpNeeded.toLocaleString()}` : 'MAX'}
                </Text>
              </View>
              <View style={styles.xpTrack}>
                <View style={[styles.xpFill, { width: `${xpPct}%`, backgroundColor: rankColor }]} />
              </View>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Ionicons name="flame" size={13} color={colors.primary} />
                <Text style={styles.statNum}>{(profile?.total_votes ?? 0).toLocaleString()}</Text>
                <Text style={styles.statLabel}>VOTES</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Ionicons name="restaurant" size={13} color={colors.accent} />
                <Text style={styles.statNum}>{(profile?.dishes_cooked ?? 0).toLocaleString()}</Text>
                <Text style={styles.statLabel}>COOKS</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Ionicons name="trophy" size={13} color={colors.gold} />
                <Text style={styles.statNum}>{profile?.global_rank ? `#${profile.global_rank}` : '—'}</Text>
                <Text style={styles.statLabel}>RANK</Text>
              </View>
            </View>

            {/* Friend button */}
            {!isOwn && (
              <View style={styles.friendBtnWrapper}>
                <FriendButton
                  status={friendship.status}
                  loading={actionLoading}
                  onAdd={handleAdd}
                  onCancel={handleCancel}
                  onAccept={handleAccept}
                  onDecline={handleDecline}
                  onRemove={handleRemove}
                />
                {friendship.status === 'friends' && (
                  <TouchableOpacity
                    style={[styles.challengeBtn, challengeSent && styles.challengeBtnSent]}
                    onPress={handleChallenge}
                    disabled={challenging || challengeSent}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="flash" size={15} color={challengeSent ? colors.success : colors.white} />
                    <Text style={[styles.challengeBtnText, challengeSent && { color: colors.success }]}>
                      {challengeSent ? 'CHALLENGE SENT' : 'CHALLENGE TO DUEL'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Recent cooks */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>RECENT COOKS</Text>
            <View style={styles.sectionLine} />
            <Text style={styles.sectionCount}>{cooks.length}</Text>
          </View>

          {cooks.length === 0 ? (
            <View style={styles.emptyCooks}>
              <Ionicons name="restaurant-outline" size={28} color={colors.border} />
              <Text style={styles.emptyCooksText}>NO COOKS YET</Text>
            </View>
          ) : (
            <View style={styles.cookList}>
              {cooks.map(cook => <CookRow key={cook.id} cook={cook} onPress={() => navigation.push('PostDetail', { cookId: cook.id })} />)}
            </View>
          )}

          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: borders.medium, borderBottomColor: '#000',
  },
  backBtn: {
    width: 38, height: 38,
    alignItems: 'center', justifyContent: 'center',
  },
  topBarTitle: {
    color: colors.white, fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wide,
    flex: 1, textAlign: 'center',
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  scroll: { paddingHorizontal: spacing.md, paddingTop: spacing.md },

  // Profile card
  profileCard: {
    backgroundColor: colors.surface,
    borderWidth: borders.medium,
    borderRadius: 4,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  profileTop: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.md, marginBottom: spacing.md,
  },
  avatar: {
    width: 60, height: 60, borderRadius: 30,
    borderWidth: borders.medium,
    backgroundColor: '#1a1a1a',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {
    color: colors.white, fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.black, letterSpacing: 1,
  },
  profileInfo: { flex: 1, gap: spacing.xs },
  profileUsername: {
    color: colors.white, fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.tight,
  },
  rankBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: borders.thin, borderRadius: 3,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  rankTierDot: {
    width: 18, height: 18, borderRadius: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  rankTierText: {
    color: '#000', fontSize: 9, fontWeight: typography.fontWeight.black,
  },
  rankName: {
    fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black,
    letterSpacing: typography.letterSpacing.wide,
  },

  // XP
  xpSection: { marginBottom: spacing.md },
  xpLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  xpLabel: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold, letterSpacing: typography.letterSpacing.wider },
  xpNums: { color: colors.accent, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },
  xpTrack: {
    height: 10, backgroundColor: colors.background,
    borderWidth: borders.thin, borderColor: colors.border,
  },
  xpFill: { height: '100%' },

  // Stats
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: borders.thin, borderColor: colors.border,
    marginBottom: spacing.md,
  },
  statItem: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 4, paddingVertical: spacing.sm,
  },
  statNum: { color: colors.white, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.black },
  statLabel: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wide },
  statDivider: { width: 1, height: '60%', backgroundColor: colors.border },

  // Friend button
  friendBtnWrapper: { marginTop: spacing.xs },
  friendBtnLoading: { alignItems: 'center', paddingVertical: spacing.sm },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: colors.success,
    borderWidth: borders.thin, borderColor: '#000',
    paddingVertical: spacing.sm + 2,
  },
  addBtnText: { color: '#000', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },

  pendingBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: '#1a1400',
    borderWidth: borders.thin, borderColor: colors.gold,
    paddingVertical: spacing.sm + 2,
  },
  pendingBtnText: { color: colors.gold, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },

  incomingRow: { flexDirection: 'row', gap: spacing.sm },
  acceptBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.success, borderWidth: borders.thin, borderColor: '#000',
    paddingVertical: spacing.sm + 2,
  },
  acceptBtnText: { color: '#000', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  declineBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderWidth: borders.thin, borderColor: colors.border,
    paddingVertical: spacing.sm + 2,
  },
  declineBtnText: { color: colors.inactive, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },

  friendsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  friendsChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#0a1a0a',
    borderWidth: borders.thin, borderColor: colors.success,
    paddingVertical: spacing.sm + 2,
  },
  friendsChipText: { color: colors.success, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  removeBtn: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    borderWidth: borders.thin, borderColor: colors.border,
  },
  removeBtnText: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },

  challengeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: colors.primary,
    borderWidth: borders.thin, borderColor: '#000',
    paddingVertical: spacing.sm + 2, marginTop: spacing.sm,
  },
  challengeBtnSent: { backgroundColor: '#0a1a0a', borderColor: colors.success },
  challengeBtnText: {
    color: colors.white, fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider,
  },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  sectionTitle: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  sectionLine: { flex: 1, height: 1, backgroundColor: '#1f1f1f' },
  sectionCount: { color: colors.border, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },

  // Cooks
  cookList: {
    borderWidth: borders.thin, borderColor: '#1a1a1a',
    backgroundColor: colors.surface,
  },
  cookRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1, borderBottomColor: '#141414',
  },
  cookLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  verifiedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  cookName: { color: colors.white, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, flex: 1 },
  cookRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  cookVotes: { color: colors.white, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, minWidth: 24 },
  cookTime: { color: '#444', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },

  emptyCooks: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyCooksText: { color: colors.border, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
});
