export const LANDING_FAQS = [
  { q: 'What is an ATS?', a: 'An Applicant Tracking System (ATS) is software used by employers to filter resumes before a human ever sees them. Up to 75% of resumes are rejected by ATS before reaching a recruiter.' },
  { q: 'How does Twerz work?', a: 'Upload your base resume, paste a job description, and our AI analyzes the job requirements to generate a perfectly tailored, ATS-optimized resume in LaTeX-precision PDF format — with an honest fit score before you spend a credit.' },
  { q: 'Can Twerz write outreach messages?', a: 'Yes — for each job you can generate warm intros to known contacts, cold LinkedIn messages, and referral request copy. Every message is grounded in your real experience and the job description.' },
  { q: 'How does the referral program work?', a: 'Share your unique referral link. When a friend signs up and completes their first resume tailor, both of you receive bonus credits automatically.' },
  { q: 'What is Twerz?', a: 'Twerz builds AI-powered career tools designed for honest, evidence-grounded job applications — starting with resume tailoring on resume.twerz.' },
  { q: 'Is my resume data safe?', a: 'Yes. Your resume data is encrypted and stored securely. We never share your data with third parties. You can delete your data at any time. Twerz is built with DPDP Act compliance for India.' },
  { q: 'How many free credits do I get?', a: 'You get 100 credits when you sign up, plus 20 free credits every day (about 2 tailored resumes). Daily credits reset at midnight UTC — no credit card needed.' },
  { q: 'What file formats are supported?', a: 'Upload your base resume as a PDF or DOCX file. Tailored output is always a clean, professionally formatted PDF or DOCX.' },
  { q: 'How much does one tailored resume cost?', a: 'Each tailored resume + cover letter costs 10 credits. Outreach messages, interview prep, and PDF recompiles after edits are included.' },
  { q: 'What features are included in Twerz?', a: 'Everything from PDF/DOCX upload and honest fit scoring to LaTeX PDF + DOCX export, AI chat editing, cover letters, interview prep, warm/cold outreach, LinkedIn optimization, application tracker, personal analytics, resume roast, Chrome extension, referral bonuses, time passes, promo codes, and DPDP-compliant data export or delete.' },
];

export const UPLOAD_HIGHLIGHTS = [
  { title: 'PDF & DOCX Upload', desc: 'Structure once from PDF or Word', accent: '#10b981', icon: '↑' },
  { title: 'Honest Fit Score', desc: 'Strong · Stretch · Mismatch + red gaps', accent: '#6366f1', icon: '◉' },
  { title: 'Evidence Map', desc: 'Supported · Partial · Missing per JD req', accent: '#8b5cf6', icon: '◎' },
  { title: 'LaTeX + DOCX', desc: 'Print-ready PDF and editable DOCX export', accent: '#34d399', icon: '▣' },
  { title: 'Cover Letters', desc: 'Role-specific letter with every tailor', accent: '#fb923c', icon: '✉' },
  { title: 'Outreach Copy', desc: 'Cold LinkedIn, warm intro & referral text', accent: '#0ea5e9', icon: '💬' },
  { title: 'Interview Prep', desc: 'STAR stories, questions, elevator pitch', accent: '#fbbf24', icon: '★' },
  { title: 'LinkedIn Optimizer', desc: 'Headline, About & skills from your profile', accent: '#0ea5e9', icon: 'in' },
  { title: 'App Tracker', desc: 'Kanban board from saved to offer', accent: '#8b5cf6', icon: '▦' },
  { title: 'Personal Analytics', desc: 'Conversion rates vs platform benchmarks', accent: '#6366f1', icon: '📊' },
  { title: 'Resume Roast', desc: 'Honest ATS review + shareable link', accent: '#fb7185', icon: '🔥' },
  { title: 'Referral Bonuses', desc: 'Share link — both get credits on first tailor', accent: '#ff5a1f', icon: '🎁' },
  { title: 'Free Credits', desc: '100 on signup + 20 daily', accent: '#10b981', icon: '⚡' },
  { title: 'Encrypted · DPDP', desc: 'India privacy standards built in', accent: '#64748b', icon: '🔒' },
];

export const COMPARE_ROWS = [
  { label: 'Tailored per job description', manual: false, template: false, twerz: true },
  { label: 'Real keyword matching', manual: false, template: false, twerz: true },
  { label: 'Honest fit score (no fabrication)', manual: false, template: false, twerz: true },
  { label: 'Evidence map + gap fixer', manual: false, template: false, twerz: true },
  { label: 'LaTeX-quality PDF + DOCX export', manual: false, template: 'Partial', twerz: true },
  { label: 'AI chat + profile chat editing', manual: false, template: false, twerz: true },
  { label: 'Cover letter + interview prep', manual: false, template: false, twerz: true },
  { label: 'Cold LinkedIn & referral outreach', manual: false, template: false, twerz: true },
  { label: 'LinkedIn optimizer', manual: false, template: false, twerz: true },
  { label: 'Application tracker built-in', manual: false, template: false, twerz: true },
  { label: 'Personal analytics + benchmarks', manual: false, template: false, twerz: true },
  { label: 'Referral bonus program', manual: false, template: false, twerz: true },
  { label: 'Resume roast + public ATS check', manual: false, template: false, twerz: true },
  { label: 'Chrome extension (JD capture)', manual: false, template: false, twerz: true },
  { label: 'Free daily credits + time passes', manual: false, template: false, twerz: true },
  { label: 'Under 60 seconds', manual: false, template: true, twerz: true },
];

export const TESTIMONIALS = [
  { quote: 'I went from zero callbacks to 4 interviews in two weeks. The keyword matching is scary accurate.', name: 'Priya S.', role: 'Software Engineer', company: 'Bangalore', initials: 'PS', accent: '#38bdf8' },
  { quote: 'LaTeX output looks so much cleaner than Canva templates. Recruiters actually commented on my resume format.', name: 'Marcus T.', role: 'Product Manager', company: 'London', initials: 'MT', accent: '#ff5a1f' },
  { quote: 'The roast feature saved me — I had no idea my resume was failing ATS parsing on section headers.', name: 'Ananya R.', role: 'Data Analyst', company: 'Mumbai', initials: 'AR', accent: '#34d399' },
];

export const PERSONAS = [
  { title: 'New Graduates', desc: 'Turn one college resume into role-specific versions for every application.', icon: '🎓', accent: '#38bdf8' },
  { title: 'Career Switchers', desc: 'Reframe your experience to match a new industry without starting from scratch.', icon: '🔄', accent: '#fbbf24' },
  { title: 'Senior Engineers', desc: 'Highlight the right tech stack and leadership signals for each senior role.', icon: '⚡', accent: '#ff5a1f' },
  { title: 'Active Job Hunters', desc: 'Apply to 10+ roles a day with tailored resumes — not copy-paste spam.', icon: '🎯', accent: '#34d399' },
];

export const TRUST_ITEMS = [
  { title: 'Encrypted Storage', desc: 'Resume data encrypted at rest', icon: '🔒' },
  { title: 'Delete Anytime', desc: 'Full data deletion on request', icon: '🗑️' },
  { title: 'No Data Selling', desc: 'We never sell your information', icon: '🛡️' },
  { title: 'DPDP Compliant', desc: 'Built for India privacy standards', icon: '🇮🇳' },
];

export { PRICING_PLANS, JOB_HUNT_PRO_PLAN, CREDITS_PER_TAILOR, PRICING_FOOTNOTE, CREDIT_PACK_CORE_FEATURES, PLATFORM_CATEGORIES } from '@/lib/marketing/content';
