const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe('Apply Assist form fill fixtures', () => {
  test('greenhouse fixture accepts native value fill', async ({ page }) => {
    const html = fs.readFileSync(path.join(__dirname, 'fixtures/greenhouse-apply.html'), 'utf8');
    await page.setContent(html);
    await page.addScriptTag({ path: path.join(__dirname, '../form-utils.js') });

    const filled = await page.evaluate(() => {
      const input = document.getElementById('email');
      abSetNativeValue(input, 'alex@example.com');
      return input.value;
    });
    expect(filled).toBe('alex@example.com');
  });

  test('lever fixture fills by label', async ({ page }) => {
    const html = fs.readFileSync(path.join(__dirname, 'fixtures/lever-apply.html'), 'utf8');
    await page.setContent(html);
    await page.addScriptTag({ path: path.join(__dirname, '../form-utils.js') });

    const ok = await page.evaluate(() => {
      const q = { id: 'comments', label: 'Why are you interested in this role?' };
      const target = abResolveFieldTarget(q);
      return abFillAnswer(target, 'Strong product fit.');
    });
    expect(ok).toBe(true);
  });
});
