import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { getMyDuels, getDuelCooks } from '../lib/api';
import { colors, spacing, typography, borders } from '../theme';

export default function ActiveDuelBanner() {
  const navigation = useNavigation();
  const [duelInfo, setDuelInfo] = useState(null); // { opponentName, submitted }

  useFocusEffect(useCallback(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setDuelInfo(null); return; }
      const uid = session.user.id;
      try {
        const duels = await getMyDuels(uid);
        const active = duels.find(d => d.status === 'active');
        if (!active) { setDuelInfo(null); return; }
        const isChallenger = active.challenger_id === uid;
        const opp = isChallenger ? active.opponent : active.challenger;
        const cooks = await getDuelCooks(active.id);
        setDuelInfo({
          opponentName: opp?.username ?? '??',
          submitted: cooks.some(c => c.user_id === uid),
        });
      } catch {
        setDuelInfo(null);
      }
    });
  }, []));

  if (!duelInfo) return null;

  return (
    <TouchableOpacity
      style={styles.banner}
      onPress={() => navigation.navigate('Rivals')}
      activeOpacity={0.85}
    >
      <Ionicons name="flash" size={12} color={colors.primary} />
      <Text style={styles.label} numberOfLines={1}>
        DUEL vs @{duelInfo.opponentName}
      </Text>
      {duelInfo.submitted ? (
        <View style={styles.submittedChip}>
          <Ionicons name="checkmark" size={10} color={colors.background} />
          <Text style={styles.submittedText}>COOKED</Text>
        </View>
      ) : (
        <View style={styles.pendingChip}>
          <Text style={styles.pendingText}>COOK NOW</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={12} color={colors.border} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: '#1a0000',
    borderBottomWidth: borders.thin, borderBottomColor: colors.primary,
    paddingHorizontal: spacing.md, paddingVertical: 7,
  },
  label: {
    flex: 1, color: colors.white,
    fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black,
    letterSpacing: typography.letterSpacing.wide,
  },
  pendingChip: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xs, paddingVertical: 2,
  },
  pendingText: {
    color: colors.white, fontSize: 8,
    fontWeight: typography.fontWeight.black, letterSpacing: 1,
  },
  submittedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.success,
    paddingHorizontal: spacing.xs, paddingVertical: 2,
  },
  submittedText: {
    color: colors.background, fontSize: 8,
    fontWeight: typography.fontWeight.black, letterSpacing: 1,
  },
});
