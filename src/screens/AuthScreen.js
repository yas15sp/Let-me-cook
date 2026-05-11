import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  Animated, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, spacing, typography, borders } from '../theme';

export default function AuthScreen() {
  const [tab, setTab] = useState('signin'); // signin | signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const slideAnim = useRef(new Animated.Value(0)).current;

  const switchTab = (t) => {
    setTab(t);
    setError('');
    Animated.spring(slideAnim, {
      toValue: t === 'signin' ? 0 : 1,
      useNativeDriver: false,
      friction: 8,
    }).start();
  };

  const handleSignIn = async () => {
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) setError(err.message);
  };

  const handleSignUp = async () => {
    if (!email || !password || !username) { setError('Please fill in all fields.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    setLoading(false);
    if (err) setError(err.message);
  };

  const tabIndicatorLeft = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '50%'],
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Halftone decoration */}
      <View style={styles.halftone} pointerEvents="none">
        {Array.from({ length: 48 }).map((_, i) => (
          <View key={i} style={styles.halftoneDot} />
        ))}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoRow}>
            <View style={styles.logoAccent} />
            <Text style={styles.logoText}>LET ME{'\n'}COOK!</Text>
          </View>
          <Text style={styles.tagline}>Compete. Cook. Climb the ranks.</Text>

          {/* Tab switcher */}
          <View style={styles.tabBar}>
            <Animated.View style={[styles.tabIndicator, { left: tabIndicatorLeft }]} />
            <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('signin')} activeOpacity={0.8}>
              <Text style={[styles.tabBtnText, tab === 'signin' && styles.tabBtnTextActive]}>SIGN IN</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('signup')} activeOpacity={0.8}>
              <Text style={[styles.tabBtnText, tab === 'signup' && styles.tabBtnTextActive]}>SIGN UP</Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {tab === 'signup' && (
              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>USERNAME</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="person-outline" size={16} color={colors.inactive} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="your_username"
                    placeholderTextColor={colors.inactive}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>
            )}

            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>EMAIL</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={16} color={colors.inactive} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.inactive}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>PASSWORD</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={16} color={colors.inactive} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.inactive}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword(s => !s)} style={styles.eyeBtn}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={16}
                    color={colors.inactive}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Error */}
            {!!error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={14} color={colors.primary} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnLoading]}
              onPress={tab === 'signin' ? handleSignIn : handleSignUp}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading
                ? <Text style={styles.submitBtnText}>LOADING...</Text>
                : <>
                    <Ionicons name="flame" size={18} color={colors.white} />
                    <Text style={styles.submitBtnText}>
                      {tab === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
                    </Text>
                  </>
              }
            </TouchableOpacity>

            {tab === 'signin' && (
              <TouchableOpacity style={styles.forgotBtn} activeOpacity={0.7}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            )}

            {tab === 'signup' && (
              <Text style={styles.terms}>
                By signing up you agree to our{' '}
                <Text style={styles.termsLink}>Terms of Service</Text>
                {' '}and{' '}
                <Text style={styles.termsLink}>Privacy Policy</Text>.
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.xxl },

  halftone: { position: 'absolute', top: 0, right: 0, width: 200, height: 200, flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 12, opacity: 0.05 },
  halftoneDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },

  logoRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: spacing.sm },
  logoAccent: { width: 7, height: 80, backgroundColor: colors.primary, marginRight: spacing.md },
  logoText: { color: colors.white, fontSize: 52, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider, lineHeight: 54 },
  tagline: { color: colors.inactive, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold, marginBottom: spacing.xl },

  tabBar: { flexDirection: 'row', borderWidth: borders.medium, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: spacing.lg, position: 'relative', overflow: 'hidden' },
  tabIndicator: { position: 'absolute', top: 0, bottom: 0, width: '50%', backgroundColor: colors.primary },
  tabBtn: { flex: 1, paddingVertical: spacing.sm + 2, alignItems: 'center', zIndex: 1 },
  tabBtnText: { color: colors.inactive, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  tabBtnTextActive: { color: colors.white },

  form: { gap: spacing.md },

  inputWrap: { gap: spacing.xs },
  inputLabel: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: borders.thin, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.sm },
  inputIcon: { marginRight: spacing.xs },
  input: { flex: 1, color: colors.white, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold, paddingVertical: spacing.sm + 2 },
  eyeBtn: { padding: spacing.xs },

  errorBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: '#1a0000', borderWidth: borders.thin, borderColor: colors.primary, padding: spacing.sm },
  errorText: { color: colors.primary, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, flex: 1 },

  submitBtn: { backgroundColor: colors.primary, borderWidth: borders.medium, borderColor: '#000', paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.xs },
  submitBtnLoading: { opacity: 0.6 },
  submitBtnText: { color: colors.white, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.black, letterSpacing: typography.letterSpacing.wider },

  forgotBtn: { alignItems: 'center', paddingVertical: spacing.xs },
  forgotText: { color: colors.inactive, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },

  terms: { color: colors.inactive, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold, textAlign: 'center', lineHeight: 18 },
  termsLink: { color: colors.accent, fontWeight: typography.fontWeight.black },
});
