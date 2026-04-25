import { useAuth } from '@/context/AuthContext';
import { OnboardingLayout } from '@/components/OnboardingLayout';

export function OnboardingAnalyticsScreen() {
  const { nextOnboardingStep, skipOnboarding } = useAuth();

  return (
    <OnboardingLayout
      step={3}
      eyebrow="Track Trends"
      title="Turn activity into useful decisions."
      description="Finish onboarding by pointing users toward analytics, where they can watch trends, movement, and performance shifts."
      panelTitle="Insights that feel connected to the workflow"
      panelBody="The app should not stop at reporting what happened. It should help you spot patterns and act while they still matter."
      points={['Review movement and demand trends', 'Compare what is rising and slowing down', 'Continue into login when you are ready']}
      nextLabel="Continue to Login"
      onNext={nextOnboardingStep}
      onSkip={skipOnboarding}
    />
  );
}
