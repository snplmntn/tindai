import Constants from 'expo-constants';
import { createContext, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import { NativeModules } from 'react-native';

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

type SignInWithEmailInput = {
  email: string;
  password: string;
};

type SignUpWithEmailInput = {
  fullName: string;
  storeName: string;
  email: string;
  password: string;
};

type AuthContextValue = {
  activeRoute: ActiveRoute;
  hasCompletedOnboarding: boolean;
  onboardingStep: OnboardingStep;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  authError: string | null;
  authScreen: AuthScreen;
  isGoogleSignInEnabled: boolean;
  googleSignInHint: string | null;
  nextOnboardingStep: () => void;
  skipOnboarding: () => void;
  showLogin: () => void;
  showSignUp: () => void;
  closeAuth: () => void;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (input: SignInWithEmailInput) => Promise<void>;
  signUpWithEmail: (input: SignUpWithEmailInput) => Promise<void>;
  signOut: () => Promise<void>;
};

type GoogleExchangeSuccess = {
  session: {
    accessToken: string;
    refreshToken: string;
  };
};

type GoogleSigninModule = typeof import('@react-native-google-signin/google-signin');

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const AUTH_INIT_TIMEOUT_MS = 8000;
const AUTH_LOADING_WATCHDOG_MS = 12000;
const env = getClientEnv();
let cachedGoogleSigninModule: GoogleSigninModule | null = null;

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

function getGoogleSignInAvailability() {
  if (!NativeModules.RNGoogleSignin) {
    return {
      enabled: false,
      hint: 'Google sign-in needs a development build. Expo Go does not include this native module.',
    };
  }

  if (Constants.appOwnership === 'expo') {
    return {
      enabled: false,
      hint: 'Google sign-in requires an Android development build. Expo Go is not supported for this flow.',
    };
  }

  if (!env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID) {
    return {
      enabled: false,
      hint: 'Google sign-in is disabled until EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID is set.',
    };
  }

  return {
    enabled: true,
    hint: env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
      ? null
      : 'Google sign-in works best with EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID for ID token exchange.',
  };
}

function loadGoogleSigninModule() {
  if (cachedGoogleSigninModule) {
    return cachedGoogleSigninModule;
  }

  try {
    cachedGoogleSigninModule = require('@react-native-google-signin/google-signin') as GoogleSigninModule;
    return cachedGoogleSigninModule;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appFlowReducer, initialAppFlowState);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const googleAvailability = useMemo(getGoogleSignInAvailability, []);

  useEffect(() => {
    if (!googleAvailability.enabled) {
      return;
    }

    const googleModule = loadGoogleSigninModule();
    if (!googleModule) {
      return;
    }

    googleModule.GoogleSignin.configure({
      webClientId: env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? undefined,
      iosClientId: env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? undefined,
    });
  }, [googleAvailability.enabled]);

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

  useEffect(() => {
    if (!isAuthLoading) {
      return;
    }

    const watchdog = setTimeout(() => {
      setAuthError((current) => current ?? 'Startup took too long. Continuing in offline mode.');
      setIsAuthLoading(false);
    }, AUTH_LOADING_WATCHDOG_MS);

    return () => clearTimeout(watchdog);
  }, [isAuthLoading]);

  const value = useMemo<AuthContextValue>(
    () => ({
      activeRoute: getActiveRoute(state),
      hasCompletedOnboarding: state.hasCompletedOnboarding,
      onboardingStep: state.onboardingStep,
      isAuthenticated: state.isAuthenticated,
      isAuthLoading,
      authError,
      authScreen: state.authScreen,
      isGoogleSignInEnabled: googleAvailability.enabled,
      googleSignInHint: googleAvailability.hint,
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
      closeAuth: () => {
        setAuthError(null);
        dispatch({ type: 'closeAuth' });
      },
      clearAuthError: () => setAuthError(null),
      signInWithGoogle: async () => {
        setAuthError(null);
        setIsAuthLoading(true);

        try {
          if (!googleAvailability.enabled) {
            setAuthError(googleAvailability.hint ?? 'Google sign-in is unavailable.');
            return;
          }

          const googleModule = loadGoogleSigninModule();
          if (!googleModule) {
            setAuthError('Google sign-in module is unavailable in this build.');
            return;
          }

          await googleModule.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

          const signInResult = await googleModule.GoogleSignin.signIn();
          if (googleModule.isCancelledResponse(signInResult)) {
            setAuthError('Google sign-in was cancelled.');
            return;
          }

          const idToken = signInResult.data.idToken;
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

          const exchangePayload = (await exchangeResponse.json()) as
            | GoogleExchangeSuccess
            | {
                message?: string;
              };

          if (!exchangeResponse.ok || !('session' in exchangePayload)) {
            const errorMessage = 'message' in exchangePayload ? exchangePayload.message : undefined;
            setAuthError(errorMessage ?? 'Google token exchange failed.');
            return;
          }

          const { error: sessionError } = await supabase.auth.setSession({
            access_token: exchangePayload.session.accessToken,
            refresh_token: exchangePayload.session.refreshToken,
          });

          if (sessionError) {
            setAuthError(sessionError.message);
          }
        } catch (error) {
          const googleModule = loadGoogleSigninModule();
          if (googleModule?.isErrorWithCode(error)) {
            if (error.code === googleModule.statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
              setAuthError('Google Play Services is not available on this device.');
              return;
            }
            if (error.code === googleModule.statusCodes.IN_PROGRESS) {
              setAuthError('Google sign-in is already in progress.');
              return;
            }
          }

          setAuthError(error instanceof Error ? error.message : 'Google sign-in failed.');
        } finally {
          setIsAuthLoading(false);
        }
      },
      signInWithEmail: async ({ email, password }) => {
        setAuthError(null);
        setIsAuthLoading(true);

        try {
          const { error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

          if (error) {
            setAuthError(error.message);
          }
        } finally {
          setIsAuthLoading(false);
        }
      },
      signUpWithEmail: async ({ fullName, storeName, email, password }) => {
        setAuthError(null);
        setIsAuthLoading(true);

        try {
          const normalizedFullName = fullName.trim();
          const normalizedStoreName = storeName.trim();
          const normalizedEmail = email.trim();
          const { data, error } = await supabase.auth.signUp({
            email: normalizedEmail,
            password,
            options: {
              data: {
                full_name: normalizedFullName,
                name: normalizedFullName,
                store_name: normalizedStoreName,
              },
            },
          });

          if (error) {
            setAuthError(error.message);
            return;
          }

          if (data.session) {
            return;
          }

          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });

          if (!signInError) {
            return;
          }

          const lowerMessage = signInError.message.toLowerCase();
          if (lowerMessage.includes('email not confirmed') || lowerMessage.includes('email not verified')) {
            setAuthError(
              'Account created. Email confirmation is enabled in Supabase Auth, so no session was issued. Verify the email or disable email confirmation for hackathon mode.',
            );
            return;
          }

          setAuthError(signInError.message);
        } finally {
          setIsAuthLoading(false);
        }
      },
      signOut: async () => {
        setAuthError(null);
        await supabase.auth.signOut();

        if (googleAvailability.enabled) {
          try {
            const googleModule = loadGoogleSigninModule();
            if (googleModule) {
              await googleModule.GoogleSignin.signOut();
            }
          } catch {
            // Do not block app sign-out if Google session cleanup fails.
          }
        }

        dispatch({ type: 'signOut' });
      },
    }),
    [authError, googleAvailability, isAuthLoading, state],
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
