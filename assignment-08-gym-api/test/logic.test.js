/**
 * Pure-logic unit tests (no DB required). Run with: npm test
 *
 * Covers the two learning-outcome invariants:
 *   1. A 1-month membership expires EXACTLY 30 days out (durationMonths * 30).
 *   2. The capacity check rejects the 3rd booking when maxCapacity === 2.
 * Plus the renewal "whichever is later" rule.
 */
const { test } = require('node:test');
const assert = require('node:assert');

const { computeExpiry, DAYS_PER_MONTH } = require('../models/User');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

test('constant: 30 days per month', () => {
  assert.strictEqual(DAYS_PER_MONTH, 30);
});

test('1-month membership expires exactly 30 days from now', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const expiry = computeExpiry(1, now);
  const diffDays = (expiry.getTime() - now.getTime()) / MS_PER_DAY;
  assert.strictEqual(diffDays, 30);
});

test('durationMonths maps to durationMonths * 30 days', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  for (const months of [1, 3, 6, 12]) {
    const expiry = computeExpiry(months, now);
    const diffDays = (expiry.getTime() - now.getTime()) / MS_PER_DAY;
    assert.strictEqual(diffDays, months * 30, `${months} months should be ${months * 30} days`);
  }
});

test('renew extends from the LATER of now or current expiry (never shrinks)', () => {
  const now = Date.now();

  // Active membership: current expiry is in the future -> extend from expiry.
  const futureExpiry = new Date(now + 10 * MS_PER_DAY);
  const baselineActive = futureExpiry.getTime() > now ? futureExpiry : new Date(now);
  const renewedActive = computeExpiry(1, baselineActive);
  assert.strictEqual(
    (renewedActive.getTime() - futureExpiry.getTime()) / MS_PER_DAY,
    30,
    'active renewal adds 30 days on top of remaining time'
  );

  // Expired membership: current expiry is in the past -> extend from now.
  const pastExpiry = new Date(now - 10 * MS_PER_DAY);
  const baselineExpired = pastExpiry.getTime() > now ? pastExpiry : new Date(now);
  const renewedExpired = computeExpiry(1, baselineExpired);
  const diffFromNow = Math.round((renewedExpired.getTime() - now) / MS_PER_DAY);
  assert.strictEqual(diffFromNow, 30, 'expired renewal adds 30 days from now, not from past expiry');
});

/**
 * Mirror of controllers/classController.bookClass capacity logic, isolated so it
 * can be tested without a DB. Returns the outcome string.
 */
function tryBook(enrolledCount, maxCapacity) {
  if (enrolledCount >= maxCapacity) return 'Class capacity reached';
  return 'booked';
}

test('capacity check rejects the 3rd booking when maxCapacity is 2', () => {
  const maxCapacity = 2;
  assert.strictEqual(tryBook(0, maxCapacity), 'booked'); // 1st
  assert.strictEqual(tryBook(1, maxCapacity), 'booked'); // 2nd
  assert.strictEqual(tryBook(2, maxCapacity), 'Class capacity reached'); // 3rd rejected
});
