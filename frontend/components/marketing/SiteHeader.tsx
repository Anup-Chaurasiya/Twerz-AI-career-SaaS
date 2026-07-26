import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';

export default function SiteHeader() {
  return (
    <nav className="lp-nav lp-nav--scrolled mkt-nav">
      <div className="lp-container mkt-nav-inner">
        <BrandLogo />
        <div className="mkt-nav-actions">
          <Link href="/" className="mkt-nav-link">
            Home
          </Link>
          <Link href="/login" className="mkt-nav-cta">
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}
