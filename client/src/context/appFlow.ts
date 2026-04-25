export type AuthScreen = 'login' | 'signUp';
export type OnboardingStep = 1 | 2 | 3;

export type AppFlowState = {
  hasCompletedOnboarding: boolean;
  onboardingStep: OnboardingStep;
  authScreen: AuthScreen;
  isAuthScreenVisible: boolean;
  isAuthenticated: boolean;
};

export type AppFlowAction =
  | { type: 'advanceOnboarding' }
  | { type: 'skipOnboarding' }
  | { type: 'showLogin' }
  | { type: 'showSignUp' }
  | { type: 'closeAuth' }
  | { type: 'signIn' }
  | { type: 'signOut' };

export type ActiveRoute =
  | { kind: 'onboarding'; step: OnboardingStep }
  | { kind: 'auth'; screen: AuthScreen }
  | { kind: 'tabs' };

export const initialAppFlowState: AppFlowState = {
  hasCompletedOnboarding: false,
  onboardingStep: 1,
  authScreen: 'login',
  isAuthScreenVisible: false,
  isAuthenticated: false,
};

export function appFlowReducer(state: AppFlowState, action: AppFlowAction): AppFlowState {
  switch (action.type) {
    case 'advanceOnboarding':
      if (state.hasCompletedOnboarding) {
        return state;
      }

      if (state.onboardingStep === 3) {
        return {
          ...state,
          hasCompletedOnboarding: true,
        };
      }

      return {
        ...state,
        onboardingStep: (state.onboardingStep + 1) as OnboardingStep,
      };
    case 'skipOnboarding':
      return {
        ...state,
        hasCompletedOnboarding: true,
      };
    case 'showLogin':
      return {
        ...state,
        authScreen: 'login',
        isAuthScreenVisible: true,
      };
    case 'showSignUp':
      return {
        ...state,
        authScreen: 'signUp',
        isAuthScreenVisible: true,
      };
    case 'closeAuth':
      return {
        ...state,
        isAuthScreenVisible: false,
      };
    case 'signIn':
      return {
        ...state,
        hasCompletedOnboarding: true,
        isAuthScreenVisible: false,
        isAuthenticated: true,
      };
    case 'signOut':
      return {
        ...state,
        isAuthScreenVisible: false,
        isAuthenticated: false,
      };
    default:
      return state;
  }
}

export function getActiveRoute(state: AppFlowState): ActiveRoute {
  if (state.isAuthScreenVisible) {
    return {
      kind: 'auth',
      screen: state.authScreen,
    };
  }

  return {
    kind: 'tabs',
  };
}
