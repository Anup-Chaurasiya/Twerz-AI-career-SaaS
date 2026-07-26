import type { Metadata } from 'next';
import MarketingPageHeader from '@/components/marketing/MarketingPageHeader';
import { DpdpSection } from '@/components/marketing/sections/LegalSections';

export const metadata: Metadata = {
  title: 'DPDP Compliance',
  description: 'Twerz DPDP Act compliance — data principal rights for Indian users.',
};

export default function DpdpPage() {
  return (
    <div className="mkt-content">
      <MarketingPageHeader
        title="DPDP Compliance"
        subtitle="India Digital Personal Data Protection Act (2023) — Data Principal Rights"
      />
      <DpdpSection />
    </div>
  );
}
