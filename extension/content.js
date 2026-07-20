function textOf(el) {
  return (el?.innerText || el?.textContent || '').trim();
}

function firstMatch(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const t = textOf(el);
    if (t) return t;
  }
  return '';
}

function extractLinkedIn() {
  const role = firstMatch([
    '.job-details-jobs-unified-top-card__job-title',
    '.top-card-layout__title',
    'h1.t-24',
    'h1',
  ]);
  const company = firstMatch([
    '.job-details-jobs-unified-top-card__company-name',
    '.topcard__org-name-link',
    '.topcard__flavor a',
  ]);
  const description = firstMatch([
    '.jobs-description__content',
    '#job-details',
    '.description__text',
    '.jobs-box__html-content',
  ]);
  return { role, company, description, source: 'linkedin', warning: !description };
}

function extractNaukri() {
  const role = firstMatch([
    '.jd-header-title',
    'h1.styles_jd-header-title__HZwM1',
    '.jd-header h1',
    'h1',
  ]);
  const company = firstMatch([
    '.jd-header-comp-name a',
    '.jd-header-comp-name',
    'a.styles_jd-header-comp-name__Mp0TV',
    '.company-info a',
  ]);
  const description = firstMatch([
    '.dang-inner-html',
    '.job-desc',
    '#job-description',
    '.styles_JDC__dang-inner-html__T2Ex6',
    '[class*="dang-inner-html"]',
  ]);
  return { role, company, description, source: 'naukri', warning: !description };
}

function extractIndeed() {
  const role = firstMatch([
    'h1.jobsearch-JobInfoHeader-title',
    '[data-testid="jobsearch-JobInfoHeader-title"]',
    '.jobsearch-JobInfoHeader-title',
    'h1',
  ]);
  const company = firstMatch([
    '[data-company-name="true"]',
    '[data-testid="inlineHeader-companyName"] a',
    '[data-testid="inlineHeader-companyName"]',
    '.jobsearch-InlineCompanyRating a',
    'div[data-company-name]',
  ]);
  const description = firstMatch([
    '#jobDescriptionText',
    '.jobsearch-jobDescriptionText',
    '[data-testid="jobsearch-JobComponent-description"]',
  ]);
  return { role, company, description, source: 'indeed', warning: !description };
}

function extractWellfound() {
  const role = firstMatch([
    'h1',
    '[data-test="JobTitle"]',
    '.styles_title__',
  ]);
  const company = firstMatch([
    'a[href*="/company/"]',
    '[data-test="StartupLink"]',
    'header a[href*="/company"]',
  ]);
  const description = firstMatch([
    '[data-test="JobDescription"]',
    '.styles_description__',
    'section[class*="description"]',
    'article',
  ]);
  return { role, company, description, source: 'wellfound', warning: !description };
}

function extractGreenhouse() {
  const role = firstMatch([
    'h1.app-title',
    '.app-title',
    'h1',
  ]);
  const company = firstMatch([
    '.company-name',
    '#header .company-name',
    'meta[property="og:site_name"]',
  ]) || (document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || '');
  const description = firstMatch([
    '#content',
    '#content .content',
    '.job__description',
    '[data-qa="job-description"]',
  ]);
  return { role, company, description, source: 'greenhouse', warning: !description };
}

function extractLever() {
  const role = firstMatch([
    '.posting-headline h2',
    '.posting-headline h1',
    'h2',
    'h1',
  ]);
  const company = firstMatch([
    '.main-header-logo img[alt]',
    '.posting-header .company-name',
  ]) || (document.querySelector('.main-header-logo img')?.getAttribute('alt') || '');
  const description = firstMatch([
    '.posting-page .content',
    '.section-wrapper .content',
    '.posting-description',
    '[data-qa="job-description"]',
  ]);
  return { role, company, description, source: 'lever', warning: !description };
}

function extractFallback() {
  // Last resort — never preferred. Popup should warn the user to paste JD manually.
  const role = firstMatch(['h1', 'h2']);
  return {
    role,
    company: '',
    description: '',
    source: 'fallback',
    warning: true,
  };
}

function extractByHost() {
  const host = (location.hostname || '').toLowerCase();
  if (host.includes('linkedin.com')) return extractLinkedIn();
  if (host.includes('naukri.com')) return extractNaukri();
  if (host.includes('indeed.')) return extractIndeed();
  if (host.includes('wellfound.com') || host.includes('angel.co')) return extractWellfound();
  if (host.includes('greenhouse.io')) return extractGreenhouse();
  if (host.includes('lever.co')) return extractLever();
  return extractFallback();
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'GET_JD') {
    sendResponse(extractByHost());
  }
  return true;
});
