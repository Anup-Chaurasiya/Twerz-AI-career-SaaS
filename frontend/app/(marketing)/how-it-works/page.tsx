import type { Metadata } from 'next';
import MarketingPageHeader from '@/components/marketing/MarketingPageHeader';
import MarketingCta from '@/components/marketing/MarketingCta';
import HowItWorksSection from '@/components/marketing/sections/HowItWorksSection';

export const metadata: Metadata = {
  title: 'How It Works',
  description: 'How Twerz works — upload, paste JD, review fit score, download tailored PDF.',
};

export default function HowItWorksPage() {
  return (
    <div className="mkt-content">
      <MarketingPageHeader title="How It Works" subtitle="From one resume to a role-perfect application in under 60 seconds." />
      <HowItWorksSection />
      <MarketingCta primary={{ label: 'Try It Free', href: '/login' }} secondary={{ label: 'Explore Features', href: '/features' }} />
    </div>
  );
}
