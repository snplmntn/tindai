import { describe, expect, it } from 'vitest';

import { appFlowReducer, getActiveRoute, initialAppFlowState } from '@/context/appFlow';

describe('appFlowReducer', () => {
  it('starts on tabs while onboarding remains incomplete', () => {
    expect(getActiveRoute(initialAppFlowState)).toEqual({
      kind: 'tabs',
    });
    expect(initialAppFlowState.hasCompletedOnboarding).toBe(false);
  });

  it('advances through onboarding and marks it complete on final step', () => {
    const step2 = appFlowReducer(initialAppFlowState, { type: 'advanceOnboarding' });
    const step3 = appFlowReducer(step2, { type: 'advanceOnboarding' });
    const done = appFlowReducer(step3, { type: 'advanceOnboarding' });

    expect(step2.onboardingStep).toBe(2);
    expect(step3.onboardingStep).toBe(3);
    expect(done.hasCompletedOnboarding).toBe(true);
    expect(getActiveRoute(done)).toEqual({ kind: 'tabs' });
  });

  it('skips onboarding while remaining on tabs', () => {
    const skipped = appFlowReducer(initialAppFlowState, { type: 'skipOnboarding' });

    expect(skipped.hasCompletedOnboarding).toBe(true);
    expect(getActiveRoute(skipped)).toEqual({ kind: 'tabs' });
  });

  it('keeps signed-out users in tabs by default', () => {
    const signedIn = appFlowReducer(initialAppFlowState, { type: 'signIn' });
    const signedOut = appFlowReducer(signedIn, { type: 'signOut' });

    expect(getActiveRoute(signedIn)).toEqual({ kind: 'tabs' });
    expect(getActiveRoute(signedOut)).toEqual({ kind: 'tabs' });
  });

  it('shows and hides auth screens on demand', () => {
    const signUp = appFlowReducer(initialAppFlowState, { type: 'showSignUp' });
    const login = appFlowReducer(signUp, { type: 'showLogin' });
    const closed = appFlowReducer(login, { type: 'closeAuth' });

    expect(getActiveRoute(signUp)).toEqual({ kind: 'auth', screen: 'signUp' });
    expect(getActiveRoute(login)).toEqual({ kind: 'auth', screen: 'login' });
    expect(getActiveRoute(closed)).toEqual({ kind: 'tabs' });
  });
});
