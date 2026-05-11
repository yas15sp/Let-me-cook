import { supabase } from './supabase';

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
  const { data, error } = await supabase
    .from('cooks')
    .select(`
      id,
      dish_name,
      photo_urls,
      video_url,
      cook_time_secs,
      boosts,
      xp_earned,
      verified,
      created_at,
      profiles (
        id,
        username,
        rank,
        level
      ),
      votes (id, user_id)
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data;
}

export async function getCookById(cookId) {
  const { data, error } = await supabase
    .from('cooks')
    .select(`
      *,
      profiles (id, username, rank, level),
      votes (id, user_id)
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

export async function uploadPhoto(userId, localUri, index) {
  const ext = localUri.split('.').pop() || 'jpg';
  const path = `${userId}/${Date.now()}_${index}.${ext}`;

  const response = await fetch(localUri);
  const blob = await response.blob();

  const { error } = await supabase.storage
    .from('cook-media')
    .upload(path, blob, { contentType: `image/${ext}` });
  if (error) throw error;

  const { data } = supabase.storage.from('cook-media').getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadVideo(userId, localUri) {
  const path = `${userId}/${Date.now()}_video.mp4`;

  const response = await fetch(localUri);
  const blob = await response.blob();

  const { error } = await supabase.storage
    .from('cook-media')
    .upload(path, blob, { contentType: 'video/mp4' });
  if (error) throw error;

  const { data } = supabase.storage.from('cook-media').getPublicUrl(path);
  return data.publicUrl;
}

export async function submitCook({ userId, dishName, photoUris, videoUri, cookTimeSecs, boosts, xpEarned, eventId }) {
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
      photo_urls: photoUrls,
      video_url: videoUrl,
      cook_time_secs: cookTimeSecs,
      boosts,
      xp_earned: xpEarned,
      event_id: eventId || null,
    })
    .select()
    .single();
  if (error) throw error;

  // Add XP to profile
  await supabase.rpc('increment_xp', { user_id: userId, amount: xpEarned });

  return data;
}

// ─── Events ───────────────────────────────────────────────────────────────────

export async function getEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return data;
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
