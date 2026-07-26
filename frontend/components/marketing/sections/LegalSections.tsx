import Link from 'next/link';
import { COMPANY } from '@/lib/marketing/content';

export function PrivacySection() {
  return (
    <div className="mkt-prose">
      <p>
        This Privacy Policy describes how <strong>{COMPANY.name}</strong> (&ldquo;we&rdquo;, &ldquo;us&rdquo;)
        collects, uses, and protects your personal information when you use {COMPANY.domain} and related
        services.
      </p>
      <h2>1. Information We Collect</h2>
      <ul className="mkt-list">
        <li>Account information: name, email address (via Google OAuth)</li>
        <li>Resume data: employment history, education, skills, contact details from uploaded PDFs</li>
        <li>Job descriptions you paste for tailoring</li>
        <li>Usage data: feature usage, credit transactions, application tracking data you enter</li>
        <li>Payment metadata processed by Razorpay (we do not store full card details)</li>
      </ul>
      <h2>2. How We Use Your Information</h2>
      <ul className="mkt-list">
        <li>Parse and structure your resume for AI tailoring</li>
        <li>Generate tailored resumes, cover letters, and interview prep materials</li>
        <li>Provide fit scores, ATS analysis, and application tracking</li>
        <li>Process payments and manage credits</li>
        <li>Improve product quality and fix errors</li>
      </ul>
      <h2>3. Data Sharing</h2>
      <p>
        We do <strong>not</strong> sell your personal data. We share data only with service providers
        necessary to operate the product under contractual confidentiality obligations.
      </p>
      <h2>4. Data Retention & Deletion</h2>
      <p>
        Your data is retained until you delete it. Contact{' '}
        <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a> for full account deletion.
      </p>
      <h2>5. Security</h2>
      <p>Resume data is encrypted at rest and transmitted over HTTPS.</p>
      <h2>6. Your Rights</h2>
      <p>
        See our <Link href="/dpdp">DPDP Compliance</Link> page for data principal rights under Indian law.
      </p>
      <h2>7. Contact</h2>
      <p>
        <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>
        <br />
        Operator: {COMPANY.owner}, {COMPANY.name}
      </p>
    </div>
  );
}

export function TermsSection() {
  return (
    <div className="mkt-prose">
      <p>
        By using {COMPANY.domain}, operated by <strong>{COMPANY.name}</strong>, you agree to these Terms
        of Service.
      </p>
      <h2>1. The Service</h2>
      <p>
        Twerz provides AI-assisted resume tailoring and related career tools. You are responsible for
        reviewing all generated content before submitting it to employers.
      </p>
      <h2>2. Credits & Payments</h2>
      <ul className="mkt-list">
        <li>Free users receive 3 daily credits (resets at midnight UTC)</li>
        <li>Purchased credits are non-refundable except where required by law</li>
        <li>Failed generations are refunded automatically</li>
      </ul>
      <h2>3. Acceptable Use</h2>
      <p>Do not upload content you lack rights to, abuse the API, or generate fraudulent applications.</p>
      <h2>4. AI-Generated Content</h2>
      <p>You must verify that all claims in your resume are truthful and defensible.</p>
      <h2>5. Contact</h2>
      <p>
        <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>
        <br />
        Operator: {COMPANY.owner}, {COMPANY.name}
      </p>
    </div>
  );
}

export function DpdpSection() {
  return (
    <div className="mkt-prose">
      <p>
        {COMPANY.name} complies with the Digital Personal Data Protection Act, 2023 (DPDP Act) for users
        in India.
      </p>
      <h2>Data We Process</h2>
      <ul className="mkt-list">
        <li>Name, email, phone (if in resume)</li>
        <li>Employment history, education, skills</li>
        <li>Uploaded PDF resumes and generated documents</li>
      </ul>
      <h2>Your Rights</h2>
      <ul className="mkt-list">
        <li>Right to access, correction, and erasure</li>
        <li>Right to grievance redressal via support email</li>
      </ul>
      <h2>Grievance Officer</h2>
      <p>
        <strong>{COMPANY.owner}</strong>
        <br />
        <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>
      </p>
      <p className="mkt-meta">Notice version: July 2026</p>
    </div>
  );
}
