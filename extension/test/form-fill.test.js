const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const assert = require('assert');
const vm = require('vm');

function loadFormUtils(dom) {
  const code = fs.readFileSync(path.join(__dirname, '../form-utils.js'), 'utf8');
  const context = {
    document: dom.window.document,
    window: dom.window,
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
    HTMLSelectElement: dom.window.HTMLSelectElement,
    Event: dom.window.Event,
    InputEvent: dom.window.InputEvent,
    File: dom.window.File,
    DataTransfer: dom.window.DataTransfer,
    chrome: { runtime: { sendMessage: () => {}, getURL: (p) => p } },
    console,
  };
  vm.createContext(context);
  vm.runInContext(code, context);
  return context;
}

function test(name, fn) {
  return fn()
    .then(() => console.log(`  ✓ ${name}`))
    .catch((err) => {
      console.error(`  ✗ ${name}`);
      throw err;
    });
}

async function run() {
  console.log('form-fill.test.js');

  await test('greenhouse fixture fills text input via native setter', async () => {
    const html = fs.readFileSync(path.join(__dirname, 'fixtures/greenhouse-apply.html'), 'utf8');
    const dom = new JSDOM(html, { runScripts: 'outside-only' });
    const ctx = loadFormUtils(dom);
    const first = dom.window.document.getElementById('first_name');
    assert.ok(ctx.abFillAnswer(first, 'Alex'));
    assert.strictEqual(first.value, 'Alex');
  });

  await test('greenhouse fixture sets cover letter textarea', async () => {
    const html = fs.readFileSync(path.join(__dirname, 'fixtures/greenhouse-apply.html'), 'utf8');
    const dom = new JSDOM(html, { runScripts: 'outside-only' });
    const ctx = loadFormUtils(dom);
    const cover = dom.window.document.getElementById('cover_letter');
    ctx.abSetNativeValue(cover, 'Dear team, excited to apply.');
    assert.strictEqual(cover.value, 'Dear team, excited to apply.');
  });

  await test('lever fixture resolves field by label', async () => {
    const html = fs.readFileSync(path.join(__dirname, 'fixtures/lever-apply.html'), 'utf8');
    const dom = new JSDOM(html, { runScripts: 'outside-only' });
    const ctx = loadFormUtils(dom);
    const target = ctx.abResolveFieldTarget({ id: 'email', label: 'Email' });
    assert.ok(target);
    assert.ok(ctx.abFillAnswer(target, 'alex@example.com'));
    assert.strictEqual(target.value, 'alex@example.com');
  });

  await test('partial fill tracks skipped fields', async () => {
    const html = fs.readFileSync(path.join(__dirname, 'fixtures/greenhouse-apply.html'), 'utf8');
    const dom = new JSDOM(html, { runScripts: 'outside-only' });
    const ctx = loadFormUtils(dom);
    const questions = [
      { id: 'first_name', label: 'First Name' },
      { id: 'missing_field', label: 'Missing Field' },
    ];
    let filled = 0;
    const skipped = [];
    for (const q of questions) {
      const target = ctx.abResolveFieldTarget(q);
      if (ctx.abFillAnswer(target, 'value')) filled += 1;
      else skipped.push(q.label);
    }
    assert.strictEqual(filled, 1);
    assert.deepStrictEqual(skipped, ['Missing Field']);
  });

  console.log('All form-fill tests passed.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
