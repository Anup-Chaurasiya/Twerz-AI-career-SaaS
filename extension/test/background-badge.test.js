const { abMapBadgeFromStatus } = require('../badge-utils.js');
const assert = require('assert');

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

console.log('background-badge.test.js');

test('ready shows checkmark', () => {
  const b = abMapBadgeFromStatus({ ready_to_apply: true, phase: 'ready_to_apply' });
  assert.strictEqual(b.text, '✓');
});

test('captured shows dot', () => {
  const b = abMapBadgeFromStatus({ phase: 'captured', ready_to_apply: false });
  assert.strictEqual(b.text, '.');
});

test('fit_analyzed shows score', () => {
  const b = abMapBadgeFromStatus({ phase: 'fit_analyzed', fit_score: 87, ready_to_apply: false });
  assert.strictEqual(b.text, '87');
});

test('generating shows ellipsis', () => {
  const b = abMapBadgeFromStatus({ phase: 'generating', ready_to_apply: false });
  assert.strictEqual(b.text, '…');
});

test('failed shows bang', () => {
  const b = abMapBadgeFromStatus({ phase: 'failed', ready_to_apply: false });
  assert.strictEqual(b.text, '!');
});

console.log('All badge tests passed.');
