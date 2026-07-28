/** Job description extraction with page-type detection and validation. */

const AB_MIN_DESC = 20;
const AB_MAX_FIELD = 200;

function abHost() {
  return (location.hostname || '').toLowerCase();
}

const JUNK_ROLE_RE =
  /^(search for jobs?|find jobs?|jobs?|sign in|log in|explore|home|recent notifications|notifications|saved|messages|menu|profile|settings|for you|recommended)$/i;
const JUNK_COMPANY_RE = /(actively hiring|promoted|see all|total raised|\$\d)/i;
const WELLFOUND_SECTION_HEADING_RE =
  /about the job|responsibilities|requirements|skill\(s\) required|about the company/i;

function abTextOf(el) {
  return (el?.innerText || el?.textContent || '').trim();
}

function abFirstMatch(selectors, root = document) {
  for (const sel of selectors) {
    const el = root.querySelector(sel);
    const t = abTextOf(el);
    if (t) return t;
  }
  return '';
}

function abCleanLine(value, maxLen = AB_MAX_FIELD) {
  return (value || '')
    .replace(/\s+/g, ' ')
    .replace(/^(PROMOTED|Actively Hiring)\s*/gi, '')
    .trim()
    .slice(0, maxLen);
}

function abCleanCompany(value) {
  let v = abCleanLine(value);
  v = v.split(/Actively Hiring|PROMOTED|Total raised/i)[0].trim();
  return v.slice(0, AB_MAX_FIELD);
}

function abCleanRole(value) {
  const v = abCleanLine(value, 120);
  if (JUNK_ROLE_RE.test(v)) return '';
  if (/\bnotifications?\b/i.test(v)) return '';
  if (/^(in office|remote|hybrid|full.?time|part.?time|internship|no equity)$/i.test(v)) return '';
  return v;
}

function abIsWellfoundJunkHeading(text) {
  const v = abCleanLine(text, 120);
  if (!v || v.length < 2) return true;
  if (JUNK_ROLE_RE.test(v)) return true;
  if (/\bnotifications?\b/i.test(v)) return true;
  if (WELLFOUND_SECTION_HEADING_RE.test(v)) return true;
  if (/^(in office|remote|hybrid|full.?time|part.?time|internship|no equity)$/i.test(v)) return true;
  return false;
}

function abWellfoundMainScope() {
  return document.querySelector('main, [role="main"]') || document.body;
}

function abWellfoundExtractRoleFromScope(scope) {
  let company = '';
  for (const link of scope.querySelectorAll('a[href*="/company/"], a[href*="/startups/"]')) {
    const text = abCleanCompany(abTextOf(link));
    if (text && text.length >= 2 && !JUNK_COMPANY_RE.test(text)) {
      company = text;
      break;
    }
  }

  const allHeadings = [...scope.querySelectorAll('h1, h2, h3, h4')];
  const aboutIdx = allHeadings.findIndex((el) => WELLFOUND_SECTION_HEADING_RE.test(abTextOf(el)));

  const candidates = [...scope.querySelectorAll('h1, h2, h3')]
    .map((el) => ({
      el,
      text: abCleanRole(abTextOf(el)),
      tag: el.tagName,
      idx: allHeadings.indexOf(el),
    }))
    .filter(({ text, el, idx }) => {
      if (!text || text.length < 2 || abIsWellfoundJunkHeading(text)) return false;
      if (company && text.toLowerCase() === company.toLowerCase()) return false;
      if (aboutIdx >= 0 && idx >= aboutIdx) return false;
      if (el.closest('nav, aside, [role="navigation"], [role="complementary"], header')) return false;
      return true;
    });

  const tagWeight = { H1: 3, H2: 2, H3: 1 };
  candidates.sort((a, b) => {
    const lenDiff = b.text.length - a.text.length;
    if (lenDiff !== 0) return lenDiff;
    return (tagWeight[b.tag] || 0) - (tagWeight[a.tag] || 0);
  });

  return { role: candidates[0]?.text || '', company };
}

function abBoardName() {
  const host = abHost();
  if (host.includes('linkedin.com')) return 'LinkedIn';
  if (host.includes('naukri.com')) return 'Naukri';
  if (host.includes('indeed.')) return 'Indeed';
  if (host.includes('wellfound.com') || host.includes('angel.co')) return 'Wellfound';
  if (host.includes('greenhouse.io')) return 'Greenhouse';
  if (host.includes('lever.co')) return 'Lever';
  if (host.includes('myworkdayjobs.com')) return 'Workday';
  return 'This site';
}

function abBuildResult(partial) {
  const role = abCleanRole(partial.role);
  const company = abCleanCompany(partial.company);
  const description = (partial.description || '').trim();
  const pageType = partial.pageType || 'unknown';
  const descLen = description.length;
  const roleOk = role.length >= 2 && !JUNK_ROLE_RE.test(role);
  const companyOk = company.length >= 2 && !JUNK_COMPANY_RE.test(company);
  const descOk = descLen >= AB_MIN_DESC;
  const ready = pageType === 'detail' && roleOk && companyOk && descOk;

  let message = partial.message || '';
  if (!message) {
    if (pageType === 'listing') {
      message = `Open a specific job on ${abBoardName()} — this looks like a search or list page.`;
    } else if (!descOk) {
      message = `Job description needs at least ${AB_MIN_DESC} characters. Paste the JD manually if needed.`;
    } else if (!roleOk || !companyOk) {
      message = 'Could not read role or company cleanly. Edit the fields below.';
    } else {
      message = 'Ready to capture.';
    }
  }

  return {
    role,
    company,
    description,
    source: partial.source || 'unknown',
    pageType,
    confidence: ready ? 'high' : pageType === 'detail' ? 'low' : 'none',
    ready,
    warning: !ready,
    message,
    descriptionLength: descLen,
  };
}

function abExtractLinkedIn() {
  const path = location.pathname.toLowerCase();
  const onView = path.includes('/jobs/view/') || path.includes('/job/view/');
  const detailPane = document.querySelector(
    '.jobs-description__content, #job-details, .jobs-box__html-content, .jobs-details__main-content',
  );
  if (!onView && !detailPane) {
    return abBuildResult({
      source: 'linkedin',
      pageType: 'listing',
      message: 'Select a job in the list (or open its full page) before capturing.',
    });
  }
  const root = detailPane?.closest('.jobs-search__job-details') || document;
  const role = abFirstMatch(
    [
      '.job-details-jobs-unified-top-card__job-title',
      '.top-card-layout__title',
      'h1.t-24',
    ],
    root,
  );
  const company = abFirstMatch(
    [
      '.job-details-jobs-unified-top-card__company-name',
      '.topcard__org-name-link',
      '.topcard__flavor a',
    ],
    root,
  );
  const description = abFirstMatch(
    [
      '.jobs-description__content',
      '#job-details',
      '.description__text',
      '.jobs-box__html-content',
    ],
    root,
  );
  return abBuildResult({ role, company, description, source: 'linkedin', pageType: 'detail' });
}

function abExtractNaukri() {
  const description = abFirstMatch([
    '.dang-inner-html',
    '.job-desc',
    '#job-description',
    '.styles_JDC__dang-inner-html__T2Ex6',
    '[class*="dang-inner-html"]',
  ]);
  if (!description) {
    return abBuildResult({
      source: 'naukri',
      pageType: 'listing',
      message: 'Open a job detail page on Naukri before capturing.',
    });
  }
  const role = abFirstMatch(['.jd-header-title', 'h1.styles_jd-header-title__HZwM1', '.jd-header h1', 'h1']);
  const company = abFirstMatch([
    '.jd-header-comp-name a',
    '.jd-header-comp-name',
    'a.styles_jd-header-comp-name__Mp0TV',
  ]);
  return abBuildResult({ role, company, description, source: 'naukri', pageType: 'detail' });
}

function abExtractIndeed() {
  const description = abFirstMatch([
    '#jobDescriptionText',
    '.jobsearch-jobDescriptionText',
    '[data-testid="jobsearch-JobComponent-description"]',
  ]);
  if (!description) {
    return abBuildResult({
      source: 'indeed',
      pageType: 'listing',
      message: 'Open a job detail page on Indeed before capturing.',
    });
  }
  const role = abFirstMatch([
    'h1.jobsearch-JobInfoHeader-title',
    '[data-testid="jobsearch-JobInfoHeader-title"]',
    'h1',
  ]);
  const company = abFirstMatch([
    '[data-company-name="true"]',
    '[data-testid="inlineHeader-companyName"] a',
    '[data-testid="inlineHeader-companyName"]',
  ]);
  return abBuildResult({ role, company, description, source: 'indeed', pageType: 'detail' });
}

function abHtmlToText(html) {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return abTextOf(tmp);
}

function abApolloUnpack(node, graph) {
  if (node && typeof node === 'object' && node.type === 'id' && node.id) {
    return abApolloUnpack(graph[node.id], graph);
  }
  if (Array.isArray(node)) return node.map((v) => abApolloUnpack(v, graph));
  if (node && typeof node === 'object') {
    const out = {};
    for (const k of Object.keys(node)) out[k] = abApolloUnpack(node[k], graph);
    return out;
  }
  return node;
}

function abWellfoundUrlSignals() {
  const params = new URLSearchParams(location.search);
  const slugParam =
    params.get('job_listing_slug') ||
    params.get('jobSlug') ||
    params.get('job_slug') ||
    null;
  const jobIdParam = params.get('jobId') || params.get('job_id') || params.get('job') || null;
  const pathMatch = location.pathname.match(/\/jobs\/(\d+)(?:-([\w-]+))?/i);
  const pathJobId = pathMatch?.[1] || null;
  const pathSlug = pathMatch?.[2] || null;
  return { slugParam, jobIdParam, pathJobId, pathSlug };
}

function abWellfoundListingMatches(node, signals) {
  const slug = String(node.slug || '');
  const id = String(node.id || '');
  if (signals.slugParam) {
    if (slug && signals.slugParam === slug) return true;
    if (signals.slugParam.startsWith(`${id}-`) && slug && signals.slugParam.endsWith(slug)) return true;
    if (id && signals.slugParam.startsWith(`${id}-`)) return true;
  }
  if (signals.jobIdParam && id && signals.jobIdParam === id) return true;
  if (signals.pathJobId && id && signals.pathJobId === id) return true;
  if (signals.pathSlug && slug && signals.pathSlug === slug) return true;
  return false;
}

function abWellfoundApolloGraph() {
  const script = document.getElementById('__NEXT_DATA__');
  if (!script?.textContent) return null;
  try {
    const parsed = JSON.parse(script.textContent);
    return (
      parsed?.props?.pageProps?.apolloState?.data ||
      parsed?.props?.pageProps?.__APOLLO_STATE__ ||
      null
    );
  } catch {
    return null;
  }
}

function abWellfoundGraphName(entityRef, graph) {
  if (!entityRef || !graph) return '';
  if (typeof entityRef === 'string') {
    const node =
      graph[entityRef] ||
      graph[`Startup:${entityRef}`] ||
      graph[`StartupResult:${entityRef}`];
    return node?.name || '';
  }
  if (entityRef?.type === 'id' && entityRef.id) {
    const node = graph[entityRef.id];
    if (node?.name) return node.name;
  }
  const unpacked = abApolloUnpack(entityRef, graph);
  if (typeof unpacked === 'string') return unpacked;
  return unpacked?.name || '';
}

function abWellfoundFindCompanyForJobId(graph, jobId) {
  const jobRef = `JobListingSearchResult:${jobId}`;
  for (const [key, node] of Object.entries(graph)) {
    if (!key.startsWith('StartupResult:') && !key.startsWith('Startup:')) continue;
    const listings = node.highlightedJobListings || node.jobListings || [];
    for (const ref of listings) {
      const refId = typeof ref === 'string' ? ref : ref?.id;
      if (refId === jobRef || refId === String(jobId)) return node.name || '';
    }
  }
  return '';
}

function abWellfoundListingCompany(listing, graph) {
  return (
    abWellfoundGraphName(listing.startup, graph) ||
    listing.startupName ||
    listing.companyName ||
    (listing.id ? abWellfoundFindCompanyForJobId(graph, listing.id) : '') ||
    ''
  );
}

function abTitleCaseSlug(value) {
  return String(value || '')
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function abParseWellfoundUrlSlug() {
  const signals = abWellfoundUrlSignals();
  const slug = signals.slugParam || (signals.pathSlug ? `${signals.pathJobId || ''}-${signals.pathSlug}` : '');
  if (!slug) return null;
  const match = slug.match(/^(?:\d+-)?(.+)$/);
  if (!match?.[1]) return null;
  const role = abTitleCaseSlug(match[1]);
  return role ? { role, company: '', description: '' } : null;
}

function abParseWellfoundPageMeta() {
  const candidates = [
    document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '',
    document.title || '',
  ];
  for (const raw of candidates) {
    const cleaned = raw.replace(/\s*[·|]\s*Wellfound.*$/i, '').trim();
    const match =
      cleaned.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i) ||
      cleaned.match(/^(.+?)\s+[–-]\s+(.+)$/);
    if (!match) continue;
    const role = abCleanRole(match[1]);
    const company = abCleanCompany(match[2]);
    if (role || company) return { role, company, description: '' };
  }
  return null;
}

function abMergeWellfoundFields(...parts) {
  const merged = { role: '', company: '', description: '' };
  for (const part of parts) {
    if (!part) continue;
    const role = abCleanRole(part.role);
    const company = abCleanCompany(part.company);
    if (role && role.length > merged.role.length) merged.role = role;
    if (company && (!merged.company || company.length >= merged.company.length)) merged.company = company;
    if (part.description && part.description.length > merged.description.length) {
      merged.description = part.description;
    }
  }
  return merged;
}

function abWellfoundNodeDescription(node) {
  const raw = node.description || node.descriptionSnippet || '';
  if (!raw) return '';
  return raw.includes('<') ? abHtmlToText(raw) : String(raw).trim();
}

function abParseWellfoundApollo() {
  const graph = abWellfoundApolloGraph();
  if (!graph) return null;

  try {
    const signals = abWellfoundUrlSignals();
    const fullListings = [];
    const searchResults = [];

    for (const [key, node] of Object.entries(graph)) {
      if (!node || typeof node !== 'object') continue;
      if (key.startsWith('JobListing:')) fullListings.push({ key, node });
      else if (key.startsWith('JobListingSearchResult:')) searchResults.push({ key, node });
    }

    const pickFrom = (entries) => {
      if (!entries.length) return null;
      const matched = entries.filter(({ node }) => abWellfoundListingMatches(node, signals));
      if (matched.length === 1) return matched[0].node;
      if (matched.length > 1) {
        return matched.sort(
          (a, b) => abWellfoundNodeDescription(b.node).length - abWellfoundNodeDescription(a.node).length,
        )[0].node;
      }
      if (entries.length === 1) return entries[0].node;
      return null;
    };

    let listing = pickFrom(fullListings) || pickFrom(searchResults);
    if (!listing) {
      const candidates = [...fullListings, ...searchResults]
        .map(({ node }) => node)
        .filter((node) => abWellfoundNodeDescription(node).length >= AB_MIN_DESC);
      if (candidates.length === 1) listing = candidates[0];
      else if (candidates.length > 1) {
        listing = candidates.sort(
          (a, b) => abWellfoundNodeDescription(b).length - abWellfoundNodeDescription(a).length,
        )[0];
      }
    }
    if (!listing) return null;

    const role = listing.title || listing.primaryRoleTitle || '';
    const company = abWellfoundListingCompany(listing, graph);
    const description = abWellfoundNodeDescription(listing);
    if (!description && !role && !company) return null;
    return { role, company, description };
  } catch {
    return null;
  }
}

function abParseWellfoundJsonLd() {
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(script.textContent || '');
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        const type = node['@type'];
        if (type !== 'JobPosting' && !(Array.isArray(type) && type.includes('JobPosting'))) continue;
        const org = node.hiringOrganization || {};
        const company = typeof org === 'string' ? org : org.name || '';
        const role = node.title || node.name || '';
        const description = abHtmlToText(node.description || '');
        if (description.length >= AB_MIN_DESC) return { role, company, description };
      }
    } catch {
      /* ignore malformed JSON-LD */
    }
  }
  return null;
}

function abExtractWellfoundLegacyDom() {
  const detailRoot =
    document.querySelector('[data-test="JobDetail"], [data-test="JobPage"]') ||
    document.querySelector('[data-test="JobDescription"]')?.closest('div') ||
    abWellfoundMainScope();

  let role = abTextOf(detailRoot.querySelector('[data-test="JobTitle"], [data-test="job-title"]'));
  let company = abTextOf(
    detailRoot.querySelector('[data-test="StartupLink"], [data-test="CompanyName"]'),
  );

  if (!role || abIsWellfoundJunkHeading(role)) {
    const extracted = abWellfoundExtractRoleFromScope(detailRoot);
    role = extracted.role;
    if (!company) company = extracted.company;
  }

  const description = abTextOf(
    detailRoot.querySelector('[data-test="JobDescription"], [data-test="job-description"]'),
  );
  if (description.length < AB_MIN_DESC) return null;
  return { role, company, description };
}

function abWellfoundHeadingContainer() {
  const headingRe = /about the job|responsibilities|requirements|skill\(s\) required/i;
  for (const el of document.querySelectorAll('h1, h2, h3, h4, h5, h6, strong, b')) {
    const label = abTextOf(el);
    if (!headingRe.test(label)) continue;
    let container = el.closest('section, article, main') || el.parentElement;
    for (let depth = 0; depth < 6 && container; depth += 1) {
      const text = abTextOf(container);
      if (text.length >= 200) return container;
      container = container.parentElement;
    }
  }
  return null;
}

function abExtractWellfoundSemanticDom() {
  const container = abWellfoundHeadingContainer();
  if (!container) return null;

  const description = abTextOf(container);
  if (description.length < AB_MIN_DESC) return null;

  const scope = container.closest('main, [role="main"]') || abWellfoundMainScope();
  const { role, company: companyFromScope } = abWellfoundExtractRoleFromScope(scope);
  let company = companyFromScope;

  if (!company) {
    for (const el of scope.querySelectorAll(
      '[class*="company"], [class*="Company"], [class*="startup"], [class*="Startup"], [data-test*="company"], [data-test*="startup"]',
    )) {
      const text = abCleanCompany(abTextOf(el));
      if (text && text.length >= 2) {
        company = text;
        break;
      }
    }
  }

  return { role, company, description };
}

function abIsWellfoundJobDetail() {
  const signals = abWellfoundUrlSignals();
  if (/\/jobs\/\d+/i.test(location.pathname)) return true;
  if (/\/l\/[\w-]+/i.test(location.pathname)) return true;
  if (signals.slugParam || signals.jobIdParam) return true;

  const apollo = abParseWellfoundApollo();
  if (apollo?.description?.length >= AB_MIN_DESC) return true;

  const jsonLd = abParseWellfoundJsonLd();
  if (jsonLd?.description?.length >= AB_MIN_DESC) return true;

  const legacy = abExtractWellfoundLegacyDom();
  if (legacy?.description?.length >= AB_MIN_DESC) return true;

  const semantic = abExtractWellfoundSemanticDom();
  if (semantic?.description?.length >= AB_MIN_DESC) return true;

  return false;
}

function abExtractWellfound() {
  const extracted = abMergeWellfoundFields(
    abParseWellfoundApollo(),
    abParseWellfoundJsonLd(),
    abExtractWellfoundLegacyDom(),
    abExtractWellfoundSemanticDom(),
    abParseWellfoundPageMeta(),
    abParseWellfoundUrlSlug(),
  );

  if (!extracted.description || extracted.description.length < AB_MIN_DESC) {
    return abBuildResult({
      source: 'wellfound',
      pageType: 'listing',
      message: 'Click a job in the list so its description appears, then capture.',
    });
  }

  return abBuildResult({
    role: extracted.role,
    company: extracted.company,
    description: extracted.description,
    source: 'wellfound',
    pageType: 'detail',
  });
}

function abExtractGreenhouse() {
  const description = abFirstMatch(['#content', '#content .content', '.job__description', '[data-qa="job-description"]']);
  const role = abFirstMatch(['h1.app-title', '.app-title', 'h1']);
  const company =
    abFirstMatch(['.company-name', '#header .company-name']) ||
    document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ||
    '';
  return abBuildResult({
    role,
    company,
    description,
    source: 'greenhouse',
    pageType: description ? 'detail' : 'listing',
  });
}

function abExtractLever() {
  const description = abFirstMatch([
    '.posting-page .content',
    '.section-wrapper .content',
    '.posting-description',
  ]);
  const role = abFirstMatch(['.posting-headline h2', '.posting-headline h1', 'h2']);
  const company =
    abFirstMatch(['.posting-header .company-name']) ||
    document.querySelector('.main-header-logo img')?.getAttribute('alt') ||
    '';
  return abBuildResult({
    role,
    company,
    description,
    source: 'lever',
    pageType: description ? 'detail' : 'listing',
  });
}

function abExtractWorkday() {
  const description = abFirstMatch([
    '[data-automation-id="jobPostingDescription"]',
    '[data-automation-id="jobPostingJobDescription"]',
  ]);
  const role = abFirstMatch(['[data-automation-id="jobPostingHeader"] h1', 'h1[data-automation-id="jobTitle"]', 'h1']);
  const company =
    abFirstMatch(['[data-automation-id="subtitle"]']) ||
    document.querySelector('[data-automation-id="companyLogoContainer"] img')?.getAttribute('alt') ||
    '';
  return abBuildResult({
    role,
    company,
    description,
    source: 'workday',
    pageType: description ? 'detail' : 'listing',
  });
}

function abExtractJobPage() {
  const host = abHost();
  if (host.includes('linkedin.com')) return abExtractLinkedIn();
  if (host.includes('naukri.com')) return abExtractNaukri();
  if (host.includes('indeed.')) return abExtractIndeed();
  if (host.includes('wellfound.com') || host.includes('angel.co')) return abExtractWellfound();
  if (host.includes('greenhouse.io')) return abExtractGreenhouse();
  if (host.includes('lever.co')) return abExtractLever();
  if (host.includes('myworkdayjobs.com') || host.includes('myworkdaysite.com')) return abExtractWorkday();
  return abBuildResult({
    source: 'unknown',
    pageType: 'unknown',
    message: 'Unsupported page. Paste the job description manually.',
  });
}

function abValidateCaptureFields({ profileId, company, role, description }) {
  const errors = [];
  if (!profileId || Number.isNaN(Number(profileId))) errors.push('Select a profile.');
  if (!role || role.length < 2) errors.push('Role is required (min 2 characters).');
  if (!company || company.length < 2) errors.push('Company is required (min 2 characters).');
  if (!description || description.trim().length < AB_MIN_DESC) {
    errors.push(`Description must be at least ${AB_MIN_DESC} characters.`);
  }
  return errors;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AB_MIN_DESC,
    abBuildResult,
    abExtractWellfound,
    abExtractJobPage,
    abIsWellfoundJobDetail,
    abParseWellfoundApollo,
    abExtractWellfoundSemanticDom,
    abMergeWellfoundFields,
    abParseWellfoundPageMeta,
    abParseWellfoundUrlSlug,
  };
}
