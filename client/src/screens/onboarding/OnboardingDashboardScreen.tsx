import { useAuth } from '@/context/AuthContext';
import { OnboardingLayout } from '@/components/OnboardingLayout';

export function OnboardingDashboardScreen() {
  const { nextOnboardingStep, skipOnboarding } = useAuth();

  return (
    <OnboardingLayout
      step={2}
      eyebrow="Stay in Control"
      title="See the business pulse at a glance."
      description="Use the dashboard as the center of the app so people can see what matters right away."
      panelTitle="One warm, central control panel"
      panelBody="Alerts, daily movement, and recent activity stay together in one view for faster decisions."
      points={['Review the day’s priorities faster', 'Spot important alerts early', 'Keep Inventory and Analytics one tap away']}
      nextLabel="Next"
      onNext={nextOnboardingStep}
      onSkip={skipOnboarding}
    />
  );
}
