import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ScrollView, Dimensions, ActivityIndicator, PanResponder,
  KeyboardAvoidingView, TextInput, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { colors, spacing, typography, borders } from '../theme';
import { getCookById, getComments, addComment, deleteComment, voteCook, unvoteCook, timeAgo } from '../lib/api';

const { width: W } = Dimensions.get('window');
const MEDIA_HEIGHT = W * 1.1;

const RANK_COLORS = {
  'Gold Cook':        '#FFB800',
  'Emerald Cook':     '#00C47A',
  'Diamond Cook':     '#88CCFF',
  'Chef':             '#E8001C',
  'Exec Chef':        '#A855F7',
  'Master Chef':      '#FF6B00',
  'World Class Chef': '#FFFFFF',
};

function pad(n) { return String(n).padStart(2, '0'); }
function formatTime(secs) {
  if (secs == null) return '—';
  return `${pad(Math.floor(secs / 60))}:${pad(secs % 60)}`;
}

function VideoSlide({ uri }) {
  const player = useVideoPlayer(uri, p => {
    p.loop = true;
    p.muted = false;
  });
  useEffect(() => { player.play(); }, [player]);
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

function CommentRow({ comment, currentUserId, onDelete }) {
  const profile = comment.profiles || {};
  const rankColor = RANK_COLORS[profile.rank] || colors.accent;
  const isOwn = currentUserId && comment.user_id === currentUserId;
  return (
    <View style={styles.commentRow}>
      <View style={[styles.commentStripe, { backgroundColor: rankColor }]} />
      <View style={styles.commentContent}>
        <View style={styles.commentMeta}>
          <Text style={[styles.commentUser, { color: rankColor }]}>@{profile.username || '?'}</Text>
          <Text style={styles.commentTime}>{timeAgo(comment.created_at)}</Text>
          {isOwn && (
            <TouchableOpacity onPress={() => onDelete(comment.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={13} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.commentText}>{comment.text}</Text>
      </View>
    </View>
  );
}

export default function PostDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { item: paramItem, cookId } = route.params || {};

  const [item, setItem] = useState(paramItem || null);
  const [loading, setLoading] = useState(!paramItem);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [activeMediaIdx, setActiveMediaIdx] = useState(0);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [voted, setVoted] = useState(false);
  const [localVoteCount, setLocalVoteCount] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setCurrentUserId(session.user.id);
    });
  }, []);

  useEffect(() => {
    if (paramItem || !cookId) return;
    getCookById(cookId).then(setItem).catch(() => {}).finally(() => setLoading(false));
  }, [cookId]);

  useEffect(() => {
    if (!item?.id) return;
    getComments(item.id).then(setComments).catch(() => {});
  }, [item?.id]);

  useEffect(() => {
    if (!item) return;
    const votes = Array.isArray(item.votes) ? item.votes : [];
    setLocalVoteCount(votes.length);
    setVoted(currentUserId ? votes.some(v => v.user_id === currentUserId) : false);
  }, [item?.id, currentUserId]);

  // Build ordered media array: video → finale → mid → pre
  const mediaItems = useMemo(() => {
    if (!item) return [];
    const items = [];
    if (item.video_url) items.push({ type: 'video', uri: item.video_url });
    [...(item.photo_urls ?? [])].reverse().forEach(uri => items.push({ type: 'photo', uri }));
    return items;
  }, [item]);

  // Keep count in ref so PanResponder closure stays fresh
  const mediaCountRef = useRef(0);
  mediaCountRef.current = mediaItems.length;

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, { dx, dy }) =>
      Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10,
    onPanResponderRelease: (_, { dx }) => {
      if (dx < -50) setActiveMediaIdx(i => Math.min(i + 1, mediaCountRef.current - 1));
      else if (dx > 50) setActiveMediaIdx(i => Math.max(i - 1, 0));
    },
  })).current;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.white} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!item) return null;

  const profile = item.profiles || {};
  const rankColor = RANK_COLORS[profile.rank] || colors.accent;
  const isOwnPost = currentUserId && (profile.id === currentUserId || item.user_id === currentUserId);
  const ingredients = item.ingredients || [];
  const hasIngredients = ingredients.length > 0;
  const activeMedia = mediaItems[activeMediaIdx] ?? null;

  async function handleAddComment() {
    if (!commentText.trim() || !currentUserId || submittingComment) return;
    setSubmittingComment(true);
    try {
      const newComment = await addComment(item.id, currentUserId, commentText.trim());
      setComments(prev => [...prev, newComment]);
      setCommentText('');
    } catch {}
    setSubmittingComment(false);
  }

  async function handleDeleteComment(commentId) {
    if (!currentUserId) return;
    setComments(prev => prev.filter(c => c.id !== commentId));
    try { await deleteComment(commentId, currentUserId); }
    catch { getComments(item.id).then(setComments).catch(() => {}); }
  }

  async function handleVote() {
    if (!currentUserId || isOwnPost) return;
    if (voted) {
      setVoted(false);
      setLocalVoteCount(c => c - 1);
      try { await unvoteCook(item.id, currentUserId); }
      catch { setVoted(true); setLocalVoteCount(c => c + 1); }
    } else {
      setVoted(true);
      setLocalVoteCount(c => c + 1);
      try { await voteCook(item.id, currentUserId); }
      catch { setVoted(false); setLocalVoteCount(c => c - 1); }
    }
  }

  function handleLetMeCook() {
    navigation.navigate('MainTabs', {
      screen: 'Cook',
      params: {
        inspiredByCookId: item.id,
        inspiredByUserId: profile.id,
        inspiredByUsername: profile.username,
        inspiredByDishName: item.dish_name,
      },
    });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']} {...panResponder.panHandlers}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>POST</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Inspired by — top banner */}
        {item.inspired_by?.username && (
          <TouchableOpacity
            style={styles.inspiredBanner}
            activeOpacity={0.8}
            onPress={() => navigation.push('PostDetail', { cookId: item.inspired_by_cook_id })}
          >
            <View style={styles.inspiredBannerLeft}>
              <Ionicons name="flame" size={16} color={colors.background} />
              <View>
                <Text style={styles.inspiredBannerLabel}>INSPIRED BY</Text>
                <Text style={styles.inspiredBannerHandle}>@{item.inspired_by.username}</Text>
              </View>
            </View>
            <View style={styles.inspiredBannerChevron}>
              <Text style={styles.inspiredBannerSee}>SEE ORIGINAL</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.background} />
            </View>
          </TouchableOpacity>
        )}

        {/* Media carousel */}
        <View style={styles.mediaWrap}>
          {/* Active media */}
          <View style={styles.mediaSlide}>
            {activeMedia?.type === 'video' ? (
              <VideoSlide uri={activeMedia.uri} />
            ) : activeMedia?.uri ? (
              <Image source={{ uri: activeMedia.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <View style={styles.mediaPlaceholder}>
                <Ionicons name="restaurant" size={60} color={colors.border} />
              </View>
            )}
          </View>

          {/* Media type label */}
          {activeMedia && (
            <View style={styles.mediaTypeBadge}>
              <Ionicons
                name={activeMedia.type === 'video' ? 'play' : 'camera'}
                size={9}
                color={colors.white}
              />
              <Text style={styles.mediaTypeText}>
                {activeMedia.type === 'video' ? 'VIDEO' : ['PRE-COOK', 'MID-COOK', 'FINALE'][mediaItems.length - 1 - activeMediaIdx] ?? 'PHOTO'}
              </Text>
            </View>
          )}

          {/* Dot indicators */}
          {mediaItems.length > 1 && (
            <View style={styles.mediaDots}>
              {mediaItems.map((m, i) => (
                <TouchableOpacity key={i} onPress={() => setActiveMediaIdx(i)}>
                  <View style={[
                    styles.mediaDot,
                    i === activeMediaIdx && { backgroundColor: colors.white, width: 16 },
                    m.type === 'video' && i === activeMediaIdx && { backgroundColor: colors.primary },
                  ]} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Author overlay */}
          <View style={styles.authorOverlay}>
            <View style={[styles.rankChip, { borderColor: rankColor }]}>
              <Text style={[styles.rankChipText, { color: rankColor }]}>{profile.rank}</Text>
            </View>
            <Text style={styles.heroUsername}>@{profile.username}</Text>
            <Text style={styles.heroTime}>{timeAgo(item.created_at)}</Text>
          </View>
        </View>

        {/* Dish name + vote */}
        <View style={styles.dishBlock}>
          <View style={[styles.dishAccent, { backgroundColor: rankColor }]} />
          <Text style={styles.dishName}>{(item.dish_name || '').toUpperCase()}</Text>
          <TouchableOpacity
            style={[styles.voteBtn, voted && styles.voteBtnActive]}
            onPress={handleVote}
            disabled={isOwnPost || !currentUserId}
            activeOpacity={0.8}
          >
            <Ionicons name={voted ? 'flame' : 'flame-outline'} size={18} color={voted ? colors.white : colors.inactive} />
            <Text style={[styles.voteBtnText, voted && styles.voteBtnTextActive]}>{localVoteCount}</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <Text style={styles.statVal}>{formatTime(item.cook_time_secs)}</Text>
            <Text style={styles.statLabel}>COOK TIME</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={[styles.statVal, { color: colors.accent }]}>+{item.xp_earned ?? 0}</Text>
            <Text style={styles.statLabel}>XP EARNED</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statVal}>{localVoteCount}</Text>
            <Text style={styles.statLabel}>VOTES</Text>
          </View>
        </View>

        {/* Ingredients */}
        <View style={styles.ingredientsBlock}>
          <View style={styles.ingredientsHeader}>
            <Text style={styles.ingredientsTitle}>INGREDIENTS</Text>
            {!hasIngredients && <Text style={styles.ingredientsEmpty}>not listed</Text>}
          </View>
          {hasIngredients
            ? ingredients.map((ing, i) => (
                <View key={i} style={styles.ingredientRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.ingredientText}>{ing}</Text>
                </View>
              ))
            : <View style={styles.noIngredientsWrap}>
                <Ionicons name="list-outline" size={16} color={colors.border} />
                <Text style={styles.noIngredientsText}>This cook didn't include an ingredient list</Text>
              </View>
          }
        </View>

        {/* Comments */}
        <View style={styles.commentsBlock}>
          <View style={styles.commentsHeader}>
            <Text style={styles.commentsTitle}>COMMENTS</Text>
            {comments.length > 0 && <Text style={styles.commentsCount}>{comments.length}</Text>}
          </View>
          {comments.length === 0 ? (
            <Text style={styles.commentsEmpty}>Be the first to comment</Text>
          ) : (
            comments.map(c => <CommentRow key={c.id} comment={c} currentUserId={currentUserId} onDelete={handleDeleteComment} />)
          )}
        </View>

        <View style={{ height: 160 }} />
      </ScrollView>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {!isOwnPost && (
          <View style={styles.ctaWrap}>
            <Text style={styles.ctaSub}>You + original chef both earn bonus XP</Text>
            <TouchableOpacity style={styles.ctaBtn} onPress={handleLetMeCook} activeOpacity={0.85}>
              <Ionicons name="flame" size={20} color={colors.white} />
              <Text style={styles.ctaBtnText}>LET ME COOK</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.commentInputBar}>
          <TextInput
            style={styles.commentInput}
            placeholder="Add a comment..."
            placeholderTextColor={colors.inactive}
            value={commentText}
            onChangeText={setCommentText}
            returnKeyType="send"
            onSubmitEditing={handleAddComment}
            editable={!!currentUserId}
          />
          <TouchableOpacity
            style={[styles.commentSendBtn, (!commentText.trim() || submittingComment) && styles.commentSendBtnDisabled]}
            onPress={handleAddComment}
            disabled={!commentText.trim() || submittingComment}
            activeOpacity={0.8}
          >
            {submittingComment
              ? <ActivityIndicator size="small" color={colors.white} />
              : <Ionicons name="send" size={16} color={colors.white} />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: borders.thin, borderColor: colors.border,
  },
  backBtn: { padding: spacing.xs },
  headerTitle: {
    color: colors.white, fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider,
  },
  headerSpacer: { width: 36 },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xl },

  // Inspired by banner
  inspiredBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.primary,
    borderBottomWidth: borders.medium, borderColor: '#000',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  inspiredBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inspiredBannerLabel: {
    color: 'rgba(255,255,255,0.7)', fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider,
  },
  inspiredBannerHandle: {
    color: colors.white, fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wide,
  },
  inspiredBannerChevron: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  inspiredBannerSee: {
    color: 'rgba(255,255,255,0.7)', fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider,
  },

  // Media carousel
  mediaWrap: { width: W, height: MEDIA_HEIGHT, backgroundColor: colors.surface, position: 'relative' },
  mediaSlide: { ...StyleSheet.absoluteFillObject },
  mediaPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  mediaTypeBadge: {
    position: 'absolute', top: spacing.md, left: spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderWidth: borders.thin, borderColor: 'rgba(255,255,255,0.15)',
  },
  mediaTypeText: {
    color: colors.white, fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider,
  },

  mediaDots: {
    position: 'absolute', top: spacing.md, right: spacing.md,
    flexDirection: 'column', gap: 4, alignItems: 'center',
  },
  mediaDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },

  authorOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: spacing.md, gap: 4,
  },
  rankChip: {
    alignSelf: 'flex-start', borderWidth: borders.thin,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  rankChipText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  heroUsername: {
    color: colors.white, fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wide,
  },
  heroTime: { color: 'rgba(255,255,255,0.55)', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },

  dishBlock: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, borderBottomWidth: borders.thin, borderColor: colors.border,
  },
  dishAccent: { width: 4, height: 32 },
  dishName: {
    flex: 1, color: colors.white, fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider,
  },
  voteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: borders.thin, borderColor: colors.border,
    paddingHorizontal: spacing.sm, paddingVertical: 8,
  },
  voteBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  voteBtnText: {
    color: colors.inactive, fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.black, letterSpacing: 0.5,
  },
  voteBtnTextActive: { color: colors.white },

  statsRow: {
    flexDirection: 'row',
    borderBottomWidth: borders.thin, borderColor: colors.border,
  },
  statCell: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, gap: 3 },
  statVal: {
    color: colors.white, fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.black, fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: colors.inactive, fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold, letterSpacing: typography.letterSpacing.wider,
  },
  statDivider: { width: borders.thin, backgroundColor: colors.border },

  ingredientsBlock: {
    padding: spacing.md,
    borderBottomWidth: borders.thin, borderColor: colors.border,
  },
  ingredientsHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  ingredientsTitle: {
    color: colors.white, fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider,
  },
  ingredientsEmpty: {
    color: colors.inactive, fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold, letterSpacing: typography.letterSpacing.wide,
  },
  ingredientRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 3 },
  bullet: { color: colors.accent, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.black, lineHeight: 20 },
  ingredientText: { flex: 1, color: colors.white, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold, lineHeight: 20 },
  noIngredientsWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  noIngredientsText: { color: colors.border, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },

  // Comments section
  commentsBlock: {
    padding: spacing.md,
    borderTopWidth: borders.thin, borderColor: colors.border,
  },
  commentsHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  commentsTitle: { color: colors.white, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  commentsCount: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },
  commentsEmpty: { color: colors.border, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, paddingVertical: spacing.sm },
  commentRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: '#111' },
  commentStripe: { width: 2, alignSelf: 'stretch', minHeight: 36 },
  commentContent: { flex: 1, gap: 4 },
  commentMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  commentUser: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black },
  commentTime: { color: '#555', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold },
  commentText: { color: colors.white, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, lineHeight: 18 },

  // Comment input bar
  commentInputBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: borders.thin, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  commentInput: {
    flex: 1, color: colors.white, fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    backgroundColor: colors.background, borderWidth: borders.thin, borderColor: colors.border,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    minHeight: 36,
  },
  commentSendBtn: {
    width: 36, height: 36, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  commentSendBtnDisabled: { backgroundColor: colors.border },

  ctaWrap: {
    borderTopWidth: borders.thin, borderColor: colors.border,
    backgroundColor: colors.background, paddingHorizontal: spacing.md,
    paddingTop: spacing.sm, paddingBottom: spacing.md, gap: spacing.xs,
  },
  ctaSub: {
    color: colors.inactive, fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold, textAlign: 'center',
    letterSpacing: typography.letterSpacing.wide,
  },
  ctaBtn: {
    backgroundColor: colors.primary, borderWidth: borders.medium, borderColor: '#000',
    paddingVertical: spacing.md, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
  },
  ctaBtnText: {
    color: colors.white, fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider,
  },
});
