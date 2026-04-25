import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';

import { getClientEnv } from '@/config/env';
import { supabase } from '@/config/supabase';

import {
  appFlowReducer,
  getActiveRoute,
  initialAppFlowState,
  type ActiveRoute,
  type AuthScreen,
  type OnboardingStep,
} from '@/context/appFlow';

type AuthContextValue = {
  activeRoute: ActiveRoute;
  onboardingStep: OnboardingStep;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  authError: string | null;
  authScreen: AuthScreen;
  nextOnboardingStep: () => void;
  skipOnboarding: () => void;
  showLogin: () => void;
  showSignUp: () => void;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const AUTH_INIT_TIMEOUT_MS = 8000;
const AUTH_CALLBACK_PATH = 'auth/callback';
const APP_SCHEME = 'tindai';
const env = getClientEnv();

WebBrowser.maybeCompleteAuthSession();

type GoogleExchangeSuccess = {
  session: {
    accessToken: string;
    refreshToken: string;
  };
};

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appFlowReducer, initialAppFlowState);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [googleAuthRequest, , promptGoogleSignIn] = Google.useIdTokenAuthRequest(
    {
      selectAccount: true,
      webClientId: env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? undefined,
      iosClientId: env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? undefined,
      androidClientId: env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? undefined,
    },
    {
      scheme: APP_SCHEME,
      path: AUTH_CALLBACK_PATH,
      native: `${APP_SCHEME}://${AUTH_CALLBACK_PATH}`,
    },
  );

  useEffect(() => {
    let mounted = true;

    const initializeSession = async () => {
      try {
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          AUTH_INIT_TIMEOUT_MS,
          'Authentication startup timed out. Check internet and Supabase settings.',
        );

        if (!mounted) {
          return;
        }

        if (error) {
          setAuthError(error.message);
          dispatch({ type: 'signOut' });
          return;
        }

        dispatch({ type: data.session ? 'signIn' : 'signOut' });
      } catch (error) {
        if (!mounted) {
          return;
        }

        setAuthError(error instanceof Error ? error.message : 'Failed to initialize authentication session.');
        dispatch({ type: 'signOut' });
      } finally {
        if (mounted) {
          setIsAuthLoading(false);
        }
      }
    };

    void initializeSession();

    const { data: authSubscription } = supabase.auth.onAuthStateChange((_event, session) => {
      dispatch({ type: session ? 'signIn' : 'signOut' });
    });

    return () => {
      mounted = false;
      authSubscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      activeRoute: getActiveRoute(state),
      onboardingStep: state.onboardingStep,
      isAuthenticated: state.isAuthenticated,
      isAuthLoading,
      authError,
      authScreen: state.authScreen,
      nextOnboardingStep: () => dispatch({ type: 'advanceOnboarding' }),
      skipOnboarding: () => dispatch({ type: 'skipOnboarding' }),
      showLogin: () => {
        setAuthError(null);
        dispatch({ type: 'showLogin' });
      },
      showSignUp: () => {
        setAuthError(null);
        dispatch({ type: 'showSignUp' });
      },
      clearAuthError: () => setAuthError(null),
      signInWithGoogle: async () => {
        setAuthError(null);
        setIsAuthLoading(true);

        try {
          if (!env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID && !env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID) {
            setAuthError('Missing Google OAuth client ID. Set EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID.');
            return;
          }

          if (!googleAuthRequest) {
            setAuthError('Google sign-in is still loading. Try again.');
            return;
          }

          const oauthResult = await promptGoogleSignIn();

          if (oauthResult.type !== 'success') {
            setAuthError('Google sign-in was cancelled.');
            return;
          }

          const idToken = oauthResult.params.id_token;
          if (!idToken) {
            setAuthError('Google did not return an ID token.');
            return;
          }

          const exchangeResponse = await fetch(`${env.EXPO_PUBLIC_API_BASE_URL}/api/v1/auth/google/exchange`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ idToken }),
          });

          if (!exchangeResponse.ok) {
            setAuthError('Google token exchange failed.');
            return;
          }

          const payload = (await exchangeResponse.json()) as GoogleExchangeSuccess;
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: payload.session.accessToken,
            refresh_token: payload.session.refreshToken,
          });

          if (sessionError) {
            setAuthError(sessionError.message);
          }
        } finally {
          setIsAuthLoading(false);
        }
      },
      signOut: async () => {
        setAuthError(null);
        await supabase.auth.signOut();
        dispatch({ type: 'signOut' });
      },
    }),
    [authError, googleAuthRequest, isAuthLoading, promptGoogleSignIn, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
