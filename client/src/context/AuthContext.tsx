import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import { Linking, Platform } from "react-native";

import { supabase } from "@/config/supabase";
import {
  appFlowReducer,
  getActiveRoute,
  initialAppFlowState,
  type ActiveRoute,
  type AppFlowState,
  type AuthScreen,
} from "@/context/appFlow";
import { getLocalDatabase } from "@/features/local-db/database";
import { runLocalMigrations } from "@/features/local-db/migrations";
import { AppStateRepository } from "@/features/local-db/repositories";
import type {
  LocalAuthMode,
  PermissionStatus,
} from "@/features/local-db/types";

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
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  authError: string | null;
  authScreen: AuthScreen;
  authMode: LocalAuthMode;
  microphonePermission: PermissionStatus;
  storagePermission: PermissionStatus;
  onboardingCompleted: boolean;
  tutorialShown: boolean;
  chooseGuestMode: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  showLogin: () => Promise<void>;
  showSignUp: () => Promise<void>;
  closeAuth: () => Promise<void>;
  clearAuthError: () => void;
  signInWithEmail: (input: SignInWithEmailInput) => Promise<void>;
  signUpWithEmail: (input: SignUpWithEmailInput) => Promise<void>;
  signOut: () => Promise<void>;
  requestMicrophonePermission: () => Promise<PermissionStatus>;
  requestStoragePermission: () => Promise<PermissionStatus>;
  markTutorialShown: () => Promise<void>;
  openDeviceSettings: () => Promise<void>;
};

type SpeechRecognitionModuleRuntime = {
  ExpoSpeechRecognitionModule: {
    requestPermissionsAsync?: () => Promise<{
      granted: boolean;
      canAskAgain?: boolean;
    }>;
    getPermissionsAsync?: () => Promise<{
      granted: boolean;
      canAskAgain?: boolean;
    }>;
  };
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const AUTH_INIT_TIMEOUT_MS = 8000;
const AUTH_LOADING_WATCHDOG_MS = 12000;

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
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

async function createAppStateRepository() {
  const database = await getLocalDatabase();
  await runLocalMigrations(database);
  return new AppStateRepository(database);
}

function loadSpeechRecognitionRuntime(): SpeechRecognitionModuleRuntime | null {
  try {
    const runtime =
      require("expo-speech-recognition") as SpeechRecognitionModuleRuntime;

    if (!runtime?.ExpoSpeechRecognitionModule?.requestPermissionsAsync) {
      return null;
    }

    return runtime;
  } catch {
    return null;
  }
}

function mapGrantedToPermissionStatus(granted: boolean): PermissionStatus {
  return granted ? "granted" : "denied";
}

function buildHydratedState(params: {
  onboardingCompleted: boolean;
  authMode: LocalAuthMode;
  microphonePermission: PermissionStatus;
  storagePermission: PermissionStatus;
  tutorialShown: boolean;
  isAuthenticated: boolean;
}): AppFlowState {
  return {
    ...initialAppFlowState,
    onboardingCompleted: params.onboardingCompleted,
    authMode: params.authMode,
    isAuthenticated: params.isAuthenticated,
    permissions: {
      microphone: params.microphonePermission,
      storage: params.storagePermission,
    },
    tutorialShown: params.tutorialShown,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appFlowReducer, initialAppFlowState);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const persistState = async (patch: {
    onboardingCompleted?: boolean;
    authMode?: LocalAuthMode;
    microphonePermission?: PermissionStatus;
    storagePermission?: PermissionStatus;
    tutorialShown?: boolean;
  }) => {
    const repository = await createAppStateRepository();
    await repository.updateState(patch);
  };

  useEffect(() => {
    let mounted = true;

    const initializeSession = async () => {
      try {
        const repository = await createAppStateRepository();
        const persisted = await repository.getOrCreateState();
        const sessionResult = await withTimeout(
          supabase.auth.getSession(),
          AUTH_INIT_TIMEOUT_MS,
          "Authentication startup timed out. Check internet and Supabase settings.",
        );

        if (!mounted) {
          return;
        }

        if (sessionResult.error) {
          setAuthError(sessionResult.error.message);
        }

        dispatch({
          type: "hydrate",
          state: buildHydratedState({
            onboardingCompleted: persisted.onboardingCompleted,
            authMode: persisted.authMode,
            microphonePermission: persisted.microphonePermission,
            storagePermission: persisted.storagePermission,
            tutorialShown: persisted.tutorialShown,
            isAuthenticated: Boolean(sessionResult.data.session),
          }),
        });
      } catch (error) {
        if (!mounted) {
          return;
        }

        setAuthError(
          error instanceof Error
            ? error.message
            : "Failed to initialize authentication session.",
        );
      } finally {
        if (mounted) {
          setIsAuthLoading(false);
        }
      }
    };

    void initializeSession();

    const { data: authSubscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        dispatch({ type: session ? "signIn" : "signOut" });
      },
    );

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
      setAuthError(
        (current) =>
          current ?? "Startup took too long. Continuing in offline mode.",
      );
      setIsAuthLoading(false);
    }, AUTH_LOADING_WATCHDOG_MS);

    return () => clearTimeout(watchdog);
  }, [isAuthLoading]);

  const value = useMemo<AuthContextValue>(() => {
    const permissions = {
      ...initialAppFlowState.permissions,
      ...(state.permissions ?? {}),
    };

    return {
      activeRoute: getActiveRoute(state),
      isAuthenticated: state.isAuthenticated,
      isAuthLoading,
      authError,
      authScreen: state.authScreen,
      authMode: state.authMode,
      microphonePermission: permissions.microphone,
      storagePermission: permissions.storage,
      onboardingCompleted: state.onboardingCompleted,
      tutorialShown: state.tutorialShown,
      chooseGuestMode: async () => {
        setAuthError(null);
        dispatch({ type: "chooseGuestMode" });
        await persistState({
          authMode: "guest",
        });
      },
      completeOnboarding: async () => {
        dispatch({ type: "completeOnboarding" });
        await persistState({
          onboardingCompleted: true,
        });
      },
      showLogin: async () => {
        setAuthError(null);
        dispatch({ type: "showLogin" });
        await persistState({
          authMode: "account",
        });
      },
      showSignUp: async () => {
        setAuthError(null);
        dispatch({ type: "showSignUp" });
        await persistState({
          authMode: "account",
        });
      },
      closeAuth: async () => {
        setAuthError(null);
        dispatch({ type: "closeAuth" });
        await persistState({
          authMode: state.isAuthenticated ? "account" : null,
        });
      },
      clearAuthError: () => setAuthError(null),
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
            return;
          }

          await persistState({
            authMode: "account",
          });
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

          if (!data.session) {
            const { error: signInError } =
              await supabase.auth.signInWithPassword({
                email: normalizedEmail,
                password,
              });

            if (signInError) {
              const lowerMessage = signInError.message.toLowerCase();
              if (
                lowerMessage.includes("email not confirmed") ||
                lowerMessage.includes("email not verified")
              ) {
                setAuthError(
                  "Account created. Email confirmation is enabled in Supabase Auth, so no session was issued. Verify the email or disable email confirmation for hackathon mode.",
                );
                return;
              }

              setAuthError(signInError.message);
              return;
            }
          }

          await persistState({
            authMode: "account",
          });
        } finally {
          setIsAuthLoading(false);
        }
      },
      signOut: async () => {
        setAuthError(null);
        await supabase.auth.signOut();

        await persistState({
          authMode: "guest",
        });
      },
      requestMicrophonePermission: async () => {
        const speechRuntime = loadSpeechRecognitionRuntime();
        const speechModule = speechRuntime?.ExpoSpeechRecognitionModule;

        if (!speechModule?.requestPermissionsAsync) {
          dispatch({ type: "setMicrophonePermission", status: "denied" });
          await persistState({
            microphonePermission: "denied",
          });
          return "denied";
        }

        const response = speechModule.getPermissionsAsync
          ? await speechModule.getPermissionsAsync()
          : await speechModule.requestPermissionsAsync();
        const nextStatus =
          response.granted || response.canAskAgain === false
            ? mapGrantedToPermissionStatus(response.granted)
            : mapGrantedToPermissionStatus(
                (await speechModule.requestPermissionsAsync()).granted,
              );

        dispatch({ type: "setMicrophonePermission", status: nextStatus });
        await persistState({
          microphonePermission: nextStatus,
        });
        return nextStatus;
      },
      requestStoragePermission: async () => {
        const nextStatus: PermissionStatus =
          Platform.OS === "android" ? "granted" : "granted";
        dispatch({ type: "setStoragePermission", status: nextStatus });
        await persistState({
          storagePermission: nextStatus,
        });
        return nextStatus;
      },
      markTutorialShown: async () => {
        dispatch({ type: "markTutorialShown" });
        await persistState({
          tutorialShown: true,
        });
      },
      openDeviceSettings: async () => {
        await Linking.openSettings();
      },
    };
  }, [authError, isAuthLoading, state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
