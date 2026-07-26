import type { Metadata } from 'next';
import MarketingPageHeader from '@/components/marketing/MarketingPageHeader';
import MarketingCta from '@/components/marketing/MarketingCta';
import PricingSection from '@/components/marketing/sections/PricingSection';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Twerz pricing — 100 credits on signup, 20 free daily. Packs from ₹279. Job Hunt Pro ₹299/mo.',
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
