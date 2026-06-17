import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { getProfile, updateProfile, uploadAvatar } from '../lib/api';
import { colors, spacing, typography, borders } from '../theme';

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const [userId, setUserId] = useState(null);
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      const uid = session.user.id;
      setUserId(uid);
      getProfile(uid).then(p => {
        setUsername(p.username ?? '');
        setAvatarUrl(p.avatar_url ?? null);
        setLoading(false);
      }).catch(() => setLoading(false));
    });
  }, []);

  async function handlePickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to change your avatar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    setUploadingAvatar(true);
    try {
      const url = await uploadAvatar(userId, result.assets[0].uri);
      setAvatarUrl(url);
    } catch (e) {
      Alert.alert('Upload failed', e?.message ?? 'Could not update avatar.');
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSave() {
    const trimmed = username.trim();
    if (!trimmed) { Alert.alert('Username required', 'Username cannot be empty.'); return; }
    if (trimmed.length < 3) { Alert.alert('Too short', 'Username must be at least 3 characters.'); return; }
    setSaving(true);
    try {
      await updateProfile(userId, { username: trimmed });
      navigation.goBack();
    } catch (e) {
      const msg = e?.message ?? '';
      if (msg.includes('unique') || msg.includes('duplicate')) {
        Alert.alert('Username taken', 'That username is already in use. Try another.');
      } else {
        Alert.alert('Save failed', msg || 'Could not save changes. Try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  const initials = (username || '??').slice(0, 2).toUpperCase();

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>EDIT PROFILE</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving || uploadingAvatar} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            {saving
              ? <ActivityIndicator size="small" color={colors.white} />
              : <Text style={styles.saveBtn}>SAVE</Text>
            }
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>
      ) : (
        <View style={styles.content}>
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <TouchableOpacity style={styles.avatarWrap} onPress={handlePickAvatar} disabled={uploadingAvatar} activeOpacity={0.8}>
              <View style={styles.avatar}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : (
                  <Text style={styles.avatarInitials}>{initials}</Text>
                )}
                <View style={styles.avatarOverlay}>
                  {uploadingAvatar
                    ? <ActivityIndicator size="small" color={colors.white} />
                    : <Ionicons name="camera" size={18} color={colors.white} />
                  }
                </View>
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarHint}>TAP TO CHANGE PHOTO</Text>
          </View>

          {/* Username */}
          <Text style={styles.fieldLabel}>USERNAME</Text>
          <TextInput
            style={styles.fieldInput}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={24}
            placeholder="your_username"
            placeholderTextColor={colors.inactive}
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />
          <Text style={styles.fieldHint}>{username.length}/24 · letters, numbers and underscores</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safeTop: { backgroundColor: colors.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  topBar: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: borders.medium, borderBottomColor: '#000',
  },
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: {
    color: colors.white, fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider,
  },
  saveBtn: {
    color: colors.accent, fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider,
    paddingHorizontal: spacing.xs,
  },

  content: { paddingHorizontal: spacing.md, paddingTop: spacing.xl },

  avatarSection: { alignItems: 'center', marginBottom: spacing.xl },
  avatarWrap: { marginBottom: spacing.sm },
  avatar: {
    width: 96, height: 96,
    borderWidth: borders.medium, borderColor: colors.accent,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarInitials: {
    color: colors.white, fontSize: typography.fontSize.xxl, fontWeight: typography.fontWeight.black,
  },
  avatarOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 34,
    backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center',
  },
  avatarHint: {
    color: colors.inactive, fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider,
  },

  fieldLabel: {
    color: colors.inactive, fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider,
    marginBottom: spacing.xs,
  },
  fieldInput: {
    backgroundColor: colors.surface, borderWidth: borders.thin, borderColor: colors.border,
    color: colors.white, fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wide,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  fieldHint: {
    color: '#333', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold,
  },
});
