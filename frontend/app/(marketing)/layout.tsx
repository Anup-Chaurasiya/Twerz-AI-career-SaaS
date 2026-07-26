import type { ReactNode } from 'react';
import SiteHeader from '@/components/marketing/SiteHeader';
import SiteFooter from '@/components/marketing/SiteFooter';

export default function MarketingShellLayout({ children }: { children: ReactNode }) {
  return (
    <div className="landing-page mkt-page">
      <SiteHeader />
      <main className="mkt-main">
        <div className="lp-container">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
