import Link from 'next/link';
import { COMPANY } from '@/lib/marketing/content';

export default function AboutSection() {
  return (
    <div className="mkt-prose">
      <p>
        <strong>{COMPANY.name}</strong> builds AI-powered career tools designed for honest job applications.
        We believe your resume should amplify what you actually have — never invent skills, metrics, or
        experience you cannot defend in an interview.
      </p>
      <p>
        Our flagship product on <strong>{COMPANY.domain}</strong> turns one base profile into role-perfect
        PDFs with honest fit scores, LaTeX-grade output, cover letters, interview prep, and application
        tracking — all in one place.
      </p>
      <h2>Our approach</h2>
      <ul className="mkt-list">
        <li>Evidence-grounded tailoring — no fabricated skills or metrics</li>
        <li>Fit scores before you spend a credit (Strong · Stretch · Mismatch)</li>
        <li>LaTeX-quality PDFs that stand out from template builders</li>
        <li>Built for India with DPDP Act compliance</li>
      </ul>
      <h2>Leadership</h2>
      <p>
        Founded and led by <strong>{COMPANY.owner}</strong>, {COMPANY.name} is focused on giving job
        seekers a fair edge in competitive markets — without the ethical shortcuts of generic AI resume tools.
      </p>
    </div>
  );
}

export function ContactSection() {
  return (
    <div className="mkt-contact-grid">
      <article className="mkt-card">
        <h2 className="mkt-card-title">Support</h2>
        <p className="mkt-card-desc">
          For product help, billing questions, or account issues, email us and we&apos;ll get back to you
          within 1–2 business days.
        </p>
        <a href={`mailto:${COMPANY.supportEmail}`} className="mkt-contact-email">
          {COMPANY.supportEmail}
        </a>
      </article>
      <article className="mkt-card">
        <h2 className="mkt-card-title">Founder</h2>
        <p className="mkt-card-desc">
          {COMPANY.name} is founded and operated by {COMPANY.owner}.
        </p>
        <p className="mkt-contact-name">{COMPANY.owner}</p>
      </article>
      <article className="mkt-card">
        <h2 className="mkt-card-title">Privacy & Data Rights</h2>
        <p className="mkt-card-desc">
          For data access, correction, or deletion requests under DPDP or GDPR, contact support with
          &ldquo;Privacy Request&rdquo; in the subject line.
        </p>
        <Link href="/dpdp" className="mkt-inline-link">
          DPDP Compliance →
        </Link>
      </article>
    </div>
  );
}
