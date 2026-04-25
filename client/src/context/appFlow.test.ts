import { describe, expect, it } from 'vitest';

import { appFlowReducer, getActiveRoute, initialAppFlowState } from '@/context/appFlow';

describe('appFlowReducer', () => {
  it('starts on auth choice before onboarding is complete', () => {
    expect(getActiveRoute(initialAppFlowState)).toEqual({
      kind: 'authChoice',
    });
  });

  it('moves guest users to permissions and then tabs', () => {
    const guest = appFlowReducer(initialAppFlowState, { type: 'chooseGuestMode' });
    const done = appFlowReducer(guest, { type: 'completeOnboarding' });

    expect(getActiveRoute(guest)).toEqual({ kind: 'permissions' });
    expect(done.onboardingCompleted).toBe(true);
    expect(getActiveRoute(done)).toEqual({ kind: 'tabs' });
  });

  it('shows account auth screens on demand', () => {
    const signUp = appFlowReducer(initialAppFlowState, { type: 'showSignUp' });
    const login = appFlowReducer(signUp, { type: 'showLogin' });

    expect(getActiveRoute(signUp)).toEqual({ kind: 'auth', screen: 'signUp' });
    expect(getActiveRoute(login)).toEqual({ kind: 'auth', screen: 'login' });
  });

  it('returns to auth choice when auth is closed before sign-in', () => {
    const signUp = appFlowReducer(initialAppFlowState, { type: 'showSignUp' });
    const closed = appFlowReducer(signUp, { type: 'closeAuth' });

    expect(getActiveRoute(closed)).toEqual({ kind: 'authChoice' });
  });

  it('keeps signed-in account users on permissions until onboarding completes', () => {
    const account = appFlowReducer(initialAppFlowState, { type: 'showLogin' });
    const signedIn = appFlowReducer(account, { type: 'signIn' });

    expect(signedIn.authMode).toBe('account');
    expect(getActiveRoute(signedIn)).toEqual({ kind: 'permissions' });
  });

  it('restarts onboarding for a newly created account even when this phone had completed onboarding before', () => {
    const completedGuest = {
      ...initialAppFlowState,
      authMode: 'guest' as const,
      onboardingCompleted: true,
      tutorialShown: true,
    };

    const signedUp = appFlowReducer(completedGuest, { type: 'startNewAccountOnboarding' });

    expect(signedUp.authMode).toBe('account');
    expect(signedUp.isAuthenticated).toBe(true);
    expect(signedUp.onboardingCompleted).toBe(false);
    expect(signedUp.tutorialShown).toBe(false);
    expect(getActiveRoute(signedUp)).toEqual({ kind: 'permissions' });
  });
});
