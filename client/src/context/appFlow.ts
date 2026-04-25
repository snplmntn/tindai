import type { LocalAuthMode, PermissionStatus } from '@/features/local-db/types';

export type AuthScreen = 'login' | 'signUp';

export type AppFlowState = {
  onboardingCompleted: boolean;
  authMode: LocalAuthMode;
  authScreen: AuthScreen;
  isAuthScreenVisible: boolean;
  isAuthenticated: boolean;
  permissions: {
    microphone: PermissionStatus;
    storage: PermissionStatus;
  };
  tutorialShown: boolean;
};

export type AppFlowAction =
  | { type: 'hydrate'; state: Partial<AppFlowState> }
  | { type: 'chooseGuestMode' }
  | { type: 'showLogin' }
  | { type: 'showSignUp' }
  | { type: 'closeAuth' }
  | { type: 'completeOnboarding' }
  | { type: 'setMicrophonePermission'; status: PermissionStatus }
  | { type: 'setStoragePermission'; status: PermissionStatus }
  | { type: 'markTutorialShown' }
  | { type: 'signIn' }
  | { type: 'signOut' };

export type ActiveRoute =
  | { kind: 'authChoice' }
  | { kind: 'auth'; screen: AuthScreen }
  | { kind: 'permissions' }
  | { kind: 'tabs' };

export const initialAppFlowState: AppFlowState = {
  onboardingCompleted: false,
  authMode: null,
  authScreen: 'login',
  isAuthScreenVisible: false,
  isAuthenticated: false,
  permissions: {
    microphone: 'pending',
    storage: 'pending',
  },
  tutorialShown: false,
};

export function appFlowReducer(state: AppFlowState, action: AppFlowAction): AppFlowState {
  const normalizedState: AppFlowState = {
    ...state,
    permissions: {
      ...initialAppFlowState.permissions,
      ...(state.permissions ?? {}),
    },
  };

  switch (action.type) {
    case 'hydrate':
      return {
        ...normalizedState,
        ...action.state,
        permissions: {
          ...normalizedState.permissions,
          ...action.state.permissions,
        },
      };
    case 'chooseGuestMode':
      return {
        ...normalizedState,
        authMode: 'guest',
        isAuthScreenVisible: false,
      };
    case 'showLogin':
      return {
        ...normalizedState,
        authMode: 'account',
        authScreen: 'login',
        isAuthScreenVisible: true,
      };
    case 'showSignUp':
      return {
        ...normalizedState,
        authMode: 'account',
        authScreen: 'signUp',
        isAuthScreenVisible: true,
      };
    case 'closeAuth':
      return {
        ...normalizedState,
        authMode: normalizedState.isAuthenticated ? 'account' : null,
        isAuthScreenVisible: false,
      };
    case 'completeOnboarding':
      return {
        ...normalizedState,
        onboardingCompleted: true,
      };
    case 'setMicrophonePermission':
      return {
        ...normalizedState,
        permissions: {
          ...normalizedState.permissions,
          microphone: action.status,
        },
      };
    case 'setStoragePermission':
      return {
        ...normalizedState,
        permissions: {
          ...normalizedState.permissions,
          storage: action.status,
        },
      };
    case 'markTutorialShown':
      return {
        ...normalizedState,
        tutorialShown: true,
      };
    case 'signIn':
      return {
        ...normalizedState,
        authMode: 'account',
        isAuthScreenVisible: false,
        isAuthenticated: true,
      };
    case 'signOut':
      return {
        ...normalizedState,
        authMode: 'guest',
        isAuthScreenVisible: false,
        isAuthenticated: false,
      };
    default:
      return normalizedState;
  }
}

export function getActiveRoute(state: AppFlowState): ActiveRoute {
  if (state.isAuthScreenVisible) {
    return {
      kind: 'auth',
      screen: state.authScreen,
    };
  }

  if (!state.onboardingCompleted) {
    if (state.authMode === null) {
      return {
        kind: 'authChoice',
      };
    }

    return {
      kind: 'permissions',
    };
  }

  return {
    kind: 'tabs',
  };
}
