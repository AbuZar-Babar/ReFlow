/**
 * Regression tests for ConditionEvaluator compound match modes.
 *
 * The shared item-filter contract uses `matchMode: 'all' | 'any'`. ConditionEvaluator
 * previously ignored it and always ANDed conditions, so an 'any' filter whose first
 * condition failed never matched even when a later condition passed.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { ConditionEvaluator } = require('../src/shared/condition-evaluator');

const item = {
  'Invoice Number': 'INV-1001',
  Status: 'New',
  Amount: '$1,250.00',
};

const filterAny = {
  matchMode: 'any',
  conditions: [
    { field: 'Status', operator: 'equals', value: 'Paid' },
    { field: 'Amount', operator: 'greater_than', value: '100' },
  ],
};

test('ConditionEvaluator - matchMode any matches when the first condition fails and a later one passes', () => {
  const result = ConditionEvaluator.evaluate(item, filterAny);
  assert.strictEqual(result.matches, true);
  assert.strictEqual(result.failedRule, null);
});

test('ConditionEvaluator - absent matchMode defaults to all (AND)', () => {
  const defaultModeFilter = {
    conditions: filterAny.conditions,
  };

  const result = ConditionEvaluator.evaluate(item, defaultModeFilter);
  assert.strictEqual(result.matches, false);
  assert.strictEqual(result.failedRule.field, 'Status');
});

test('ConditionEvaluator - explicit matchMode all still requires every condition', () => {
  const result = ConditionEvaluator.evaluate(item, {
    ...filterAny,
    matchMode: 'all',
  });
  assert.strictEqual(result.matches, false);
  assert.strictEqual(result.failedRule.field, 'Status');
});

test('ConditionEvaluator - matchMode any does not match when every condition fails', () => {
  const result = ConditionEvaluator.evaluate(item, {
    matchMode: 'any',
    conditions: [
      { field: 'Status', operator: 'equals', value: 'Paid' },
      { field: 'Amount', operator: 'less_than', value: '10' },
    ],
  });
  assert.strictEqual(result.matches, false);
  assert.match(result.reason, /Did not match any OR conditions/);
});

test('ConditionEvaluator - legacy matchType OR is still honoured', () => {
  const result = ConditionEvaluator.evaluate(item, {
    matchType: 'OR',
    conditions: filterAny.conditions,
  });
  assert.strictEqual(result.matches, true);
});
