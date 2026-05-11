import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Navigation from './src/navigation';
import OnboardingFlow from './src/screens/OnboardingFlow';

export default function App() {
  const [ready, setReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('onboarding_complete').then((val) => {
      setShowOnboarding(val !== 'true');
      setReady(true);
    });
  }, []);

  if (!ready) return null;

  return (
    <>
      {showOnboarding ? (
        <OnboardingFlow onComplete={() => setShowOnboarding(false)} />
      ) : (
        <Navigation />
      )}
      <StatusBar style="light" />
    </>
  );
}
