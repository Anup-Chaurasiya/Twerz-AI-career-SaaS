import type { Metadata } from 'next';
import MarketingPageHeader from '@/components/marketing/MarketingPageHeader';
import MarketingCta from '@/components/marketing/MarketingCta';
import FaqSection from '@/components/marketing/sections/FaqSection';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Frequently asked questions about Twerz resume tailoring, credits, and data safety.',
};

export default function FaqPage() {
  return (
    <div className="mkt-content">
      <MarketingPageHeader title="FAQ" subtitle="Common questions about Twerz, credits, and keeping your data safe." />
      <FaqSection />
      <MarketingCta primary={{ label: 'Get Started', href: '/login' }} secondary={{ label: 'Contact Support', href: '/contact' }} />
    </div>
  );
}
