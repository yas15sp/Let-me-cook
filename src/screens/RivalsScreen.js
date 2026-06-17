import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions,
  ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import {
  getLeaderboard, getFriends, getPendingRequests,
  searchUsers, sendFriendRequest, acceptFriendRequest, declineFriendRequest,
  getMyDuels, getDuelCooks, sendDuelChallenge, acceptDuel, declineDuel,
  completeDuel, awardDuelCompletionXp, cancelDuel,
} from '../lib/api';
import { colors, spacing, typography, borders } from '../theme';
import VoteNotifBell from '../components/VoteNotifBell';
import AvatarImage from '../components/AvatarImage';
import ActiveDuelBanner from '../components/ActiveDuelBanner';

const { width: W } = Dimensions.get('window');

const DUEL_COMPLETION_XP = 150;

const XP_BONUSES = [
  { label: 'Duel cook',              xp: '+80 XP' },
  { label: 'Duel completion',        xp: `+${DUEL_COMPLETION_XP} XP` },
  { label: 'First cook of day',      xp: '+100 XP' },
  { label: 'Streak bonus (day 2+)',  xp: '+25% base' },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const RANK_COLORS = {
  'Gold Cook':        '#FFB800',
  'Emerald Cook':     '#00C47A',
  'Diamond Cook':     '#88CCFF',
  'Chef':             '#E8001C',
  'Exec Chef':        '#A855F7',
  'Master Chef':      '#FF6B00',
  'World Class Chef': '#FFFFFF',
};
const PODIUM_COLORS = ['#FFB800', '#AAAAAA', '#CD7F32'];
const PODIUM_LABELS = ['1ST', '2ND', '3RD'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(username) {
  return (username || '??').slice(0, 2).toUpperCase();
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function Avatar({ uri, letters, rankColor, size = 40 }) {
  return <AvatarImage uri={uri} letters={letters} rankColor={rankColor} size={size} />;
}

function RankChip({ rank, rankColor }) {
  return (
    <View style={[styles.rankChip, { borderColor: rankColor }]}>
      <Text style={[styles.rankChipText, { color: rankColor }]}>{(rank || '').toUpperCase()}</Text>
    </View>
  );
}

function SectionLabel({ title, action }) {
  return (
    <View style={styles.sectionLabelRow}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.sectionLine} />
      {action}
    </View>
  );
}

// ─── Leaderboard components ───────────────────────────────────────────────────

function PodiumCard({ entry, position, isMe, onPress }) {
  const podiumColor = PODIUM_COLORS[position];
  const rankColor = RANK_COLORS[entry.rank] || colors.accent;
  return (
    <TouchableOpacity
      style={[styles.podiumCard, { borderColor: podiumColor }, isMe && styles.podiumCardMe]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.podiumBadge, { backgroundColor: podiumColor }]}>
        <Text style={styles.podiumBadgeText}>{PODIUM_LABELS[position]}</Text>
      </View>
      <Avatar uri={entry.avatar_url} letters={initials(entry.username)} rankColor={rankColor} size={44} />
      <Text style={styles.podiumName} numberOfLines={1}>@{entry.username}</Text>
      <RankChip rank={entry.rank} rankColor={rankColor} />
      <Text style={styles.podiumXp}>{(entry.xp || 0).toLocaleString()} XP</Text>
    </TouchableOpacity>
  );
}

function LeaderboardRow({ entry, position, maxXp, isMe, onPress }) {
  const rankColor = RANK_COLORS[entry.rank] || colors.accent;
  const xpPct = maxXp > 0 ? Math.min((entry.xp / maxXp) * 100, 100) : 0;
  return (
    <TouchableOpacity style={[styles.lbRow, isMe && styles.lbRowMe]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[styles.lbRank, isMe && { color: colors.accent }]}>#{position + 1}</Text>
      <Avatar uri={entry.avatar_url} letters={initials(entry.username)} rankColor={rankColor} size={34} />
      <View style={styles.lbInfo}>
        <View style={styles.lbNameRow}>
          <Text style={[styles.lbName, isMe && { color: colors.accent }]} numberOfLines={1}>@{entry.username}</Text>
          <RankChip rank={entry.rank} rankColor={rankColor} />
        </View>
        <View style={styles.lbBarRow}>
          <View style={styles.lbBarTrack}>
            <View style={[styles.lbBarFill, { width: `${xpPct}%`, backgroundColor: isMe ? colors.accent : rankColor }]} />
          </View>
          <Text style={styles.lbXp}>{(entry.xp || 0).toLocaleString()}</Text>
        </View>
      </View>
      <View style={styles.lbStats}>
        <Text style={styles.lbStatNum}>{entry.dishes_cooked ?? 0}</Text>
        <Text style={styles.lbStatLabel}>COOKS</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Rivals sub-components ────────────────────────────────────────────────────

function DuelChallengeCard({ duel, onAccept, onDecline, hasActiveDuel }) {
  const challenger = duel.challenger || {};
  const rankColor = RANK_COLORS[challenger.rank] || colors.accent;
  return (
    <View style={styles.duelChallengeCard}>
      <Avatar uri={challenger.avatar_url} letters={initials(challenger.username)} rankColor={rankColor} size={40} />
      <View style={styles.pendingInfo}>
        <Text style={styles.pendingName} numberOfLines={1}>@{challenger.username}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <RankChip rank={challenger.rank} rankColor={rankColor} />
          <Text style={styles.duelChallengeLabel}>wants a duel</Text>
        </View>
        {hasActiveDuel && (
          <Text style={styles.duelBlockedNote}>Finish your active duel first</Text>
        )}
      </View>
      <View style={styles.pendingActions}>
        <TouchableOpacity
          style={[styles.acceptBtn, hasActiveDuel && styles.acceptBtnDisabled]}
          onPress={hasActiveDuel ? undefined : onAccept}
          disabled={hasActiveDuel}
          activeOpacity={0.85}
        >
          <Text style={styles.acceptText}>{hasActiveDuel ? 'BUSY' : 'ACCEPT'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ignoreBtn} onPress={onDecline} activeOpacity={0.85}>
          <Text style={styles.ignoreText}>DECLINE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ActiveDuelCard({ duel, myUserId, duelCooks, onCancel }) {
  const isChallenger = duel.challenger_id === myUserId;
  const me = isChallenger ? duel.challenger : duel.opponent;
  const them = isChallenger ? duel.opponent : duel.challenger;
  const myRankColor = RANK_COLORS[me?.rank] || colors.accent;
  const theirRankColor = RANK_COLORS[them?.rank] || colors.accent;
  const mySubmitted = (duelCooks || []).some(c => c.user_id === myUserId);
  const theirSubmitted = (duelCooks || []).some(c => c.user_id !== myUserId);

  return (
    <View style={styles.activeDuelCard}>
      <View style={styles.activeDuelHeader}>
        <View style={styles.activeDuelChip}>
          <Ionicons name="flash" size={10} color={colors.white} />
          <Text style={styles.activeDuelChipText}>ACTIVE DUEL</Text>
        </View>
        <TouchableOpacity onPress={onCancel} style={styles.activeDuelCancelBtn} activeOpacity={0.8}>
          <Text style={styles.activeDuelCancelText}>CANCEL</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.activeDuelVsRow}>
        {/* Me */}
        <View style={styles.activeDuelSide}>
          <Avatar uri={me?.avatar_url} letters={initials(me?.username)} rankColor={myRankColor} size={38} />
          <Text style={styles.activeDuelName} numberOfLines={1}>{me?.username ? `@${me.username}` : 'You'}</Text>
          <View style={[styles.activeDuelStatus, mySubmitted && styles.activeDuelStatusDone]}>
            <Ionicons name={mySubmitted ? 'checkmark' : 'time-outline'} size={11} color={mySubmitted ? colors.background : colors.inactive} />
            <Text style={[styles.activeDuelStatusText, mySubmitted && styles.activeDuelStatusTextDone]}>
              {mySubmitted ? 'COOKED' : 'PENDING'}
            </Text>
          </View>
        </View>

        <View style={styles.activeDuelVsDivider}>
          <Text style={styles.activeDuelVsText}>VS</Text>
        </View>

        {/* Them */}
        <View style={styles.activeDuelSide}>
          <Avatar uri={them?.avatar_url} letters={initials(them?.username)} rankColor={theirRankColor} size={38} />
          <Text style={styles.activeDuelName} numberOfLines={1}>@{them?.username}</Text>
          <View style={[styles.activeDuelStatus, theirSubmitted && styles.activeDuelStatusDone]}>
            <Ionicons name={theirSubmitted ? 'checkmark' : 'time-outline'} size={11} color={theirSubmitted ? colors.background : colors.inactive} />
            <Text style={[styles.activeDuelStatusText, theirSubmitted && styles.activeDuelStatusTextDone]}>
              {theirSubmitted ? 'COOKED' : 'PENDING'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function CompletedDuelCard({ duel, duelCooks, onPress }) {
  const challenger = duel.challenger || {};
  const opponent = duel.opponent || {};
  const challengerCook = (duelCooks || []).find(c => c.user_id === duel.challenger_id);
  const opponentCook = (duelCooks || []).find(c => c.user_id === duel.opponent_id);
  const challengerColor = RANK_COLORS[challenger.rank] || colors.accent;
  const opponentColor = RANK_COLORS[opponent.rank] || colors.accent;
  const challengerPhoto = challengerCook?.photo_urls?.length ? challengerCook.photo_urls[challengerCook.photo_urls.length - 1] : null;
  const opponentPhoto = opponentCook?.photo_urls?.length ? opponentCook.photo_urls[opponentCook.photo_urls.length - 1] : null;

  return (
    <TouchableOpacity style={styles.completedDuelCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.completedDuelHeader}>
        <View style={styles.completedDuelChip}>
          <Ionicons name="checkmark-circle" size={10} color={colors.background} />
          <Text style={styles.completedDuelChipText}>DUEL COMPLETE</Text>
        </View>
        <View style={styles.completedDuelXpChip}>
          <Text style={styles.completedDuelXpText}>+{DUEL_COMPLETION_XP} XP</Text>
        </View>
        <View style={styles.completedDuelTapHint}>
          <Text style={styles.completedDuelTapHintText}>TAP FOR SUMMARY</Text>
          <Ionicons name="chevron-forward" size={10} color={colors.inactive} />
        </View>
      </View>
      <View style={styles.completedDuelRow}>
        <View style={styles.completedDuelSide}>
          <View style={[styles.completedDuelPhoto, { borderColor: challengerColor }]}>
            {challengerPhoto ? (
              <Image source={{ uri: challengerPhoto }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <Ionicons name="restaurant" size={22} color={colors.border} />
            )}
          </View>
          <Text style={styles.completedDuelUsername} numberOfLines={1}>@{challenger.username}</Text>
          <Text style={styles.completedDuelDish} numberOfLines={1}>{challengerCook?.dish_name || '—'}</Text>
        </View>

        <View style={styles.completedDuelVsDivider}>
          <Text style={styles.completedDuelVsText}>VS</Text>
        </View>

        <View style={styles.completedDuelSide}>
          <View style={[styles.completedDuelPhoto, { borderColor: opponentColor }]}>
            {opponentPhoto ? (
              <Image source={{ uri: opponentPhoto }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <Ionicons name="restaurant" size={22} color={colors.border} />
            )}
          </View>
          <Text style={styles.completedDuelUsername} numberOfLines={1}>@{opponent.username}</Text>
          <Text style={styles.completedDuelDish} numberOfLines={1}>{opponentCook?.dish_name || '—'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function FriendCard({ friend, duelStatus, onChallenge, onPress, hasAnyActiveDuel }) {
  const rankColor = RANK_COLORS[friend.rank] || colors.accent;
  const hasExistingDuel = duelStatus === 'sent' || duelStatus === 'active' || duelStatus === 'incoming';
  const blocked = hasExistingDuel || (hasAnyActiveDuel && duelStatus === 'completed') || (hasAnyActiveDuel && !duelStatus);

  let btnLabel = 'CHALLENGE';
  let btnStyle = styles.challengeBtn;
  let btnTextStyle = styles.challengeText;
  if (duelStatus === 'sent') { btnLabel = 'SENT'; btnStyle = styles.challengeBtnDisabled; btnTextStyle = styles.challengeTextDisabled; }
  else if (duelStatus === 'active') { btnLabel = 'DUEL ACTIVE'; btnStyle = styles.challengeBtnActive; btnTextStyle = styles.challengeTextActive; }
  else if (duelStatus === 'incoming') { btnLabel = 'INCOMING'; btnStyle = styles.challengeBtnIncoming; btnTextStyle = styles.challengeTextIncoming; }
  else if (duelStatus === 'completed') { btnLabel = hasAnyActiveDuel ? 'BUSY' : 'DUEL AGAIN'; btnStyle = hasAnyActiveDuel ? styles.challengeBtnDisabled : styles.challengeBtn; btnTextStyle = hasAnyActiveDuel ? styles.challengeTextDisabled : styles.challengeText; }
  else if (!duelStatus && hasAnyActiveDuel) { btnLabel = 'BUSY'; btnStyle = styles.challengeBtnDisabled; btnTextStyle = styles.challengeTextDisabled; }

  return (
    <TouchableOpacity style={styles.friendCard} onPress={onPress} activeOpacity={0.8}>
      <Avatar uri={friend.avatar_url} letters={initials(friend.username)} rankColor={rankColor} size={44} />
      <View style={styles.friendInfo}>
        <View style={styles.friendNameRow}>
          <Text style={styles.friendName} numberOfLines={1}>@{friend.username}</Text>
          <RankChip rank={friend.rank} rankColor={rankColor} />
        </View>
        <Text style={styles.friendMeta}>
          {friend.rank_tier ?? 'I'} · {friend.dishes_cooked ?? 0} cooks
        </Text>
      </View>
      <TouchableOpacity style={btnStyle} activeOpacity={0.85} onPress={blocked ? undefined : onChallenge} disabled={blocked}>
        <Text style={btnTextStyle}>{btnLabel}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function PendingCard({ request, onAccept, onIgnore }) {
  const rankColor = RANK_COLORS[request.rank] || colors.accent;
  return (
    <View style={styles.pendingCard}>
      <Avatar uri={request.avatar_url} letters={initials(request.username)} rankColor={rankColor} size={38} />
      <View style={styles.pendingInfo}>
        <Text style={styles.pendingName} numberOfLines={1}>@{request.username}</Text>
        <RankChip rank={request.rank} rankColor={rankColor} />
      </View>
      <View style={styles.pendingActions}>
        <TouchableOpacity style={styles.acceptBtn} onPress={onAccept} activeOpacity={0.85}>
          <Text style={styles.acceptText}>ACCEPT</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ignoreBtn} onPress={onIgnore} activeOpacity={0.85}>
          <Text style={styles.ignoreText}>IGNORE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function RivalsScreen() {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [myUserId, setMyUserId] = useState(null);

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState([]);
  const [lbLoading, setLbLoading] = useState(true);
  const [lbError, setLbError] = useState(null);

  // Rivals
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [rivalsLoading, setRivalsLoading] = useState(true);
  // Duels
  const [incomingDuels, setIncomingDuels] = useState([]);
  const [activeDuels, setActiveDuels] = useState([]);
  const [duelStatusMap, setDuelStatusMap] = useState({});  // friendId → 'sent'|'incoming'|'active'
  const [duelCooksMap, setDuelCooksMap] = useState({});   // duelId → Cook[]
  const [completedDuels, setCompletedDuels] = useState([]);
  const [justChallenged, setJustChallenged] = useState(new Set());

  // Duel completion notification
  const [duelCompleteNotif, setDuelCompleteNotif] = useState(null); // { duel, cooks }

  // Add-friend modal
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [myFriendships, setMyFriendships] = useState([]);
  const [justSent, setJustSent] = useState(new Set());

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setMyUserId(session.user.id);
    });
  }, []);

  function applyDuels(duels, uid) {
    const map = {};
    for (const d of duels) {
      const otherId = d.challenger_id === uid ? d.opponent_id : d.challenger_id;
      if (d.status === 'active') map[otherId] = 'active';
      else if (d.status === 'completed') map[otherId] = 'completed';
      else if (d.status === 'pending' && d.challenger_id === uid) map[otherId] = 'sent';
      else if (d.status === 'pending' && d.opponent_id === uid) map[otherId] = 'incoming';
    }
    setDuelStatusMap(map);
    setIncomingDuels(duels.filter(d => d.opponent_id === uid && d.status === 'pending'));
    setActiveDuels(duels.filter(d => d.status === 'active'));
    setCompletedDuels(duels.filter(d => d.status === 'completed'));
  }

  useFocusEffect(useCallback(() => {
    if (!myUserId) return;

    // Load leaderboard
    setLbLoading(true);
    setLbError(null);
    getLeaderboard({ limit: 50 })
      .then(data => { setLeaderboard(data); setLbLoading(false); })
      .catch(err => { setLbError(err?.message || String(err)); setLbLoading(false); });

    // Load friends + pending requests + duels
    setRivalsLoading(true);
    Promise.all([getFriends(myUserId), getPendingRequests(myUserId), getMyDuels(myUserId)])
      .then(async ([f, p, duels]) => {
        const seen = new Set();
        setFriends(f.filter(x => seen.has(x.id) ? false : seen.add(x.id)));
        setPendingRequests(p);
        setJustChallenged(new Set());

        // Fetch cooks for active + completed duels
        const duelsNeedingCooks = duels.filter(d => d.status === 'active' || d.status === 'completed');
        let cooksMap = {};
        if (duelsNeedingCooks.length > 0) {
          const cooksArrays = await Promise.all(duelsNeedingCooks.map(d => getDuelCooks(d.id)));
          duelsNeedingCooks.forEach((d, i) => { cooksMap[d.id] = cooksArrays[i]; });
          setDuelCooksMap(cooksMap);
        } else {
          setDuelCooksMap({});
        }

        // Check active duels — if both players submitted, complete + award XP (idempotent)
        const completedNow = new Set();
        for (const duel of duels.filter(d => d.status === 'active')) {
          const cooks = cooksMap[duel.id] || [];
          const bothIn = cooks.some(c => c.user_id === duel.challenger_id) &&
                         cooks.some(c => c.user_id === duel.opponent_id);
          if (bothIn) {
            try {
              const changed = await completeDuel(duel.id);
              if (changed) {
                completedNow.add(duel.id);
                await Promise.all([
                  awardDuelCompletionXp(duel.challenger_id),
                  awardDuelCompletionXp(duel.opponent_id),
                ]).catch(() => {});
              }
            } catch {}
          }
        }

        // Apply final duel state — locally promote newly-completed duels
        const finalDuels = completedNow.size > 0
          ? duels.map(d => completedNow.has(d.id) ? { ...d, status: 'completed' } : d)
          : duels;
        applyDuels(finalDuels, myUserId);

        // Show notification for the first newly-completed duel
        if (completedNow.size > 0) {
          const firstId = [...completedNow][0];
          const firstDuel = finalDuels.find(d => d.id === firstId);
          if (firstDuel) setDuelCompleteNotif({ duel: firstDuel, cooks: cooksMap[firstId] || [] });
        }

        setRivalsLoading(false);
      })
      .catch(() => setRivalsLoading(false));

  }, [myUserId]));

  // Debounced user search
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const t = setTimeout(() => {
      setSearchLoading(true);
      searchUsers(searchQuery.trim(), myUserId)
        .then(r => { setSearchResults(r); setSearchLoading(false); })
        .catch(() => setSearchLoading(false));
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  async function openModal() {
    setModalVisible(true);
    setSearchQuery('');
    setSearchResults([]);
    setJustSent(new Set());
    try {
      const { data } = await supabase
        .from('friendships')
        .select('id, requester_id, addressee_id, status')
        .or(`requester_id.eq.${myUserId},addressee_id.eq.${myUserId}`);
      setMyFriendships(data || []);
    } catch {}
  }

  async function handleSendRequest(targetId) {
    try {
      await sendFriendRequest(myUserId, targetId);
    } catch {}
    setJustSent(prev => new Set([...prev, targetId]));
  }

  async function handleAccept(req) {
    try {
      await acceptFriendRequest(req.friendshipId);
      setPendingRequests(p => p.filter(r => r.friendshipId !== req.friendshipId));
      getFriends(myUserId).then(setFriends);
    } catch (e) {
      Alert.alert('Error', e?.message ?? 'Could not accept request. Try again.');
    }
  }

  async function handleIgnore(req) {
    try {
      await declineFriendRequest(req.friendshipId);
      setPendingRequests(p => p.filter(r => r.friendshipId !== req.friendshipId));
    } catch (e) {
      Alert.alert('Error', e?.message ?? 'Could not decline request. Try again.');
    }
  }

  async function handleChallenge(friendId) {
    if (activeDuels.length > 0) return;
    if (['sent', 'active', 'incoming'].includes(duelStatusMap[friendId]) || justChallenged.has(friendId)) return;
    try {
      await sendDuelChallenge(myUserId, friendId);
      setJustChallenged(prev => new Set([...prev, friendId]));
      setDuelStatusMap(prev => ({ ...prev, [friendId]: 'sent' }));
    } catch (e) {
      Alert.alert('Error', e?.message ?? 'Could not send challenge. Try again.');
    }
  }

  async function handleAcceptDuel(duel) {
    if (activeDuels.length > 0) {
      Alert.alert('Already Dueling', 'You can only be in one active duel at a time. Finish your current duel first.');
      return;
    }
    try {
      await acceptDuel(duel.id);
      setIncomingDuels(prev => prev.filter(d => d.id !== duel.id));
      setActiveDuels(prev => [...prev, { ...duel, status: 'active' }]);
      const otherId = duel.challenger_id;
      setDuelStatusMap(prev => ({ ...prev, [otherId]: 'active' }));
    } catch (e) {
      Alert.alert('Error', e?.message ?? 'Could not accept duel.');
    }
  }

  async function handleCancelDuel(duel) {
    Alert.alert(
      'Cancel Duel',
      'This will cancel the duel for both of you.',
      [
        { text: 'Keep Dueling', style: 'cancel' },
        {
          text: 'CANCEL DUEL',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelDuel(duel.id);
              setActiveDuels(prev => prev.filter(d => d.id !== duel.id));
              const otherId = duel.challenger_id === myUserId ? duel.opponent_id : duel.challenger_id;
              setDuelStatusMap(prev => {
                const next = { ...prev };
                delete next[otherId];
                return next;
              });
            } catch (e) {
              Alert.alert('Error', e?.message ?? 'Could not cancel duel.');
            }
          },
        },
      ]
    );
  }

  async function handleDeclineDuel(duel) {
    try {
      await declineDuel(duel.id);
      setIncomingDuels(prev => prev.filter(d => d.id !== duel.id));
      const otherId = duel.challenger_id;
      setDuelStatusMap(prev => {
        const next = { ...prev };
        delete next[otherId];
        return next;
      });
    } catch (e) {
      Alert.alert('Error', e?.message ?? 'Could not decline duel.');
    }
  }

  function getFriendshipLabel(userId) {
    if (justSent.has(userId)) return 'SENT';
    const f = myFriendships.find(m =>
      (m.requester_id === myUserId && m.addressee_id === userId) ||
      (m.requester_id === userId && m.addressee_id === myUserId)
    );
    if (!f) return null;
    if (f.status === 'accepted') return 'FRIENDS';
    if (f.requester_id === myUserId) return 'SENT';
    return 'ACCEPT';
  }

  const topThree = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);
  const maxXp = leaderboard[0]?.xp || 1;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>
          {activeTab === 'leaderboard' ? 'LEADERBOARD' : 'RIVALS'}
        </Text>
        <View style={styles.topBarRight}>
          {activeTab === 'rivals' && (pendingRequests.length + incomingDuels.length) > 0 && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>{pendingRequests.length + incomingDuels.length} pending</Text>
            </View>
          )}
          <VoteNotifBell />
        </View>
      </View>

      {/* Tab toggle */}
      <View style={styles.tabRow}>
        {['leaderboard', 'rivals'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={tab === 'leaderboard' ? 'trophy' : 'people'}
              size={13}
              color={activeTab === tab ? colors.background : colors.inactive}
            />
            <Text style={[styles.tabBtnText, activeTab === tab && styles.tabBtnTextActive]}>
              {tab === 'leaderboard' ? 'LEADERBOARD' : 'RIVALS'}
            </Text>
            {tab === 'rivals' && (pendingRequests.length + incomingDuels.length) > 0 && (
              <View style={styles.tabDot} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ActiveDuelBanner />

      {/* ── LEADERBOARD TAB ── */}
      {activeTab === 'leaderboard' ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {lbLoading ? (
            <View style={styles.centerState}><ActivityIndicator color={colors.accent} /></View>
          ) : lbError ? (
            <View style={styles.centerState}>
              <Ionicons name="warning-outline" size={40} color={colors.primary} />
              <Text style={styles.emptyTitle}>ERROR</Text>
              <Text style={[styles.emptySubtitle, { textAlign: 'center', paddingHorizontal: spacing.md }]}>{lbError}</Text>
            </View>
          ) : leaderboard.length === 0 ? (
            <View style={styles.centerState}>
              <Ionicons name="trophy-outline" size={40} color={colors.border} />
              <Text style={styles.emptyTitle}>NO COOKS YET</Text>
              <Text style={styles.emptySubtitle}>Be the first to post a cook!</Text>
            </View>
          ) : (
            <>
              <View style={styles.podiumRow}>
                {topThree.map((e, i) => <PodiumCard key={e.id} entry={e} position={i} isMe={e.id === myUserId} onPress={() => navigation.navigate('UserProfile', { userId: e.id })} />)}
              </View>
              <View style={styles.restDivider}>
                <View style={styles.restDividerLine} />
                <Text style={styles.restDividerText}>RANKINGS</Text>
                <View style={styles.restDividerLine} />
              </View>
              <View style={styles.lbList}>
                {rest.map((e, i) => <LeaderboardRow key={e.id} entry={e} position={i + 3} maxXp={maxXp} isMe={e.id === myUserId} onPress={() => navigation.navigate('UserProfile', { userId: e.id })} />)}
              </View>
            </>
          )}
          <View style={{ height: spacing.xl }} />
        </ScrollView>
      ) : (

      /* ── RIVALS TAB ── */
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* Incoming duel challenges */}
          {incomingDuels.length > 0 && (
            <>
              <SectionLabel title={`DUEL CHALLENGES · ${incomingDuels.length}`} />
              <View style={styles.listBlock}>
                {incomingDuels.map(d => (
                  <DuelChallengeCard
                    key={d.id}
                    duel={d}
                    onAccept={() => handleAcceptDuel(d)}
                    onDecline={() => handleDeclineDuel(d)}
                    hasActiveDuel={activeDuels.length > 0}
                  />
                ))}
              </View>
            </>
          )}

          {/* Pending friend requests */}
          {pendingRequests.length > 0 && (
            <>
              <SectionLabel title={`REQUESTS · ${pendingRequests.length}`} />
              <View style={styles.listBlock}>
                {pendingRequests.map(r => (
                  <PendingCard
                    key={r.friendshipId}
                    request={r}
                    onAccept={() => handleAccept(r)}
                    onIgnore={() => handleIgnore(r)}
                  />
                ))}
              </View>
            </>
          )}

          {/* Friends */}
          <SectionLabel
            title="FRIENDS"
            action={
              <TouchableOpacity style={styles.addFriendBtn} onPress={openModal} activeOpacity={0.8}>
                <Ionicons name="person-add-outline" size={12} color={colors.background} />
                <Text style={styles.addFriendText}>ADD</Text>
              </TouchableOpacity>
            }
          />
          {rivalsLoading ? (
            <View style={styles.centerState}><ActivityIndicator color={colors.accent} size="small" /></View>
          ) : friends.length === 0 ? (
            <View style={styles.emptyFriends}>
              <Text style={styles.emptyFriendsText}>No friends yet — tap ADD to find cooks</Text>
            </View>
          ) : (
            <View style={styles.listBlock}>
              {friends.map(f => {
                const duelStatus = justChallenged.has(f.id) ? 'sent' : (duelStatusMap[f.id] ?? null);
                return (
                  <FriendCard
                    key={f.id}
                    friend={f}
                    duelStatus={duelStatus}
                    onChallenge={() => handleChallenge(f.id)}
                    onPress={() => navigation.navigate('UserProfile', { userId: f.id })}
                    hasAnyActiveDuel={activeDuels.length > 0}
                  />
                );
              })}
            </View>
          )}

          {/* Active duels */}
          {activeDuels.length > 0 && (
            <>
              <SectionLabel title={`ACTIVE DUELS · ${activeDuels.length}`} />
              <View style={styles.listBlock}>
                {activeDuels.map(d => (
                  <ActiveDuelCard key={d.id} duel={d} myUserId={myUserId} duelCooks={duelCooksMap[d.id] || []} onCancel={() => handleCancelDuel(d)} />
                ))}
              </View>
            </>
          )}

          {/* Duel history */}
          {completedDuels.length > 0 && (
            <>
              <SectionLabel title={`DUEL HISTORY · ${completedDuels.length}`} />
              <View style={styles.listBlock}>
                {completedDuels.map(d => (
                  <CompletedDuelCard
                    key={d.id}
                    duel={d}
                    duelCooks={duelCooksMap[d.id] || []}
                    onPress={() => navigation.navigate('DuelResult', { duel: d, cooks: duelCooksMap[d.id] || [] })}
                  />
                ))}
              </View>
            </>
          )}

          {/* XP breakdown */}
          <View style={styles.xpBox}>
            <Text style={styles.xpBoxTitle}>RIVAL BONUS BREAKDOWN</Text>
            {XP_BONUSES.map(({ label, xp }) => (
              <View key={label} style={styles.xpRow}>
                <Text style={styles.xpLabel}>{label}</Text>
                <Text style={styles.xpValue}>{xp}</Text>
              </View>
            ))}
            <View style={styles.xpDivider} />
            <View style={styles.xpRow}>
              <Text style={[styles.xpLabel, { color: colors.white, fontWeight: '900' }]}>Max per duel</Text>
              <Text style={[styles.xpValue, { fontSize: 15, color: colors.success }]}>+350 XP</Text>
            </View>
          </View>

          <View style={{ height: spacing.xl }} />
        </ScrollView>
      )}

      {/* ── ADD FRIEND MODAL ── */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setModalVisible(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>FIND A COOK</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={colors.white} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={16} color={colors.inactive} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by username..."
                placeholderTextColor={colors.inactive}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color={colors.inactive} />
                </TouchableOpacity>
              )}
            </View>

            {searchLoading ? (
              <View style={styles.modalCenter}><ActivityIndicator color={colors.accent} /></View>
            ) : searchResults.length === 0 && searchQuery.trim().length > 0 ? (
              <View style={styles.modalCenter}>
                <Text style={styles.emptySubtitle}>No cooks found</Text>
              </View>
            ) : (
              <ScrollView style={styles.resultsList} keyboardShouldPersistTaps="handled">
                {searchResults.map(user => {
                  const label = getFriendshipLabel(user.id);
                  const rankColor = RANK_COLORS[user.rank] || colors.accent;
                  return (
                    <View key={user.id} style={styles.resultRow}>
                      <Avatar uri={user.avatar_url} letters={initials(user.username)} rankColor={rankColor} size={40} />
                      <View style={styles.resultInfo}>
                        <Text style={styles.resultName}>@{user.username}</Text>
                        <RankChip rank={user.rank} rankColor={rankColor} />
                      </View>
                      {label ? (
                        <View style={styles.sentChip}>
                          <Text style={styles.sentChipText}>{label}</Text>
                        </View>
                      ) : (
                        <TouchableOpacity style={styles.addBtn} onPress={() => handleSendRequest(user.id)} activeOpacity={0.8}>
                          <Ionicons name="person-add-outline" size={13} color={colors.white} />
                          <Text style={styles.addBtnText}>ADD</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── DUEL COMPLETE NOTIFICATION ── */}
      <Modal visible={!!duelCompleteNotif} animationType="fade" transparent onRequestClose={() => setDuelCompleteNotif(null)}>
        <View style={styles.notifOverlay}>
          <View style={styles.notifCard}>
            <View style={styles.notifHeader}>
              <Ionicons name="flash" size={14} color={colors.background} />
              <Text style={styles.notifHeaderText}>DUEL COMPLETE!</Text>
            </View>
            <Text style={styles.notifBody}>
              Both cooks are in. You and @{
                duelCompleteNotif?.duel
                  ? (duelCompleteNotif.duel.challenger_id === myUserId
                      ? duelCompleteNotif.duel.opponent?.username
                      : duelCompleteNotif.duel.challenger?.username)
                  : '...'
              } each earned +{DUEL_COMPLETION_XP} XP.
            </Text>
            <View style={styles.notifBtns}>
              <TouchableOpacity
                style={styles.notifViewBtn}
                activeOpacity={0.85}
                onPress={() => {
                  const n = duelCompleteNotif;
                  setDuelCompleteNotif(null);
                  navigation.navigate('DuelResult', { duel: n.duel, cooks: n.cooks });
                }}
              >
                <Text style={styles.notifViewText}>VIEW RESULT</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.notifDismissBtn} activeOpacity={0.8} onPress={() => setDuelCompleteNotif(null)}>
                <Text style={styles.notifDismissText}>DISMISS</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  topBar: {
    backgroundColor: colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 14,
    borderBottomWidth: borders.thin, borderBottomColor: colors.border,
  },
  topBarTitle: {
    color: colors.white, fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.tight,
  },
  pendingBadge: {
    backgroundColor: colors.gold, paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  pendingBadgeText: {
    color: colors.background, fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.black, letterSpacing: 0.5,
  },

  tabRow: { flexDirection: 'row', borderBottomWidth: borders.thin, borderBottomColor: colors.border },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, paddingVertical: spacing.sm + 2,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive: { backgroundColor: colors.accent, borderBottomColor: colors.accent },
  tabBtnText: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  tabBtnTextActive: { color: colors.background },
  tabDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gold },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: spacing.md },

  centerState: { alignItems: 'center', paddingVertical: spacing.xxl * 2, gap: spacing.sm },
  emptyTitle: { color: colors.border, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  emptySubtitle: { color: colors.inactive, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },

  // Podium
  podiumRow: { flexDirection: 'row', justifyContent: 'center', paddingHorizontal: spacing.md, gap: spacing.sm, marginBottom: spacing.md },
  podiumCard: {
    flex: 1, backgroundColor: colors.surface,
    borderWidth: borders.medium, borderColor: colors.border,
    padding: spacing.sm, alignItems: 'center', gap: 4, position: 'relative',
  },
  podiumCardMe: { borderColor: colors.accent, backgroundColor: '#0a120a' },
  podiumBadge: { position: 'absolute', top: -1, left: -1, paddingHorizontal: 6, paddingVertical: 2 },
  podiumBadgeText: { color: colors.background, fontSize: 8, fontWeight: typography.fontWeight.black, letterSpacing: 1 },
  podiumName: { color: colors.white, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, marginTop: 2 },
  podiumXp: { color: colors.accent, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black },

  restDivider: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, marginBottom: spacing.sm, gap: spacing.sm },
  restDividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  restDividerText: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },

  lbList: { paddingHorizontal: spacing.md, gap: 2 },
  lbRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: borders.thin, borderColor: colors.border, padding: spacing.sm, gap: spacing.sm },
  lbRowMe: { borderColor: colors.accent, backgroundColor: '#0a120a' },
  lbRank: { color: colors.inactive, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.black, width: 32, textAlign: 'center' },
  lbInfo: { flex: 1, gap: 5 },
  lbNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  lbName: { color: colors.white, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.black, flex: 1 },
  lbBarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  lbBarTrack: { flex: 1, height: 4, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  lbBarFill: { height: '100%' },
  lbXp: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold, width: 52, textAlign: 'right' },
  lbStats: { alignItems: 'center', minWidth: 36 },
  lbStatNum: { color: colors.white, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.black },
  lbStatLabel: { color: colors.inactive, fontSize: 8, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },

  // Section label
  sectionLabelRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: spacing.md, marginBottom: spacing.sm, marginTop: spacing.lg, gap: spacing.sm,
  },
  sectionLabel: { color: colors.accent, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  sectionLine: { flex: 1, height: 1, backgroundColor: colors.border },

  addFriendBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.accent, paddingHorizontal: spacing.sm, paddingVertical: 4,
  },
  addFriendText: { color: colors.background, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: 0.8 },

  listBlock: { marginHorizontal: spacing.md, gap: spacing.xs },

  // Pending cards
  pendingCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderWidth: borders.thin, borderColor: colors.gold,
    padding: spacing.sm,
  },
  pendingInfo: { flex: 1, gap: 3 },
  pendingName: { color: colors.white, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.black },
  pendingActions: { flexDirection: 'row', gap: spacing.xs },
  acceptBtn: { backgroundColor: '#00C47A', paddingHorizontal: spacing.sm, paddingVertical: 6 },
  acceptText: { color: colors.background, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: 0.8 },
  ignoreBtn: { borderWidth: borders.thin, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  ignoreText: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: 0.8 },

  // Duel challenge card (incoming)
  duelChallengeCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderWidth: borders.thin, borderColor: colors.primary,
    padding: spacing.sm,
  },
  duelChallengeLabel: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },
  duelBlockedNote: { color: colors.primary, fontSize: 9, fontWeight: typography.fontWeight.bold, marginTop: 2 },
  acceptBtnDisabled: { backgroundColor: colors.border },

  // Friend cards
  friendCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderWidth: borders.thin, borderColor: colors.border,
    padding: spacing.sm,
  },
  friendInfo: { flex: 1, gap: 3 },
  friendNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  friendName: { color: colors.white, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.black, flex: 1 },
  friendMeta: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },
  challengeBtn: { borderWidth: borders.thin, borderColor: colors.accent, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  challengeText: { color: colors.accent, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: 0.8 },
  challengeBtnDisabled: { borderWidth: borders.thin, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  challengeTextDisabled: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: 0.8 },
  challengeBtnActive: { borderWidth: borders.thin, borderColor: colors.primary, paddingHorizontal: spacing.sm, paddingVertical: 6, backgroundColor: '#1a0000' },
  challengeTextActive: { color: colors.primary, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: 0.8 },
  challengeBtnIncoming: { borderWidth: borders.thin, borderColor: colors.gold, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  challengeTextIncoming: { color: colors.gold, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: 0.8 },

  // Empty friends
  emptyFriends: { marginHorizontal: spacing.md, backgroundColor: colors.surface, borderWidth: borders.thin, borderColor: colors.border, padding: spacing.lg, alignItems: 'center' },
  emptyFriendsText: { color: colors.inactive, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },

  // Active duel card (two-sided)
  activeDuelCard: {
    backgroundColor: colors.surface, borderWidth: borders.thin, borderColor: colors.primary,
    padding: spacing.sm, gap: spacing.sm,
  },
  activeDuelHeader: { flexDirection: 'row', alignItems: 'center' },
  activeDuelChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary, paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  activeDuelChipText: { color: colors.white, fontSize: 8, fontWeight: typography.fontWeight.black, letterSpacing: 1.2 },
  activeDuelVsRow: { flexDirection: 'row', alignItems: 'center' },
  activeDuelSide: { flex: 1, alignItems: 'center', gap: 5, paddingVertical: spacing.xs },
  activeDuelVsDivider: { width: 32, alignItems: 'center' },
  activeDuelVsText: { color: colors.border, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: 2 },
  activeDuelName: { color: colors.white, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, textAlign: 'center' },
  activeDuelStatus: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderWidth: borders.thin, borderColor: colors.border,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  activeDuelStatusDone: { backgroundColor: colors.success, borderColor: colors.success },
  activeDuelStatusText: { color: colors.inactive, fontSize: 8, fontWeight: typography.fontWeight.black, letterSpacing: 0.8 },
  activeDuelStatusTextDone: { color: colors.background },
  activeDuelCancelBtn: { marginLeft: 'auto', borderWidth: 1, borderColor: colors.primary, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  activeDuelCancelText: { color: colors.primary, fontSize: 8, fontWeight: typography.fontWeight.black, letterSpacing: 1 },

  // Completed duel card
  completedDuelCard: {
    backgroundColor: '#0a1a0a', borderWidth: borders.thin, borderColor: colors.success,
    padding: spacing.sm, gap: spacing.sm,
  },
  completedDuelHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  completedDuelChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.success, paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  completedDuelChipText: { color: colors.background, fontSize: 8, fontWeight: typography.fontWeight.black, letterSpacing: 1.2 },
  completedDuelXpChip: {
    backgroundColor: '#1a3a1a', borderWidth: borders.thin, borderColor: colors.success,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  completedDuelXpText: { color: colors.success, fontSize: 8, fontWeight: typography.fontWeight.black, letterSpacing: 1 },
  completedDuelRow: { flexDirection: 'row', alignItems: 'flex-start' },
  completedDuelSide: { flex: 1, alignItems: 'center', gap: 5, paddingVertical: spacing.xs },
  completedDuelPhoto: {
    width: 72, height: 72, borderWidth: borders.medium, overflow: 'hidden',
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  completedDuelVsDivider: { width: 32, alignItems: 'center', justifyContent: 'center', paddingTop: 28 },
  completedDuelVsText: { color: colors.border, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: 2 },
  completedDuelUsername: { color: colors.white, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, textAlign: 'center' },
  completedDuelDish: { color: colors.inactive, fontSize: 9, fontWeight: typography.fontWeight.bold, textAlign: 'center' },

  // Legacy duel card styles (kept for any remnant references)
  statusChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  statusChipText: { fontSize: 8, fontWeight: typography.fontWeight.black, letterSpacing: 0.8 },

  // XP breakdown
  xpBox: { marginHorizontal: spacing.md, marginTop: spacing.md, backgroundColor: colors.surface, borderWidth: borders.thin, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  xpBoxTitle: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider, marginBottom: spacing.xs },
  xpRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  xpLabel: { color: colors.inactive, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },
  xpValue: { color: colors.success, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.black, letterSpacing: 0.5 },
  xpDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },

  // Shared
  avatar: { borderWidth: 2, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontWeight: typography.fontWeight.black, letterSpacing: 0.5 },
  rankChip: { borderWidth: 1, paddingHorizontal: 5, paddingVertical: 1 },
  rankChipText: { fontSize: 7, fontWeight: typography.fontWeight.black, letterSpacing: 1 },

  // Top bar extras
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

  // Add-friend modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopWidth: borders.medium, borderTopColor: colors.primary,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  modalTitle: { color: colors.white, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.background, borderBottomWidth: borders.thin, borderBottomColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  searchInput: {
    flex: 1, color: colors.white, fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold, paddingVertical: spacing.xs,
  },
  modalCenter: { alignItems: 'center', padding: spacing.xxl },
  resultsList: { maxHeight: 380 },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  resultInfo: { flex: 1, gap: 4 },
  resultName: { color: colors.white, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.black },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.accent, paddingHorizontal: spacing.sm, paddingVertical: 6,
  },
  addBtnText: { color: colors.white, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: 0.8 },
  sentChip: { borderWidth: borders.thin, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  sentChipText: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: 0.8 },

  completedDuelTapHint: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 'auto' },
  completedDuelTapHintText: { color: colors.inactive, fontSize: 9, fontWeight: typography.fontWeight.black, letterSpacing: 0.6 },

  notifOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center', padding: spacing.lg,
  },
  notifCard: {
    backgroundColor: colors.surface, borderWidth: borders.medium,
    borderColor: colors.accent, width: '100%', overflow: 'hidden',
  },
  notifHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.accent, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  notifHeaderText: {
    color: colors.background, fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider,
  },
  notifBody: {
    color: colors.white, fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold, lineHeight: 22,
    padding: spacing.md,
  },
  notifBtns: { flexDirection: 'row', borderTopWidth: borders.thin, borderColor: colors.border },
  notifViewBtn: {
    flex: 1, backgroundColor: colors.primary,
    paddingVertical: spacing.md, alignItems: 'center',
  },
  notifViewText: {
    color: colors.white, fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider,
  },
  notifDismissBtn: {
    flex: 1, paddingVertical: spacing.md, alignItems: 'center',
    borderLeftWidth: borders.thin, borderColor: colors.border,
  },
  notifDismissText: {
    color: colors.inactive, fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider,
  },
});
