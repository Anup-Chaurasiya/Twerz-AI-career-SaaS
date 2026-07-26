import type { Metadata } from 'next';
import MarketingPageHeader from '@/components/marketing/MarketingPageHeader';
import MarketingCta from '@/components/marketing/MarketingCta';
import AboutSection from '@/components/marketing/sections/AboutSection';

export const metadata: Metadata = {
  title: 'About Twerz',
  description: 'About Twerz — AI-powered career tools built with honesty for job seekers.',
};

export default function AboutPage() {
  return (
    <div className="mkt-content">
      <MarketingPageHeader title="About Twerz" subtitle="Honest, evidence-grounded AI for people who take their careers seriously." />
      <AboutSection />
      <MarketingCta primary={{ label: 'Start Free', href: '/login' }} secondary={{ label: 'Contact Us', href: '/contact' }} />
    </div>
  );
}
