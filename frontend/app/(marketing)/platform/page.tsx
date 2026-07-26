import type { Metadata } from 'next';
import MarketingPageHeader from '@/components/marketing/MarketingPageHeader';
import MarketingCta from '@/components/marketing/MarketingCta';
import PlatformSection from '@/components/marketing/sections/PlatformSection';

export const metadata: Metadata = {
  title: 'Platform',
  description: 'The full Twerz platform — tailor, edit, apply smarter, and track your job hunt.',
};

export default function PlatformPage() {
  return (
    <div className="mkt-content">
      <MarketingPageHeader title="Platform" subtitle="One profile. Every role. End-to-end from tailor to tracker." />
      <PlatformSection />
      <MarketingCta primary={{ label: 'Get Started', href: '/login' }} secondary={{ label: 'View Features', href: '/features' }} />
    </div>
  );
}
