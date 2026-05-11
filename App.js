import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './src/lib/supabase';
import Navigation from './src/navigation';
import OnboardingFlow from './src/screens/OnboardingFlow';
import AuthScreen from './src/screens/AuthScreen';

export default function App() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Check existing session on launch
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      if (s) {
        const done = await AsyncStorage.getItem(`onboarding_complete_${s.user.id}`);
        setShowOnboarding(done !== 'true');
      }
      setReady(true);
    });

    // Listen for auth state changes (sign in / sign out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s);
      if (s) {
        const done = await AsyncStorage.getItem(`onboarding_complete_${s.user.id}`);
        setShowOnboarding(done !== 'true');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!ready) return null;

  if (!session) return (
    <>
      <AuthScreen />
      <StatusBar style="light" />
    </>
  );

  if (showOnboarding) return (
    <>
      <OnboardingFlow onComplete={() => setShowOnboarding(false)} userId={session.user.id} />
      <StatusBar style="light" />
    </>
  );

  return (
    <>
      <Navigation />
      <StatusBar style="light" />
    </>
  );
}
