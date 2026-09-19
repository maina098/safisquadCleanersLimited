const test = require('node:test');
const assert = require('node:assert/strict');

const { buildAdminOverview, buildSettlementPlan, summarizeAuditLogs } = require('../ops');

test('buildAdminOverview creates revenue, status and trend summary', () => {
  const orders = [
    { id: 1, status: 'Pending', estimated_cost: 3000, preferred_date: '2026-09-15', service: 'Laundry' },
    { id: 2, status: 'In-Progress', estimated_cost: 5000, preferred_date: '2026-09-16', service: '2 Bedroom deep clean' },
    { id: 3, status: 'Delivered', estimated_cost: 7000, preferred_date: '2026-09-17', service: 'Laundry' },
    { id: 4, status: 'QC Passed', estimated_cost: 10000, preferred_date: '2026-09-18', service: 'Small office cleaning' },
  ];

  const report = buildAdminOverview(orders);
  assert.equal(report.totalOrders, 4);
  assert.equal(report.activeOrders, 3);
  assert.equal(report.revenue, 25000);
  assert.equal(report.statusBreakdown.Pending, 1);
  assert.equal(report.trend[0].date, '2026-09-15');
});

test('buildSettlementPlan allocates payouts based on revenue and contributor hours', () => {
  const plan = buildSettlementPlan({
    revenue: 20000,
    restockAllocation: 3000,
    contingencyBuffer: 2000,
    memberHours: [
      { user_id: 1, hours: 10 },
      { user_id: 2, hours: 20 },
    ],
  });

  assert.equal(plan.growthFund, 2250);
  assert.equal(plan.distributableAmount, 12750);
  assert.equal(plan.payouts[0].user_id, 1);
  assert.equal(plan.payouts[1].amount, 8500);
});

test('summarizeAuditLogs groups events and highlights critical actions', () => {
  const summary = summarizeAuditLogs([
    { action: 'ORDER_CREATED', entity_type: 'ORDER', created_at: '2026-09-17T08:00:00Z' },
    { action: 'ORDER_STATUS_UPDATED', entity_type: 'ORDER', created_at: '2026-09-17T09:00:00Z' },
    { action: 'ORDER_STATUS_UPDATED', entity_type: 'ORDER', created_at: '2026-09-17T10:00:00Z' },
  ]);

  assert.equal(summary.totalEvents, 3);
  assert.equal(summary.actions.ORDER_CREATED, 1);
  assert.equal(summary.actions.ORDER_STATUS_UPDATED, 2);
  assert.equal(summary.highRiskActions.includes('ORDER_STATUS_UPDATED'), true);
});
