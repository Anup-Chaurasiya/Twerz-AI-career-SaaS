export const COMPANY = {
  name: 'Twerz',
  domain: 'resume.twerz',
  supportEmail: 'support@twerz.com',
  owner: 'Anup Chaurasiya',
  tagline: 'AI resume tailoring for serious job seekers.',
  description:
    'Upload once, tailor for every role — with honest fit scores, zero fabricated skills, and LaTeX-grade output.',
  /** Secondary honesty wedge — hero callout, about page, etc. */
  honestyLine:
    'Unlike other AI resume tools, Twerz never invents a skill to hit 100% keyword match.',
  honestyCallout:
    'Every requirement is evidence-checked before it lands on your PDF — you\u2019ll see an honest Fit Score before you spend a credit.',
} as const;

/**
 * The 9 homepage highlights (3×3 grid) — everything else
 * (33 features total) lives on /features for people who are already convinced and
 * want the full list. Leads with the honesty wedge: it's the one thing every
 * competitor (Rezi, Teal, Jobscan, Kickresume) is called out for getting wrong.
 */
export const HOMEPAGE_HIGHLIGHTS = [
  {
    title: 'Never invents a skill you don\u2019t have',
    desc: 'Every JD requirement is marked Supported, Partial, or Missing against your real experience \u2014 Missing items never make it onto your resume, no matter how good they\u2019d look.',
    tag: 'Honesty',
  },
  {
    title: 'Honest Fit Score before you spend a credit',
    desc: 'Strong \u00b7 Stretch \u00b7 Mismatch with the actual gaps listed \u2014 so you know if a role is worth applying to before you tailor anything.',
    tag: 'Honesty',
  },
  {
    title: 'ATS score, before \u2192 after',
    desc: 'See exactly how much more parseable your resume gets \u2014 not a vague promise, a measured before/after number.',
    tag: 'Score',
  },
  {
    title: 'Cover letter and outreach — included with every tailor',
    desc: 'Each 10-credit tailor includes a matching cover letter and outreach copy. Interview prep packets are included with Job Hunt Pro.',
    tag: 'Apply',
  },
  {
    title: 'AI chat editing',
    desc: 'Refine any tailored section with streaming AI after generation \u2014 shorter summary, stronger bullets, better keywords. Like a career coach sitting next to you.',
    tag: 'Edit',
  },
  {
    title: 'LaTeX-grade PDF output',
    desc: 'Typeset like a professional document, not a template export \u2014 recruiters notice the difference.',
    tag: 'Export',
  },
  {
    title: 'Evidence Report you can copy and share',
    desc: 'Every requirement mapped to Supported, Partial, or Missing with a quote from your real experience \u2014 copy the report and show a recruiter exactly what you can honestly prove.',
    tag: 'Honesty',
  },
  {
    title: 'Apply Assist (Chrome extension)',
    desc: 'Capture any JD, get a fit-scored tailored resume, then one-click fill on employer apply forms. You review and submit \u2014 honest tailoring, not volume spam.',
    tag: 'Apply Smarter',
  },
  {
    title: 'Choose your resume template',
    desc: 'Pick the layout before you download \u2014 professional single-column, compact one-page, or modern two-column. Same honest tailored content, the look you want.',
    tag: undefined,
  },
] as const;

/** Guided apply positioning vs volume auto-apply bots (JobCopilot-style). */
export const APPLY_ASSIST_POSITIONING = {
  headline: 'We won\u2019t apply to 300 jobs while you sleep. We\u2019ll make the 10 you care about impossible to ignore.',
  subhead:
    'Apply Assist captures the JD, runs an honest fit check, generates a tailored PDF + cover letter, then fills employer forms on Greenhouse and Lever. You review and submit \u2014 fewer applications, more callbacks.',
  comparisons: [
    {
      name: 'Volume auto-apply bots',
      pitch: '50+ unattended applications per day',
      counter: 'Guided Apply Assist with fit gate \u2014 3\u20135 thoughtful applies/day',
    },
    {
      name: 'Template rewriters',
      pitch: 'Generic keyword stuffing',
      counter: 'Evidence-grounded tailoring + outreach copy + tracker sync',
    },
    {
      name: 'Job search agents',
      pitch: 'Discovery-first, manual apply',
      counter: 'Last-mile form fill on boards you already use (LinkedIn, Naukri, Greenhouse, Lever)',
    },
  ],
} as const;

export const FAQS = [
  {
    q: 'Does Twerz auto-apply to jobs for me?',
    a: 'No — and that is intentional. Apply Assist (Chrome extension) captures job descriptions, runs an honest fit check, generates tailored PDFs and cover letters, then helps you fill employer application forms on Greenhouse and Lever. You always review and click Submit. We optimize for interview callbacks, not application volume.',
  },
  {
    q: 'What is an ATS?',
    a: 'An Applicant Tracking System (ATS) is software used by employers to filter resumes before a human ever sees them. Up to 75% of resumes are rejected by ATS before reaching a recruiter.',
  },
  {
    q: 'How does Twerz work?',
    a: 'Upload your base resume, paste a job description, and our AI analyzes the job requirements to generate a perfectly tailored, ATS-optimized resume in LaTeX-precision PDF format — with an honest fit score before you spend a credit.',
  },
  {
    q: 'What is Twerz?',
    a: 'Twerz builds AI-powered career tools designed for honest, evidence-grounded job applications — starting with resume tailoring on resume.twerz.',
  },
  {
    q: 'Can Twerz write outreach messages?',
    a: 'Yes. For each job you can generate warm intros to known contacts, cold LinkedIn messages to hiring managers, and referral request copy — all grounded in your real experience and the job description. Nothing is fabricated.',
  },
  {
    q: 'How does the referral program work?',
    a: 'Every user gets a unique referral link. When a friend signs up through your link and completes their first resume tailor, both of you receive bonus credits automatically.',
  },
  {
    q: 'Is my resume data safe?',
    a: 'Yes. Your resume data is encrypted and stored securely. We never share your data with third parties. You can delete your data at any time. Twerz is built with DPDP Act compliance for India.',
  },
  {
    q: 'How many free credits do I get?',
    a: 'You get 100 credits when you sign up, plus 20 free credits every day (enough for about 2 tailored resumes). Daily credits reset at midnight UTC — no credit card needed.',
  },
  {
    q: 'What is the difference between credit packs and Job Hunt Pro?',
    a: 'Credit packs are one-time credit top-ups — same tailor pipeline, chat, PDF/DOCX, outreach, tracker, and roasts for everyone with credits. Job Hunt Pro is a monthly subscription with 800 credits plus interview prep packets and the Chrome extension (Pro-only features).',
  },
  {
    q: 'What file formats are supported?',
    a: 'Upload your base resume as a PDF or DOCX file. Tailored output is always a clean, professionally formatted PDF or DOCX.',
  },
  {
    q: 'How much does one tailored resume cost?',
    a: 'Each tailored resume + cover letter costs 10 credits. Outreach messages, interview prep, and PDF recompiles after edits are included at no extra cost.',
  },
  {
    q: 'What features are included in Twerz?',
    a: 'Everything from PDF/DOCX upload and honest fit scoring to LaTeX PDF + DOCX export, AI chat editing, cover letters, interview prep, warm/cold outreach, LinkedIn optimization, application tracker, personal analytics, resume roast, Chrome extension, referral bonuses, time passes, promo codes, and DPDP-compliant data export or delete.',
  },
] as const;

export const FEATURES = [
  {
    title: 'PDF & DOCX Upload',
    desc: 'Upload your base resume as PDF or Word — AI structures experience, skills, and history into an editable profile.',
    tag: 'Tailor & Score',
  },
  {
    title: 'Honest Fit Score',
    desc: 'Strong · Stretch · Mismatch labels with red gaps listed before you spend a credit — no false confidence.',
    tag: 'Tailor & Score',
  },
  {
    title: 'Free Fit Pre-Check',
    desc: 'Analyze fit against any job description for free before spending a credit — see gaps upfront.',
    tag: 'Tailor & Score',
  },
  {
    title: 'Evidence Map',
    desc: 'Every JD requirement marked Supported, Partial, or Missing — tailoring never fabricates skills you lack.',
    tag: 'Tailor & Score',
  },
  {
    title: 'Keyword Matching',
    desc: 'AI reads the job description and weaves must-have keywords into your bullets — naturally, never stuffed.',
    tag: 'Tailor & Score',
  },
  {
    title: 'ATS Score Before → After',
    desc: 'See exactly how much your tailored resume improves ATS parseability compared to your base profile.',
    tag: 'Tailor & Score',
  },
  {
    title: 'Gap Fixer (Evidence Only)',
    desc: 'Amplifies Supported and Partial skills from your profile — never invents tools or metrics you do not have.',
    tag: 'Tailor & Score',
  },
  {
    title: 'Profile Enhancement',
    desc: 'AI polishes your base profile structure — free rate-limited enhancements before you tailor to any job.',
    tag: 'Tailor & Score',
  },
  {
    title: 'Anti-Fabrication Guard',
    desc: 'Prompts and validators block invented tools, senior titles, and fake metrics at every generation step.',
    tag: 'Tailor & Score',
  },
  {
    title: 'AI Chat Editing',
    desc: 'Refine any tailored section with streaming AI — like a career coach sitting next to you.',
    tag: 'Edit & Export',
  },
  {
    title: 'Profile Chat Assistant',
    desc: 'Ask questions and refine your base profile structure before tailoring to any job.',
    tag: 'Edit & Export',
  },
  {
    title: 'Manual Resume Editor',
    desc: 'Edit structured resume JSON directly in the dashboard before generating your PDF.',
    tag: 'Edit & Export',
  },
  {
    title: 'LaTeX PDF Output',
    desc: 'Professional typesetting — not a Canva template. Recruiters notice the difference.',
    tag: 'Edit & Export',
  },
  {
    title: 'DOCX Export',
    desc: 'Download an editable Word version alongside your print-ready PDF for quick manual tweaks.',
    tag: 'Edit & Export',
  },
  {
    title: 'Version History',
    desc: 'Every generation is saved — restore a previous tailored version if you want to roll back a change.',
    tag: 'Edit & Export',
  },
  {
    title: 'Free PDF Recompile',
    desc: 'Recompile your PDF after chat or manual edits at no extra credit cost.',
    tag: 'Edit & Export',
  },
  {
    title: 'Multi-language Resumes',
    desc: 'English, Norwegian, French, German, Spanish, Italian, and Russian from one profile.',
    tag: 'Edit & Export',
  },
  {
    title: 'Cover Letter Generator',
    desc: 'Role-specific cover letter generated alongside every tailored resume — evidence-grounded, never generic.',
    tag: 'Apply Smarter',
  },
  {
    title: 'Interview Prep Packet',
    desc: 'Likely questions, STAR stories from your resume, elevator pitch, and gaps to study before the call.',
    tag: 'Apply Smarter',
  },
  {
    title: 'Warm & Cold Outreach',
    desc: 'Generate copy-paste-ready messages: warm intros to known contacts, cold LinkedIn DMs, and referral requests — all grounded in your real experience.',
    tag: 'Apply Smarter',
  },
  {
    title: 'LinkedIn Optimizer',
    desc: 'Headline, About section, and Skills list optimized from your profile — optionally flavored by a target job description.',
    tag: 'Apply Smarter',
  },
  {
    title: 'Networking Contacts',
    desc: 'Save known contacts per job and track whether you applied via referral, cold outreach, or recruiter.',
    tag: 'Apply Smarter',
  },
  {
    title: 'Applied-Via Tracking',
    desc: 'Record cold apply, referral intro, or recruiter outreach on every job so you know what worked.',
    tag: 'Apply Smarter',
  },
  {
    title: 'Application Tracker',
    desc: 'Kanban board from Saved → Applied → Interview → Offer. Notes, follow-ups, and fit scores on every card.',
    tag: 'Track & Grow',
  },
  {
    title: 'Personal Analytics',
    desc: 'Your conversion rates by fit band vs platform benchmarks — see when tailoring actually pays off.',
    tag: 'Track & Grow',
  },
  {
    title: 'Referral Program',
    desc: 'Share your unique link — when a friend completes their first tailor, both of you get bonus credits.',
    tag: 'Track & Grow',
  },
  {
    title: 'Resume Roast',
    desc: 'Brutally honest ATS review with a shareable public link — viral growth tool that converts signups.',
    tag: 'Track & Grow',
  },
  {
    title: 'Chrome Extension',
    desc: 'Capture job descriptions from any job page and create a Twerz job in one click.',
    tag: 'Track & Grow',
  },
  {
    title: 'Time Passes & Promo Codes',
    desc: 'Unlimited generation windows via time passes, plus redeemable promo codes for bonus credits.',
    tag: 'Track & Grow',
  },
  {
    title: 'Account Export & Delete',
    desc: 'Download your data as JSON or permanently delete your account — built for DPDP compliance.',
    tag: 'Track & Grow',
  },
  {
    title: 'Public ATS Check',
    desc: 'No signup required — upload any PDF for an instant ATS parseability score and checklist.',
    tag: 'Free Tools',
  },
  {
    title: 'Guest Upload (No Signup)',
    desc: 'Try the full structuring flow before creating an account — upload once, sign in to claim your profile.',
    tag: 'Free Tools',
  },
  {
    title: 'Instant Generation',
    desc: 'Full tailored resume, cover letter, and fit analysis in under 60 seconds.',
    tag: 'Speed',
  },
] as const;

export const PLATFORM_CATEGORIES = [
  {
    title: 'Tailor & Score',
    items: [
      'PDF & DOCX upload + AI structuring',
      'Guest upload (no signup)',
      'Free fit pre-check before credits',
      'Honest fit score (Strong / Stretch / Mismatch)',
      'Evidence map (Supported / Partial / Missing)',
      'ATS score before → after',
      'Keyword matching from real experience',
      'Gap fixer (evidence only)',
      'Anti-fabrication guard',
      'Profile enhancement (rate-limited free)',
    ],
  },
  {
    title: 'Edit & Export',
    items: [
      'AI chat editor (tailored resume)',
      'Profile chat assistant (base profile)',
      'Manual JSON resume editor',
      'LaTeX PDF output',
      'DOCX export',
      'Version history + restore',
      'Free PDF recompile after edits',
      'Multi-language support (7 languages)',
    ],
  },
  {
    title: 'Apply Smarter',
    items: [
      'Cover letter generator',
      'Interview prep packet (STAR, Q&A, pitch)',
      'Warm intro to known contacts',
      'Cold LinkedIn message generator',
      'Referral request copy',
      'LinkedIn optimizer (headline, About, skills)',
      'Networking contacts per job',
      'Applied-via tracking (referral / cold / recruiter)',
      'Public ATS check (free, no signup)',
    ],
  },
  {
    title: 'Track & Grow',
    items: [
      'Kanban application tracker',
      'Notes + follow-up dates on cards',
      'Personal analytics + platform benchmarks',
      'Referral link + bonus credits',
      'Resume roast + viral public share',
      'Chrome extension (Apply Assist)',
      'Credit packs + daily free credits',
      'Time passes + promo codes',
      'Account data export + delete (DPDP)',
    ],
  },
] as const;

export const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Upload Your Resume',
    desc: 'Drop your PDF or DOCX — we parse experience, skills, and achievements into a structured profile in seconds.',
  },
  {
    step: '02',
    title: 'Paste Job Description',
    desc: 'Paste any job posting. AI extracts must-have keywords, skills, and ATS filters automatically.',
  },
  {
    step: '03',
    title: 'Review Fit Score',
    desc: 'See an honest Strong · Stretch · Mismatch score with red gaps before you spend a credit.',
  },
  {
    step: '04',
    title: 'Tailor, Export & Apply',
    desc: 'Get a LaTeX PDF + DOCX, cover letter, interview prep, and outreach copy — then track on the kanban board until offer.',
  },
] as const;

/** 10 credits = one tailored resume + cover letter (matches backend RESUME_GENERATION_CREDIT_COST). */
export const CREDITS_PER_TAILOR = 10;

/** Shown under pricing grids — clarifies Pro-only vs credit-pack features. */
export const PRICING_FOOTNOTE =
  'Credit packs add credits only. Every tailor (10 credits) includes cover letter, outreach, chat edits & free PDF recompile. Interview packets & Apply Assist Chrome extension require Job Hunt Pro.';

/** Core features included whenever you have credits (same for all packs). */
export const CREDIT_PACK_CORE_FEATURES = [
  'Tailored resume + cover letter per job',
  'Chat editing & free PDF/DOCX recompile',
  'Outreach messages & honest fit score',
  'Application tracker & free resume roasts',
] as const;

export const JOB_HUNT_PRO_PLAN = {
  name: 'Job Hunt Pro',
  price: '₹299',
  per: 'per month · billed monthly',
  credits: '800 credits / mo · ≈ 80 tailored resumes',
  features: [
    '800 credits refreshed every month',
    'Interview prep packets (Pro-only)',
    'Apply Assist Chrome extension (capture + form fill, Pro-only)',
    'Application tracker + all credit-pack features',
    'Cover letter, outreach & free PDF recompiles with each tailor',
  ],
  featured: true,
  badge: 'Subscription',
  bestFor: 'Multi-week hunts with Apply Assist + tracker',
  accent: '#6366f1',
} as const;

export const PRICING_PLANS = [
  {
    name: 'Free Daily',
    price: '₹0',
    per: '20 credits / day',
    credits: '100 signup + ~2 tailors/day free',
    features: ['100 credits on signup', '20 daily free credits', 'Honest fit score', 'Cover letter + outreach', 'No credit card needed'],
    featured: false,
    bestFor: 'Getting started',
    accent: '#10b981',
  },
  {
    name: 'Starter',
    price: '₹279',
    per: '500 credits',
    credits: '≈ 50 tailored resumes',
    features: [
      '≈ 50 tailored resumes (500 credits)',
      'Full platform — all tailor tools included',
      ...CREDIT_PACK_CORE_FEATURES,
    ],
    featured: false,
    bestFor: 'First purchase — try the full pipeline',
    accent: '#38bdf8',
  },
  {
    name: 'Sprint',
    price: '₹599',
    per: '1,200 credits',
    credits: '≈ 120 tailored resumes',
    features: [
      '≈ 120 tailored resumes (1,200 credits)',
      '2.4× more credits than Starter',
      '~11% cheaper per resume (~₹4.99 vs ₹5.58)',
      ...CREDIT_PACK_CORE_FEATURES,
    ],
    featured: true,
    badge: 'Most Popular',
    bestFor: 'Active job hunting (2–3 weeks)',
    accent: '#ff5a1f',
  },
  {
    name: 'Job Hunt',
    price: '₹949',
    per: '2,500 credits',
    credits: '≈ 250 tailored resumes',
    features: [
      '≈ 250 tailored resumes (2,500 credits)',
      '5× Starter volume — full search campaign',
      '~32% cheaper per resume (~₹3.80) — best one-time deal',
      ...CREDIT_PACK_CORE_FEATURES,
    ],
    featured: false,
    bestFor: 'Intensive search campaigns',
    accent: '#34d399',
  },
] as const;

export const FOOTER_LINKS = {
  product: [
    { label: 'Features', href: '/features' },
    { label: 'Platform', href: '/platform' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'How It Works', href: '/how-it-works' },
    { label: 'FAQ', href: '/faq' },
  ],
  company: [
    { label: 'About Twerz', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ],
  legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'DPDP Compliance', href: '/dpdp' },
  ],
} as const;
