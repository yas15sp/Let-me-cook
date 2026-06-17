import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system/legacy';

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Feed ─────────────────────────────────────────────────────────────────────

export async function getFeed({ limit = 20, offset = 0 } = {}) {
  const range = [offset, offset + limit - 1];

  // Attempt 1: full schema (is_event_winner + inspired cols)
  // profiles!user_id disambiguates the two FKs from cooks → profiles
  const { data: d1, error: e1 } = await supabase
    .from('cooks')
    .select(`
      id, dish_name, photo_urls, video_url, cook_time_secs,
      boosts, xp_earned, verified, created_at, event_id,
      is_event_winner, ingredients,
      inspired_by_cook_id, inspired_by_user_id,
      inspired_by:profiles!inspired_by_user_id(id, username),
      profiles!user_id(id, username, rank, rank_tier, level, xp),
      votes (id, user_id)
    `)
    .order('created_at', { ascending: false })
    .range(...range);
  if (!e1) return d1;

  // Attempt 2: without is_event_winner, still with inspired cols
  const { data: d2, error: e2 } = await supabase
    .from('cooks')
    .select(`
      id, dish_name, photo_urls, video_url, cook_time_secs,
      boosts, xp_earned, verified, created_at, event_id,
      ingredients,
      inspired_by_cook_id, inspired_by_user_id,
      inspired_by:profiles!inspired_by_user_id(id, username),
      profiles!user_id(id, username, rank, rank_tier, level, xp),
      votes (id, user_id)
    `)
    .order('created_at', { ascending: false })
    .range(...range);
  if (!e2) return d2;

  // Attempt 3: baseline — no optional cols at all
  const { data: d3, error: e3 } = await supabase
    .from('cooks')
    .select(`
      id, dish_name, photo_urls, video_url, cook_time_secs,
      boosts, xp_earned, verified, created_at, event_id,
      profiles!user_id(id, username, rank, rank_tier, level, xp),
      votes (id, user_id)
    `)
    .order('created_at', { ascending: false })
    .range(...range);
  if (e3) throw e3;
  return d3;
}

export async function getCookById(cookId) {
  const { data, error } = await supabase
    .from('cooks')
    .select(`
      *,
      profiles!user_id(id, username, rank, rank_tier, level, avatar_url),
      votes (id, user_id),
      inspired_by:profiles!inspired_by_user_id(id, username)
    `)
    .eq('id', cookId)
    .single();
  if (error) throw error;
  return data;
}

// ─── Votes ────────────────────────────────────────────────────────────────────

export async function voteCook(cookId, userId) {
  const { error } = await supabase
    .from('votes')
    .insert({ cook_id: cookId, user_id: userId });
  if (error) throw error;
}

export async function unvoteCook(cookId, userId) {
  const { error } = await supabase
    .from('votes')
    .delete()
    .eq('cook_id', cookId)
    .eq('user_id', userId);
  if (error) throw error;
}

// ─── Cook submission ──────────────────────────────────────────────────────────

async function uploadToStorage(localUri, path, contentType) {
  const { data: signed, error: signedErr } = await supabase.storage
    .from('cook-media')
    .createSignedUploadUrl(path);
  if (signedErr) throw signedErr;

  const result = await FileSystem.uploadAsync(signed.signedUrl, localUri, {
    httpMethod: 'PUT',
    uploadType: 0, // FileSystemUploadType.BINARY_CONTENT
    headers: { 'Content-Type': contentType },
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Upload failed (${result.status}): ${result.body}`);
  }
  return supabase.storage.from('cook-media').getPublicUrl(path).data?.publicUrl;
}

export async function uploadAvatar(userId, localUri) {
  const rawExt = (localUri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
  const ext = ['jpg', 'jpeg', 'png', 'heic', 'heif'].includes(rawExt) ? rawExt : 'jpg';
  const mime = ext === 'jpg' ? 'jpeg' : ext;
  const path = `${userId}/avatar.${ext}`;
  const url = await uploadToStorage(localUri, path, `image/${mime}`);
  const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId);
  if (error) throw error;
  return url;
}

export async function uploadPhoto(userId, localUri, index) {
  if (!localUri) throw new Error(`Photo ${index + 1} not taken`);
  const rawExt = (localUri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
  const ext = ['jpg', 'jpeg', 'png', 'heic', 'heif'].includes(rawExt) ? rawExt : 'jpg';
  const path = `${userId}/${Date.now()}_${index}.${ext}`;
  return uploadToStorage(localUri, path, `image/${ext}`);
}

export async function uploadVideo(userId, localUri) {
  const path = `${userId}/${Date.now()}_video.mp4`;
  return uploadToStorage(localUri, path, 'video/mp4');
}

export async function submitCook({ userId, dishName, caption, photoUris, videoUri, cookTimeSecs, boosts, baseAmount, eventId, duelId, ingredients, inspiredByCookId, inspiredByUserId, inspiredByDishName }) {
  // Enforce daily 5-cook limit
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { count, error: countError } = await supabase
    .from('cooks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfDay.toISOString());
  if (countError) throw countError;
  if (count >= 5 && !duelId && !eventId) throw new Error("You've reached your 5 cook limit for today. Come back tomorrow!");

  // Enforce one entry per event
  if (eventId) {
    const { count: eventCount, error: eventCountErr } = await supabase
      .from('cooks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('event_id', eventId);
    if (eventCountErr) throw eventCountErr;
    if (eventCount > 0) throw new Error("You've already entered this event.");
  }

  // Upload photos
  const photoUrls = await Promise.all(
    photoUris.map((uri, i) => uploadPhoto(userId, uri, i))
  );

  // Upload video if present
  let videoUrl = null;
  if (videoUri) {
    videoUrl = await uploadVideo(userId, videoUri);
  }

  const { data, error } = await supabase
    .from('cooks')
    .insert({
      user_id: userId,
      dish_name: dishName,
      caption: caption || null,
      photo_urls: photoUrls,
      video_url: videoUrl,
      cook_time_secs: cookTimeSecs,
      boosts,
      xp_earned: baseAmount,
      event_id: eventId || null,
      duel_id: duelId || null,
      ingredients: ingredients || [],
      inspired_by_cook_id: inspiredByCookId || null,
      inspired_by_user_id: inspiredByUserId || null,
    })
    .select()
    .single();
  if (error) throw error;

  // Add XP to profile with retention bonuses; RPC returns actual XP earned
  const { data: xpGained, error: xpErr } = await supabase.rpc('increment_xp', {
    p_user_id: userId,
    base_amount: baseAmount,
    p_event_id: eventId || null,
  });
  if (xpErr) {
    return data;
  }

  // Update cook record with actual XP (may differ from estimate due to bonuses)
  if (xpGained != null) {
    await supabase.from('cooks').update({ xp_earned: xpGained }).eq('id', data.id);
  }

  // Award bonus XP and notify the original poster
  if (inspiredByUserId) {
    try {
      await supabase.rpc('increment_xp', {
        p_user_id: inspiredByUserId,
        base_amount: 25,
        p_apply_bonuses: false,
      });
    } catch {}
    try {
      await supabase.from('notifications').insert({
        user_id: inspiredByUserId,
        type: 'inspired_cook',
        data: {
          cooker_user_id: userId,
          new_dish_name: dishName,
          original_dish_name: inspiredByDishName || null,
          cook_id: data.id,
          xp_earned: 25,
        },
      });
    } catch {}
  }

  if (xpGained != null) {
    return { ...data, xp_earned: xpGained };
  }

  return data;
}

// ─── User cooks ───────────────────────────────────────────────────────────────

export async function getUserCooks(userId) {
  const { data, error } = await supabase
    .from('cooks')
    .select('id, dish_name, cook_time_secs, xp_earned, verified, created_at, event_id, photo_urls, votes (id)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function deleteCook(cookId) {
  const { error } = await supabase.from('cooks').delete().eq('id', cookId);
  if (error) throw error;
}

// ─── Events ───────────────────────────────────────────────────────────────────

export async function getEvents() {
  const { data, error } = await supabase
    .from('events')
    .select(`*, winner_cook:cooks!winner_cook_id(id, dish_name, profiles!user_id(username, rank))`)
    .order('starts_at', { ascending: true });
  if (!error) return data;

  // winner_cook_id column may not exist yet — fall back to plain select
  const { data: d2, error: e2 } = await supabase
    .from('events')
    .select('*')
    .order('starts_at', { ascending: true });
  if (e2) throw e2;
  return d2 ?? [];
}

export async function getEventEntries(eventId) {
  const { data, error } = await supabase
    .from('cooks')
    .select(`
      id, dish_name, photo_urls, created_at,
      profiles!user_id(id, username, rank, rank_tier, avatar_url),
      votes(id)
    `)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).sort((a, b) => (b.votes?.length ?? 0) - (a.votes?.length ?? 0));
}

export async function awardEventWinner(eventId) {
  const { error } = await supabase.rpc('award_event_winner', { p_event_id: eventId });
  if (error) throw error;
}

// ─── Friends ─────────────────────────────────────────────────────────────────

export async function getFriends(userId) {
  const { data: ships, error: sErr } = await supabase
    .from('friendships')
    .select('id, requester_id, addressee_id')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .eq('status', 'accepted');
  if (sErr) throw sErr;
  if (!ships?.length) return [];

  const friendIds = ships.map(f => f.requester_id === userId ? f.addressee_id : f.requester_id);
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, username, rank, rank_tier, level, dishes_cooked, total_votes, avatar_url')
    .in('id', friendIds);
  if (pErr) throw pErr;

  return (profiles || []).map(p => ({
    ...p,
    friendshipId: ships.find(f => f.requester_id === p.id || f.addressee_id === p.id)?.id,
  }));
}

export async function getPendingRequests(userId) {
  const { data: ships, error: sErr } = await supabase
    .from('friendships')
    .select('id, requester_id')
    .eq('addressee_id', userId)
    .eq('status', 'pending');
  if (sErr) throw sErr;
  if (!ships?.length) return [];

  const ids = ships.map(f => f.requester_id);
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, username, rank, rank_tier, level, avatar_url')
    .in('id', ids);
  if (pErr) throw pErr;

  return ships.map(f => ({
    friendshipId: f.id,
    ...((profiles || []).find(p => p.id === f.requester_id) || {}),
  }));
}

export async function searchUsers(query, excludeId) {
  let req = supabase
    .from('profiles')
    .select('id, username, rank, rank_tier, level, avatar_url')
    .ilike('username', `%${query}%`)
    .limit(15);
  if (excludeId) req = req.neq('id', excludeId);
  const { data, error } = await req;
  if (error) throw error;
  return data || [];
}

export async function getFriendshipStatus(myId, theirId) {
  const { data, error } = await supabase
    .from('friendships')
    .select('id, requester_id, status')
    .or(`and(requester_id.eq.${myId},addressee_id.eq.${theirId}),and(requester_id.eq.${theirId},addressee_id.eq.${myId})`)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { status: 'none', friendshipId: null };
  if (data.status === 'accepted') return { status: 'friends', friendshipId: data.id };
  if (data.requester_id === myId) return { status: 'pending_sent', friendshipId: data.id };
  return { status: 'pending_received', friendshipId: data.id };
}

export async function sendFriendRequest(requesterId, addresseeId) {
  const { error } = await supabase
    .from('friendships')
    .insert({ requester_id: requesterId, addressee_id: addresseeId });
  if (error) throw error;
}

export async function acceptFriendRequest(friendshipId) {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', friendshipId);
  if (error) throw error;
}

export async function declineFriendRequest(friendshipId) {
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
  if (error) throw error;
}

export async function removeFriend(friendshipId) {
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
  if (error) throw error;
}

// ─── Notifications ───────────────────────────────────────────────────────────

export async function getEventNotifications(userId) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'event_result')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data || [];
}

export async function getInspiredCookNotifications(userId) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'inspired_cook')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  if (!data?.length) return [];

  const cookerIds = [...new Set(data.map(n => n.data?.cooker_user_id).filter(Boolean))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, rank, avatar_url')
    .in('id', cookerIds);
  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
  return data.map(n => ({ ...n, cooker: profileMap[n.data?.cooker_user_id] || null }));
}

export async function getDuelChallengeNotifications(userId) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'duel_challenge')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  if (!data?.length) return [];
  const challengerIds = [...new Set(data.map(n => n.data?.challenger_user_id).filter(Boolean))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, rank, avatar_url')
    .in('id', challengerIds);
  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
  return data.map(n => ({ ...n, challenger: profileMap[n.data?.challenger_user_id] || null }));
}

export async function markDuelChallengeNotificationsRead(userId) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('type', 'duel_challenge')
    .is('read_at', null);
  if (error) throw error;
}

export async function markInspiredNotificationsRead(userId) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('type', 'inspired_cook')
    .is('read_at', null);
  if (error) throw error;
}

export async function markEventNotificationsRead(userId) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throw error;
}

// ─── Vote activity ────────────────────────────────────────────────────────────

export async function getVoteActivity(userId, limit = 30) {
  const { data: cooks, error: cErr } = await supabase
    .from('cooks')
    .select('id, dish_name')
    .eq('user_id', userId);
  if (cErr) throw cErr;
  if (!cooks?.length) return [];

  const cookIds = cooks.map(c => c.id);
  const cookMap = Object.fromEntries(cooks.map(c => [c.id, c.dish_name]));

  const { data: votes, error: vErr } = await supabase
    .from('votes')
    .select('id, created_at, user_id, cook_id')
    .in('cook_id', cookIds)
    .neq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (vErr) throw vErr;
  if (!votes?.length) return [];

  const voterIds = [...new Set(votes.map(v => v.user_id))];
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, username, rank, avatar_url')
    .in('id', voterIds);
  if (pErr) throw pErr;

  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
  return votes.map(v => ({
    id: v.id,
    created_at: v.created_at,
    voter: profileMap[v.user_id] || { username: 'unknown', rank: null },
    dish_name: cookMap[v.cook_id] || 'a cook',
  }));
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export async function getLeaderboard({ limit = 50 } = {}) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, rank, rank_tier, level, xp, dishes_cooked, total_votes, global_rank, avatar_url')
    .order('xp', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// ─── Duels ───────────────────────────────────────────────────────────────────

export async function sendDuelChallenge(challengerId, opponentId) {
  const { data, error } = await supabase
    .from('duels')
    .insert({ challenger_id: challengerId, opponent_id: opponentId, status: 'pending' })
    .select()
    .single();
  if (error) throw error;
  try {
    await supabase.from('notifications').insert({
      user_id: opponentId,
      type: 'duel_challenge',
      data: { challenger_user_id: challengerId, duel_id: data.id },
    });
  } catch {}
  return data;
}

// Returns all pending + active duels involving userId (one query covers everything)
export async function getMyDuels(userId) {
  const { data, error } = await supabase
    .from('duels')
    .select(`
      id, status, created_at, challenger_id, opponent_id,
      challenger:profiles!challenger_id(id, username, rank, rank_tier, avatar_url),
      opponent:profiles!opponent_id(id, username, rank, rank_tier, avatar_url)
    `)
    .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
    .in('status', ['pending', 'active', 'completed'])
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return data || [];
}

export async function getDuelCooks(duelId) {
  const { data, error } = await supabase
    .from('cooks')
    .select('id, user_id, dish_name, photo_urls, cook_time_secs, created_at')
    .eq('duel_id', duelId);
  if (error) throw error;
  return data || [];
}

// Idempotent — only updates if still active; returns true if a row was changed
export async function completeDuel(duelId) {
  const { data, error } = await supabase
    .from('duels')
    .update({ status: 'completed' })
    .eq('id', duelId)
    .eq('status', 'active')
    .select()
    .single();
  if (error) {
    if (error.code === 'PGRST116') return false; // no rows matched — already completed
    throw error;
  }
  return !!data;
}

export async function awardDuelCompletionXp(userId) {
  const { error } = await supabase.rpc('increment_xp', {
    p_user_id: userId,
    base_amount: 150,
    p_event_id: null,
    p_apply_bonuses: false,
  });
  if (error) throw error;
}

export async function acceptDuel(duelId) {
  const { data, error } = await supabase
    .from('duels')
    .update({ status: 'active' })
    .eq('id', duelId)
    .select()
    .single();
  if (error) throw error;
  if (!data) throw new Error('Update blocked — check duels RLS policy.');
}

export async function cancelDuel(duelId) {
  const { error } = await supabase
    .from('duels')
    .update({ status: 'cancelled' })
    .eq('id', duelId);
  if (error) throw error;
}

export async function declineDuel(duelId) {
  const { data, error } = await supabase
    .from('duels')
    .update({ status: 'declined' })
    .eq('id', duelId)
    .select()
    .single();
  if (error) throw error;
  if (!data) throw new Error('Update blocked — check duels RLS policy.');
}

// ─── Comments ────────────────────────────────────────────────────────────────

export async function getComments(cookId) {
  const { data, error } = await supabase
    .from('comments')
    .select('id, text, created_at, user_id, profiles(id, username, rank, avatar_url)')
    .eq('cook_id', cookId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addComment(cookId, userId, text) {
  const { data, error } = await supabase
    .from('comments')
    .insert({ cook_id: cookId, user_id: userId, text })
    .select('id, text, created_at, user_id, profiles(id, username, rank, avatar_url)')
    .single();
  if (error) throw error;

  try {
    const { data: cook } = await supabase
      .from('cooks')
      .select('user_id, dish_name')
      .eq('id', cookId)
      .single();
    if (cook && cook.user_id !== userId) {
      await supabase.from('notifications').insert({
        user_id: cook.user_id,
        type: 'comment',
        data: {
          commenter_user_id: userId,
          cook_id: cookId,
          dish_name: cook.dish_name,
          comment_text: text.slice(0, 80),
        },
      });
    }
  } catch {}

  return data;
}

export async function getCommentNotifications(userId) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'comment')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  if (!data?.length) return [];

  const commenterIds = [...new Set(data.map(n => n.data?.commenter_user_id).filter(Boolean))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, rank, avatar_url')
    .in('id', commenterIds);
  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
  return data.map(n => ({ ...n, commenter: profileMap[n.data?.commenter_user_id] || null }));
}

export async function markCommentNotificationsRead(userId) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('type', 'comment')
    .is('read_at', null);
  if (error) throw error;
}

export async function deleteAccount(userId) {
  // Deletes the profile row — all user data cascades due to FK constraints.
  // The auth.users row remains but is harmless without a profile.
  // Full removal of auth.users requires a server-side Edge Function (see push notif rundown).
  const { error } = await supabase.from('profiles').delete().eq('id', userId);
  if (error) throw error;
  await supabase.auth.signOut({ scope: 'local' });
}

export async function deleteComment(commentId, userId) {
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', userId);
  if (error) throw error;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
