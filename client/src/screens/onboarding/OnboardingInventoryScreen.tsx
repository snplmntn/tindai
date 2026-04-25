import { useAuth } from '@/context/AuthContext';
import { OnboardingLayout } from '@/components/OnboardingLayout';

export function OnboardingInventoryScreen() {
  const { nextOnboardingStep, skipOnboarding } = useAuth();

  return (
    <OnboardingLayout
      step={1}
      eyebrow="Get Started"
      title="Bring your inventory into one place."
      description="Start with a clear view of products, stock movement, and items that need attention first."
      panelTitle="Inventory visibility from day one"
      panelBody="Organize your product list around one reliable workspace instead of chasing updates across disconnected notes or spreadsheets."
      points={['Track stock counts with fewer blind spots', 'Spot low-stock items early', 'Keep daily item updates in one view']}
      nextLabel="Next"
      onNext={nextOnboardingStep}
      onSkip={skipOnboarding}
    />
  );
}
