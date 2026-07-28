const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const EXTRACTOR_PATH = path.join(__dirname, '..', 'jd-extract.js');

function loadExtractor(dom) {
  const extractorSrc = fs.readFileSync(EXTRACTOR_PATH, 'utf8');
  dom.window.eval(extractorSrc);
  return dom.window;
}

function loadFixture(name, url) {
  const html = fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8');
  const dom = new JSDOM(html, {
    url,
    runScripts: 'outside-only',
    virtualConsole: new VirtualConsole(),
  });
  return loadExtractor(dom);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runTests() {
  const cases = [];

  cases.push(() => {
    const win = loadFixture(
      'wellfound-apollo.html',
      'https://wellfound.com/jobs?job_listing_slug=3331607-full-stack-engineer',
    );
    const result = win.abExtractWellfound();
    assert(result.pageType === 'detail', `expected detail page, got ${result.pageType}`);
    assert(result.role === 'Full Stack Engineer', `unexpected role: ${result.role}`);
    assert(result.company === 'Example Corp', `unexpected company: ${result.company}`);
    assert(result.description.includes('React and PostgreSQL'), 'missing description body');
    assert(result.ready === true, 'expected ready capture state');
  });

  cases.push(() => {
    const win = loadFixture('wellfound-semantic.html', 'https://wellfound.com/jobs?job_listing_slug=999-demo');
    const result = win.abExtractWellfound();
    assert(result.pageType === 'detail', `expected detail page, got ${result.pageType}`);
    assert(result.role === 'Full Stack Engineer', `unexpected role: ${result.role}`);
    assert(result.company === 'Example Corp', `unexpected company: ${result.company}`);
    assert(result.description.includes('Responsibilities'), 'missing semantic description');
    assert(result.ready === true, 'expected ready capture state');
  });

  cases.push(() => {
    const win = loadFixture('wellfound-listing.html', 'https://wellfound.com/jobs');
    const result = win.abExtractWellfound();
    assert(result.pageType === 'listing', `expected listing page, got ${result.pageType}`);
    assert(result.confidence === 'none', `expected confidence none, got ${result.confidence}`);
    assert(result.ready === false, 'listing page should not be ready');
  });

  cases.push(() => {
    const win = loadFixture(
      'wellfound-apollo.html',
      'https://wellfound.com/jobs/3331607-full-stack-engineer',
    );
    assert(win.abIsWellfoundJobDetail() === true, 'direct job URL should count as detail');
  });

  cases.push(() => {
    const win = loadFixture(
      'wellfound-search-result.html',
      'https://wellfound.com/jobs?job_listing_slug=3331607-full-stack-engineer',
    );
    const result = win.abExtractWellfound();
    assert(result.pageType === 'detail', `expected detail page, got ${result.pageType}`);
    assert(result.role === 'Full Stack Engineer', `unexpected role: ${result.role}`);
    assert(result.company === 'Acme Startup', `unexpected company: ${result.company}`);
    assert(result.description.includes('React and PostgreSQL'), 'expected merged semantic description');
    assert(result.ready === true, 'expected ready capture state');
  });

  cases.push(() => {
    const win = loadFixture('wellfound-listing.html', 'https://wellfound.com/jobs');
    const slugOnly = win.abParseWellfoundUrlSlug();
    assert(slugOnly === null, 'listing page should not derive role from missing slug');
    win.history.replaceState({}, '', 'https://wellfound.com/jobs?job_listing_slug=3331607-full-stack-engineer');
    const merged = win.abMergeWellfoundFields(
      { role: '', company: '', description: 'x'.repeat(25) },
      win.abParseWellfoundUrlSlug(),
      win.abParseWellfoundPageMeta(),
    );
    assert(merged.role === 'Full Stack Engineer', `unexpected merged role: ${merged.role}`);
  });

  let passed = 0;
  for (const [index, testCase] of cases.entries()) {
    testCase();
    passed += 1;
    console.log(`ok ${index + 1}`);
  }
  console.log(`\n${passed}/${cases.length} passed`);
}

runTests();
