import type { Metadata } from 'next';
import MarketingPageHeader from '@/components/marketing/MarketingPageHeader';
import { TermsSection } from '@/components/marketing/sections/LegalSections';
import { COMPANY } from '@/lib/marketing/content';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Twerz Terms of Service — rules for using resume.twerz.',
};

export default function TermsPage() {
  return (
    <div className="mkt-content">
      <MarketingPageHeader title="Terms of Service" subtitle={`Last updated: July 2026 · ${COMPANY.name}`} />
      <TermsSection />
    </div>
  );
}
