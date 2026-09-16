import React, { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SignInHero } from '@/components/SignInHero';
import { useAuth } from '@/context/AuthContext';

/**
 * Full-screen sign-in route — pushed by gated guest actions (trade / like / comment) with
 * ?back=1 so that after auth the stack unwinds to wherever the user was.
 * Guests browsing inline (Portfolio/Profile tabs) render SignInHero directly instead.
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { back } = useLocalSearchParams<{ back?: string }>();

  const dismiss = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  // once signed in (login pops back to here), get out of the way — back to the origin
  useEffect(() => {
    if (user) dismiss();
  }, [user]);

  return <SignInHero emailHref={back === '1' ? '/login?back=1' : '/login'} onClose={dismiss} />;
}
