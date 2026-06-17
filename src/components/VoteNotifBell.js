import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { getVoteActivity, getEventNotifications, markEventNotificationsRead, getInspiredCookNotifications, markInspiredNotificationsRead, getDuelChallengeNotifications, markDuelChallengeNotificationsRead, getCommentNotifications, markCommentNotificationsRead, timeAgo } from '../lib/api';
import AvatarImage from './AvatarImage';
import { colors, spacing, typography, borders } from '../theme';

const NOTIF_SEEN_KEY = '@vote_notifs_last_seen';

const RANK_COLORS = {
  'Gold Cook':        '#FFB800',
  'Emerald Cook':     '#00C47A',
  'Diamond Cook':     '#88CCFF',
  'Chef':             '#E8001C',
  'Exec Chef':        '#A855F7',
  'Master Chef':      '#FF6B00',
  'World Class Chef': '#FFFFFF',
};

function initials(username) {
  return (username || '??').slice(0, 2).toUpperCase();
}

function Avatar({ uri, letters, rankColor, size = 40 }) {
  return <AvatarImage uri={uri} letters={letters} rankColor={rankColor} size={size} />;
}

function SectionLabel({ label }) {
  return (
    <View style={styles.sectionLabel}>
      <Text style={styles.sectionLabelText}>{label}</Text>
      <View style={styles.sectionLabelLine} />
    </View>
  );
}

function EventNotifRow({ item }) {
  const won = item.data?.result === 'winner';
  const accent = won ? colors.gold : '#777';
  const votes = item.data?.votes ?? 0;
  const xpEarned = item.data?.xp_earned;
  return (
    <View style={[styles.eventRow, won && styles.eventRowWinner]}>
      <View style={[styles.activityStripe, { backgroundColor: accent }]} />
      <View style={[styles.eventIcon, { backgroundColor: accent + '22', borderColor: accent }]}>
        <Ionicons name={won ? 'trophy' : 'restaurant-outline'} size={18} color={accent} />
      </View>
      <View style={styles.activityInfo}>
        <Text style={[styles.eventHeadline, { color: accent }]}>
          {won ? '🏆 YOU WON!' : 'EVENT ENDED'}
        </Text>
        <Text style={styles.eventName} numberOfLines={1}>{item.data?.event_title}</Text>
        <Text style={styles.eventDish} numberOfLines={1}>
          "{item.data?.dish_name}" · {votes} vote{votes !== 1 ? 's' : ''}
        </Text>
        <View style={styles.activityMeta}>
          {xpEarned > 0 && (
            <View style={styles.xpPill}>
              <Text style={styles.xpPillText}>+{xpEarned} {won ? 'WINNER BONUS' : 'COOK'} XP</Text>
            </View>
          )}
          {!won && !xpEarned && (
            <Text style={styles.eventThanks}>Thanks for cooking!</Text>
          )}
          <Text style={styles.activityTime}>{timeAgo(item.created_at)}</Text>
        </View>
      </View>
    </View>
  );
}

function ActivityRow({ item, isUnread, onVoterPress }) {
  const rankColor = RANK_COLORS[item.voter.rank] || colors.accent;
  return (
    <View style={[styles.activityRow, isUnread && styles.activityRowUnread]}>
      <View style={[styles.activityStripe, { backgroundColor: rankColor }]} />
      <TouchableOpacity onPress={onVoterPress} activeOpacity={0.7}>
        <Avatar uri={item.voter.avatar_url} letters={initials(item.voter.username)} rankColor={rankColor} size={40} />
      </TouchableOpacity>
      <View style={styles.activityInfo}>
        <TouchableOpacity onPress={onVoterPress} activeOpacity={0.7}>
          <Text style={styles.activityText} numberOfLines={2}>
            <Text style={[styles.activityUser, { color: rankColor }]}>@{item.voter.username} </Text>
            <Text style={styles.activityVerb}>voted on your </Text>
            <Text style={styles.activityDish}>{item.dish_name}</Text>
          </Text>
        </TouchableOpacity>
        <View style={styles.activityMeta}>
          <View style={[styles.activityRankPill, { borderColor: rankColor }]}>
            <Text style={[styles.activityRankText, { color: rankColor }]}>{(item.voter.rank || '').toUpperCase()}</Text>
          </View>
          <Text style={styles.activityTime}>{timeAgo(item.created_at)}</Text>
        </View>
      </View>
      <View style={[styles.activityFlame, { backgroundColor: rankColor + '22', borderColor: rankColor }]}>
        <Ionicons name="flame" size={18} color={rankColor} />
      </View>
    </View>
  );
}

function InspiredCookRow({ item, onPress }) {
  const cooker = item.cooker || {};
  const rankColor = RANK_COLORS[cooker.rank] || colors.accent;
  const xp = item.data?.xp_earned ?? 25;
  return (
    <TouchableOpacity
      style={[styles.activityRow, !item.read_at && styles.activityRowUnread]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.activityStripe, { backgroundColor: colors.primary }]} />
      <Avatar uri={cooker.avatar_url} letters={initials(cooker.username)} rankColor={rankColor} size={40} />
      <View style={styles.activityInfo}>
        <Text style={styles.activityText} numberOfLines={2}>
          <Text style={[styles.activityUser, { color: rankColor }]}>@{cooker.username || '?'} </Text>
          <Text style={styles.activityVerb}>cooked your </Text>
          <Text style={styles.activityDish}>{item.data?.original_dish_name || 'dish'}</Text>
        </Text>
        {item.data?.new_dish_name && (
          <Text style={styles.inspiredNewDish} numberOfLines={1}>Their version: "{item.data.new_dish_name}"</Text>
        )}
        <View style={styles.activityMeta}>
          <View style={styles.xpPill}>
            <Text style={styles.xpPillText}>+{xp} XP EARNED</Text>
          </View>
          <Text style={styles.activityTime}>{timeAgo(item.created_at)}</Text>
        </View>
      </View>
      <View style={[styles.activityFlame, { backgroundColor: `${colors.primary}22`, borderColor: colors.primary }]}>
        <Ionicons name="flame" size={18} color={colors.primary} />
      </View>
    </TouchableOpacity>
  );
}

function CommentNotifRow({ item, onPress }) {
  const commenter = item.commenter || {};
  const rankColor = RANK_COLORS[commenter.rank] || colors.accent;
  return (
    <TouchableOpacity
      style={[styles.activityRow, !item.read_at && styles.activityRowUnread]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.activityStripe, { backgroundColor: colors.accent }]} />
      <Avatar uri={commenter.avatar_url} letters={initials(commenter.username)} rankColor={rankColor} size={40} />
      <View style={styles.activityInfo}>
        <Text style={styles.activityText} numberOfLines={2}>
          <Text style={[styles.activityUser, { color: rankColor }]}>@{commenter.username || '?'} </Text>
          <Text style={styles.activityVerb}>commented on your </Text>
          <Text style={styles.activityDish}>{item.data?.dish_name || 'cook'}</Text>
        </Text>
        {item.data?.comment_text && (
          <Text style={styles.commentPreview} numberOfLines={1}>"{item.data.comment_text}"</Text>
        )}
        <View style={styles.activityMeta}>
          <View style={[styles.activityRankPill, { borderColor: rankColor }]}>
            <Text style={[styles.activityRankText, { color: rankColor }]}>{(commenter.rank || '').toUpperCase()}</Text>
          </View>
          <Text style={styles.activityTime}>{timeAgo(item.created_at)}</Text>
        </View>
      </View>
      <View style={[styles.activityFlame, { backgroundColor: `${colors.accent}22`, borderColor: colors.accent }]}>
        <Ionicons name="chatbubble" size={16} color={colors.accent} />
      </View>
    </TouchableOpacity>
  );
}

function DuelChallengeNotifRow({ item, onPress }) {
  const challenger = item.challenger || {};
  const rankColor = RANK_COLORS[challenger.rank] || colors.accent;
  return (
    <TouchableOpacity
      style={[styles.activityRow, !item.read_at && styles.activityRowUnread]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.activityStripe, { backgroundColor: colors.gold }]} />
      <Avatar uri={challenger.avatar_url} letters={initials(challenger.username)} rankColor={rankColor} size={40} />
      <View style={styles.activityInfo}>
        <Text style={styles.activityText} numberOfLines={2}>
          <Text style={[styles.activityUser, { color: rankColor }]}>@{challenger.username || '?'} </Text>
          <Text style={styles.activityVerb}>challenged you to a </Text>
          <Text style={styles.activityDish}>DUEL</Text>
        </Text>
        <View style={styles.activityMeta}>
          <View style={[styles.activityRankPill, { borderColor: rankColor }]}>
            <Text style={[styles.activityRankText, { color: rankColor }]}>{(challenger.rank || '').toUpperCase()}</Text>
          </View>
          <Text style={styles.activityTime}>{timeAgo(item.created_at)}</Text>
        </View>
      </View>
      <View style={[styles.activityFlame, { backgroundColor: `${colors.gold}22`, borderColor: colors.gold }]}>
        <Ionicons name="flash" size={18} color={colors.gold} />
      </View>
    </TouchableOpacity>
  );
}

function mergeAndSort(voteData, eventData, inspiredData, duelChallengeData, commentData, since) {
  return [
    ...voteData.map(v => ({ ...v, _type: 'vote', _isUnread: new Date(v.created_at) > since })),
    ...eventData.map(e => ({ ...e, _type: 'event', _isUnread: !e.read_at })),
    ...inspiredData.map(n => ({ ...n, _type: 'inspired', _isUnread: !n.read_at })),
    ...(duelChallengeData || []).map(n => ({ ...n, _type: 'duel_challenge', _isUnread: !n.read_at })),
    ...(commentData || []).map(n => ({ ...n, _type: 'comment', _isUnread: !n.read_at })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export default function VoteNotifBell() {
  const navigation = useNavigation();
  const [userId, setUserId] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [allNotifs, setAllNotifs] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUserId(session.user.id);
    });
  }, []);

  useFocusEffect(useCallback(() => {
    if (!userId) return;
    refreshUnread();
  }, [userId]));

  async function refreshUnread() {
    try {
      const [voteData, eventData, inspiredData, duelData, commentData] = await Promise.all([
        getVoteActivity(userId),
        getEventNotifications(userId),
        getInspiredCookNotifications(userId),
        getDuelChallengeNotifications(userId),
        getCommentNotifications(userId),
      ]);
      const lastSeen = await AsyncStorage.getItem(NOTIF_SEEN_KEY);
      const since = lastSeen ? new Date(lastSeen) : new Date(0);
      const merged = mergeAndSort(voteData, eventData, inspiredData, duelData, commentData, since);
      setAllNotifs(merged);
      setUnreadCount(merged.filter(n => n._isUnread).length);
    } catch {}
  }

  async function openModal() {
    setModalVisible(true);
    setUnreadCount(0);
    await Promise.all([
      AsyncStorage.setItem(NOTIF_SEEN_KEY, new Date().toISOString()),
      markEventNotificationsRead(userId).catch(() => {}),
      markInspiredNotificationsRead(userId).catch(() => {}),
      markDuelChallengeNotificationsRead(userId).catch(() => {}),
      markCommentNotificationsRead(userId).catch(() => {}),
    ]);
    setLoading(true);
    Promise.all([
      getVoteActivity(userId),
      getEventNotifications(userId),
      getInspiredCookNotifications(userId),
      getDuelChallengeNotifications(userId),
      getCommentNotifications(userId),
    ])
      .then(([voteData, eventData, inspiredData, duelData, commentData]) => {
        const merged = mergeAndSort(voteData, eventData, inspiredData, duelData, commentData, new Date(0));
        setAllNotifs(merged);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  const hasAnything = allNotifs.length > 0;

  return (
    <>
      <TouchableOpacity
        style={[styles.bellBtn, unreadCount > 0 && styles.bellBtnActive]}
        onPress={openModal}
        activeOpacity={0.8}
      >
        <Ionicons
          name={unreadCount > 0 ? 'flame' : 'flame-outline'}
          size={20}
          color={unreadCount > 0 ? colors.gold : colors.white}
        />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setModalVisible(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <Ionicons name="flame" size={20} color={colors.gold} />
                <Text style={styles.sheetTitle}>ACTIVITY</Text>
                {allNotifs.length > 0 && (
                  <View style={styles.countPill}>
                    <Text style={styles.countPillText}>{allNotifs.length} TOTAL</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={colors.white} />
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
            ) : !hasAnything ? (
              <View style={styles.center}>
                <Ionicons name="flame-outline" size={48} color={colors.border} />
                <Text style={styles.emptyTitle}>NO ACTIVITY YET</Text>
                <Text style={styles.emptySub}>Post a cook and get the heat going</Text>
              </View>
            ) : (
              <ScrollView>
                {allNotifs.map(item => {
                  if (item._type === 'event') {
                    return <EventNotifRow key={item.id} item={item} />;
                  }
                  if (item._type === 'inspired') {
                    return (
                      <InspiredCookRow
                        key={item.id}
                        item={item}
                        onPress={() => {
                          if (!item.data?.cook_id) return;
                          setModalVisible(false);
                          navigation.navigate('PostDetail', { cookId: item.data.cook_id });
                        }}
                      />
                    );
                  }
                  if (item._type === 'duel_challenge') {
                    return (
                      <DuelChallengeNotifRow
                        key={item.id}
                        item={item}
                        onPress={() => {
                          setModalVisible(false);
                          navigation.navigate('MainTabs', { screen: 'Rivals' });
                        }}
                      />
                    );
                  }
                  if (item._type === 'comment') {
                    return (
                      <CommentNotifRow
                        key={item.id}
                        item={item}
                        onPress={() => {
                          if (!item.data?.cook_id) return;
                          setModalVisible(false);
                          navigation.navigate('PostDetail', { cookId: item.data.cook_id });
                        }}
                      />
                    );
                  }
                  return (
                    <ActivityRow
                      key={item.id}
                      item={item}
                      isUnread={item._isUnread}
                      onVoterPress={() => {
                        if (!item.voter?.id) return;
                        setModalVisible(false);
                        navigation.navigate('UserProfile', { userId: item.voter.id });
                      }}
                    />
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellBtn: {
    width: 36, height: 36,
    borderWidth: borders.thin, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  bellBtnActive: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(255,184,0,0.15)',
  },
  badge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: colors.primary,
    borderRadius: 8, minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1, borderColor: colors.background,
  },
  badgeText: { color: colors.white, fontSize: 8, fontWeight: typography.fontWeight.black },

  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopWidth: borders.medium, borderTopColor: colors.primary,
    maxHeight: '80%',
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#0d0d0d',
    borderBottomWidth: borders.medium, borderBottomColor: colors.primary,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  sheetHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sheetTitle: {
    color: colors.white, fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider,
  },
  countPill: { backgroundColor: colors.primary, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  countPillText: { color: colors.white, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: 0.8 },

  // section divider inside modal
  sectionLabel: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: '#0a0a0a',
  },
  sectionLabelText: {
    color: colors.inactive, fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider,
  },
  sectionLabelLine: { flex: 1, height: 1, backgroundColor: '#1f1f1f' },

  center: { alignItems: 'center', padding: spacing.xxl, gap: spacing.sm },
  emptyTitle: { color: colors.border, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  emptySub: { color: colors.inactive, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },

  // event notification row
  eventRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingRight: spacing.md, paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  eventRowWinner: { backgroundColor: '#110e00' },
  eventIcon: {
    width: 40, height: 40, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  eventHeadline: {
    fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.black,
    letterSpacing: typography.letterSpacing.wide,
  },
  eventName: {
    color: colors.white, fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  eventDish: {
    color: colors.inactive, fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  xpPill: {
    backgroundColor: '#1a3a1a', paddingHorizontal: 6, paddingVertical: 2,
  },
  xpPillText: {
    color: colors.success, fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.black, letterSpacing: 0.8,
  },
  eventThanks: {
    color: '#555', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold,
  },

  // vote activity row
  activityRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingRight: spacing.md, paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  activityRowUnread: { backgroundColor: '#111' },
  activityStripe: { width: 3, alignSelf: 'stretch', minHeight: 48 },
  activityInfo: { flex: 1, gap: 5 },
  activityText: { fontSize: typography.fontSize.sm, lineHeight: 19 },
  activityUser: { fontWeight: typography.fontWeight.black },
  activityVerb: { color: colors.inactive, fontWeight: typography.fontWeight.bold },
  activityDish: { color: colors.accent, fontWeight: typography.fontWeight.black },
  activityMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  activityRankPill: { borderWidth: 1, paddingHorizontal: 5, paddingVertical: 1 },
  activityRankText: { fontSize: 7, fontWeight: typography.fontWeight.black, letterSpacing: 1 },
  activityTime: { color: '#555', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },
  activityFlame: { width: 34, height: 34, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  inspiredNewDish: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold, fontStyle: 'italic' },
  commentPreview: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold, fontStyle: 'italic' },

  avatar: { borderWidth: 2, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontWeight: typography.fontWeight.black, letterSpacing: 0.5 },
});
