import type { Metadata } from 'next';
import MarketingPageHeader from '@/components/marketing/MarketingPageHeader';
import MarketingCta from '@/components/marketing/MarketingCta';
import PricingSection from '@/components/marketing/sections/PricingSection';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Twerz pricing — 3 free resume tailors daily. Credit packs from ₹49.',
};

export default function PricingPage() {
  return (
    <div className="mkt-content">
      <MarketingPageHeader title="Pricing" subtitle="Start free. Scale when you're hunting hard." />
      <PricingSection />
      <MarketingCta primary={{ label: 'Start Free', href: '/login' }} secondary={{ label: 'Pricing FAQ', href: '/faq' }} />
    </div>
  );
}
