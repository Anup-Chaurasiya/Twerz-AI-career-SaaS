import Link from 'next/link';
import BrandLogo, { LoveIcon } from '@/components/BrandLogo';
import { COMPANY, FOOTER_LINKS } from '@/lib/marketing/content';

export default function SiteFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-container">
        <div className="lp-footer-grid">
          <div>
            <BrandLogo />
            <p className="lp-footer-brand-desc">{COMPANY.description}</p>
          </div>
          <div>
            <div className="lp-footer-col-title">Product</div>
            {FOOTER_LINKS.product.map(({ label, href }) => (
              <Link key={href} href={href} prefetch className="lp-footer-link">
                {label}
              </Link>
            ))}
          </div>
          <div>
            <div className="lp-footer-col-title">Company</div>
            {FOOTER_LINKS.company.map(({ label, href }) => (
              <Link key={href} href={href} prefetch className="lp-footer-link">
                {label}
              </Link>
            ))}
          </div>
          <div>
            <div className="lp-footer-col-title">Legal</div>
            {FOOTER_LINKS.legal.map(({ label, href }) => (
              <Link key={href} href={href} prefetch className="lp-footer-link">
                {label}
              </Link>
            ))}
          </div>
        </div>
        <div className="lp-footer-bottom">
          <div>
            <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              © 2026 <span className="lp-footer-twerz">{COMPANY.name}</span>. All rights reserved.
            </p>
          </div>
          <p className="lp-footer-love">
            Built with <LoveIcon /> love for job seekers.
          </p>
        </div>
      </div>
    </footer>
  );
}
