const test = require('node:test');
const assert = require('node:assert/strict');

const { calculateServiceAmount, normalizeOrderInput, isRoleAllowed } = require('../validators');

test('calculateServiceAmount totals known services correctly', () => {
  const result = calculateServiceAmount('house-deep-cleaning', 2);
  assert.equal(result.total, 11000);
  assert.equal(result.service.name, '2 Bedroom deep clean');
});

test('normalizeOrderInput rejects missing essential booking fields', () => {
  const result = normalizeOrderInput({ name: 'Jane', phone: '0712345678' });
  assert.equal(result.ok, false);
  assert.ok(Array.isArray(result.errors));
});

test('role guard accepts allowed roles and rejects unauthorized access', () => {
  assert.equal(isRoleAllowed('MANAGEMENT', ['SECRETARIAT', 'MANAGEMENT']), true);
  assert.equal(isRoleAllowed('CUSTOMER', ['MANAGEMENT', 'FINANCE']), false);
});
