import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { deleteAccount } from '../lib/api';
import { colors, spacing, typography, borders } from '../theme';

const APP_VERSION = '0.1.0';

function SectionHeader({ title }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

function SettingsRow({ icon, label, value, onPress, destructive, chevron = true, right }) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
      disabled={!onPress}
    >
      <Ionicons name={icon} size={18} color={destructive ? colors.primary : colors.inactive} />
      <Text style={[styles.rowLabel, destructive && { color: colors.primary }]}>{label}</Text>
      {right ?? (
        <>
          {value !== undefined && <Text style={styles.rowValue}>{value}</Text>}
          {chevron && onPress && <Ionicons name="chevron-forward" size={14} color={colors.border} />}
        </>
      )}
    </TouchableOpacity>
  );
}

function RowDivider() {
  return <View style={styles.rowDivider} />;
}

export default function SettingsScreen() {
  const navigation = useNavigation();
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUserId(session.user.id);
    });
  }, []);

  // Notification preference placeholders — no-op until push notifs land
  const [notifVotes, setNotifVotes] = useState(true);
  const [notifComments, setNotifComments] = useState(true);
  const [notifDuels, setNotifDuels] = useState(true);
  const [notifEvents, setNotifEvents] = useState(true);

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'SIGN OUT',
        style: 'destructive',
        onPress: async () => {
          try {
            await AsyncStorage.removeItem('@seen_winner_events');
            await supabase.auth.signOut();
          } catch {
            await supabase.auth.signOut({ scope: 'local' });
          }
        },
      },
    ]);
  }

  function NotifToggle({ value, onValueChange }) {
    return (
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.white}
        style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
      />
    );
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>SETTINGS</Text>
          <View style={{ width: 38 }} />
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Account */}
        <SectionHeader title="ACCOUNT" />
        <View style={styles.card}>
          <SettingsRow
            icon="person-outline"
            label="EDIT PROFILE"
            onPress={() => navigation.navigate('EditProfile')}
          />
          <RowDivider />
          <SettingsRow
            icon="share-outline"
            label="SHARE PROFILE"
            onPress={() => Alert.alert('Coming soon', 'Profile sharing is on the way.')}
          />
        </View>

        {/* Notifications */}
        <SectionHeader title="NOTIFICATIONS" />
        <View style={styles.notifNote}>
          <Ionicons name="information-circle-outline" size={14} color={colors.inactive} />
          <Text style={styles.notifNoteText}>Push notifications coming soon — these preferences will apply when enabled</Text>
        </View>
        <View style={styles.card}>
          <SettingsRow
            icon="flame-outline"
            label="VOTES ON MY COOKS"
            right={<NotifToggle value={notifVotes} onValueChange={setNotifVotes} />}
          />
          <RowDivider />
          <SettingsRow
            icon="chatbubble-outline"
            label="COMMENTS"
            right={<NotifToggle value={notifComments} onValueChange={setNotifComments} />}
          />
          <RowDivider />
          <SettingsRow
            icon="flash-outline"
            label="DUEL CHALLENGES"
            right={<NotifToggle value={notifDuels} onValueChange={setNotifDuels} />}
          />
          <RowDivider />
          <SettingsRow
            icon="star-outline"
            label="EVENT RESULTS"
            right={<NotifToggle value={notifEvents} onValueChange={setNotifEvents} />}
          />
        </View>

        {/* Privacy */}
        <SectionHeader title="PRIVACY" />
        <View style={styles.card}>
          <SettingsRow
            icon="eye-outline"
            label="PROFILE VISIBILITY"
            value="PUBLIC"
            onPress={() => Alert.alert('Coming soon', 'Privacy controls are on the way.')}
          />
          <RowDivider />
          <SettingsRow
            icon="shield-checkmark-outline"
            label="DATA & PRIVACY"
            onPress={() => Alert.alert('Coming soon', 'Data controls are on the way.')}
          />
        </View>

        {/* About */}
        <SectionHeader title="ABOUT" />
        <View style={styles.card}>
          <SettingsRow
            icon="code-outline"
            label="VERSION"
            value={APP_VERSION}
            chevron={false}
          />
          <RowDivider />
          <SettingsRow
            icon="bug-outline"
            label="SEND FEEDBACK"
            onPress={() => Alert.alert('Feedback', 'Report issues or ideas at the GitHub repo or via email.')}
          />
        </View>

        {/* Sign out + Delete */}
        <View style={[styles.card, styles.cardDanger]}>
          <SettingsRow
            icon="log-out-outline"
            label="SIGN OUT"
            onPress={handleSignOut}
            destructive
          />
          <RowDivider />
          <SettingsRow
            icon="trash-outline"
            label="DELETE ACCOUNT"
            onPress={() => {
              Alert.alert(
                'Delete Account',
                'This permanently deletes your profile, all your cooks, votes, and stats. This cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'DELETE',
                    style: 'destructive',
                    onPress: () => {
                      Alert.alert(
                        'Are you absolutely sure?',
                        'Type your username to confirm — all data will be gone forever.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'YES, DELETE EVERYTHING',
                            style: 'destructive',
                            onPress: async () => {
                              if (!userId) return;
                              try {
                                await deleteAccount(userId);
                              } catch (e) {
                                Alert.alert('Error', e?.message ?? 'Could not delete account. Try again.');
                              }
                            },
                          },
                        ]
                      );
                    },
                  },
                ]
              );
            }}
            destructive
          />
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safeTop: { backgroundColor: colors.primary },

  topBar: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    paddingBottom: spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: borders.medium, borderBottomColor: '#000',
  },
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: {
    color: colors.white, fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider,
  },

  scroll: { paddingHorizontal: spacing.md, paddingTop: spacing.md },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.inactive, fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: '#1f1f1f' },

  card: {
    backgroundColor: colors.surface,
    borderWidth: borders.thin, borderColor: colors.border,
  },
  cardDanger: { marginTop: spacing.lg, borderColor: '#300000' },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  rowLabel: {
    flex: 1, color: colors.inactive,
    fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.black,
    letterSpacing: typography.letterSpacing.wider,
  },
  rowValue: {
    color: colors.border, fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold, letterSpacing: typography.letterSpacing.wide,
  },
  rowDivider: { height: borders.thin, backgroundColor: '#1a1a1a' },

  notifNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs,
    marginBottom: spacing.sm, paddingHorizontal: 2,
  },
  notifNoteText: {
    flex: 1, color: '#444', fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold, lineHeight: 16,
  },
});
