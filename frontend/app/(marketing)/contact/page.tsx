import type { Metadata } from 'next';
import MarketingPageHeader from '@/components/marketing/MarketingPageHeader';
import { ContactSection } from '@/components/marketing/sections/AboutSection';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Contact Twerz support — support@twerz.com',
};

export default function ContactPage() {
  return (
    <div className="mkt-content">
      <MarketingPageHeader title="Contact" subtitle="We're here to help with product questions, billing, and data requests." />
      <ContactSection />
    </div>
  );
}
