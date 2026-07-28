const {
  abDefensiveStatus,
  abBlockReasonLabel,
  abGenerationButtonLabel,
} = require('../telemetry.js');
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

console.log('capture-flow.test.js');

test('defensive status fills missing fields', () => {
  const s = abDefensiveStatus({ fit_score: 80 });
  assert.deepStrictEqual(s.gap_list, []);
  assert.strictEqual(s.can_generate, false);
  assert.strictEqual(s.effective_generation_cost, 10);
});

test('block reason labels', () => {
  assert.match(abBlockReasonLabel('no_credits'), /No credits/);
  assert.match(abBlockReasonLabel('low_fit_unconfirmed'), /stretch/i);
});

test('generation button unlimited', () => {
  const label = abGenerationButtonLabel({ has_unlimited: true, effective_generation_cost: 0 });
  assert.match(label, /unlimited/i);
});

test('generation button shows cost', () => {
  const label = abGenerationButtonLabel({ has_unlimited: false, effective_generation_cost: 10 });
  assert.match(label, /10 credit/);
});

console.log('All capture-flow helper tests passed.');
