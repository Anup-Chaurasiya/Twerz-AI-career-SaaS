import type { Metadata } from 'next';
import MarketingPageHeader from '@/components/marketing/MarketingPageHeader';
import { PrivacySection } from '@/components/marketing/sections/LegalSections';
import { COMPANY } from '@/lib/marketing/content';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Twerz Privacy Policy — how we collect, use, and protect your resume data.',
};

export default function PrivacyPage() {
  return (
    <div className="mkt-content">
      <MarketingPageHeader title="Privacy Policy" subtitle={`Last updated: July 2026 · ${COMPANY.name}`} />
      <PrivacySection />
    </div>
  );
}
