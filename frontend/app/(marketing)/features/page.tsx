import type { Metadata } from 'next';
import MarketingPageHeader from '@/components/marketing/MarketingPageHeader';
import MarketingCta from '@/components/marketing/MarketingCta';
import FeaturesSection from '@/components/marketing/sections/FeaturesSection';

export const metadata: Metadata = {
  title: 'Features',
  description: 'Explore all Twerz features — fit scoring, tailoring, outreach, tracker, analytics, roast, extension, and more.',
};

export default function FeaturesPage() {
  return (
    <div className="mkt-content">
      <MarketingPageHeader
        title="Features"
        subtitle="Everything in the app — from PDF/DOCX upload and honest fit scores to outreach, tracker, analytics, roast, and extension."
      />
      <FeaturesSection />
      <MarketingCta primary={{ label: 'Start Free', href: '/login' }} secondary={{ label: 'See How It Works', href: '/how-it-works' }} />
    </div>
  );
}
