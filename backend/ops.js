const { decimal, money } = require('./money');

function buildAdminOverview(orders = []) {
  const normalized = Array.isArray(orders) ? orders : [];
  const activeOrders = normalized.filter((order) => !['Delivered', 'CANCELLED'].includes(order.status)).length;
  const pendingPickup = normalized.filter((order) => order.status === 'Pending').length;
  const qcQueue = normalized.filter((order) => order.status === 'QC Passed').length;
  const revenue = money(normalized.reduce((total, order) => total.plus(order.estimated_cost || order.deposit_paid || 0), decimal(0)));

  const statusBreakdown = normalized.reduce((accumulator, order) => {
    const status = order.status || 'Pending';
    accumulator[status] = (accumulator[status] || 0) + 1;
    return accumulator;
  }, {});

  const trend = normalized
    .map((order) => ({
      date: order.preferred_date || order.created_at || new Date().toISOString().slice(0, 10),
      amount: money(order.estimated_cost || order.deposit_paid || 0),
      status: order.status || 'Pending',
    }))
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(-7);

  return {
    totalOrders: normalized.length,
    activeOrders,
    pendingPickup,
    qcQueue,
    revenue,
    statusBreakdown,
    trend,
    recent: normalized.slice(0, 6).map((order) => ({
      id: order.id,
      tracking_code: order.tracking_code || order.id,
      customer_name: order.customer_name || order.name || 'Customer',
      service: order.service || 'General care',
      status: order.status || 'Pending',
      preferred_date: order.preferred_date || order.preferredDate || null,
      estimated_cost: money(order.estimated_cost || 0),
    })),
  };
}

function buildSettlementPlan({ revenue = 0, restockAllocation = 0, contingencyBuffer = 0, memberHours = [] } = {}) {
  const normalizedRevenue = decimal(revenue);
  const normalizedRestock = decimal(restockAllocation);
  const normalizedBuffer = decimal(contingencyBuffer);
  const normalizedHours = Array.isArray(memberHours) ? memberHours.map((item) => ({
    user_id: Number(item.user_id),
    hours: Number(item.hours || 0),
  })) : [];

  const growthFund = DecimalMax(normalizedRevenue.minus(normalizedRestock).minus(normalizedBuffer)).times('0.15');
  const distributableAmount = DecimalMax(normalizedRevenue.minus(normalizedRestock).minus(normalizedBuffer).minus(growthFund));
  const totalHours = normalizedHours.reduce((sum, item) => sum + (Number.isFinite(item.hours) ? item.hours : 0), 0);

  const payouts = normalizedHours.map((item) => ({
    user_id: item.user_id,
    hours: item.hours,
    amount: totalHours > 0 ? money(distributableAmount.times(item.hours).div(totalHours)) : 0,
    status: 'PENDING_REVIEW',
  }));

  return {
    revenue: money(normalizedRevenue),
    restockAllocation: money(normalizedRestock),
    contingencyBuffer: money(normalizedBuffer),
    growthFund: money(growthFund),
    distributableAmount: money(distributableAmount),
    totalHours,
    payouts,
  };
}

function DecimalMax(value) {
  return value.isNegative() ? decimal(0) : value;
}

function summarizeAuditLogs(entries = []) {
  const list = Array.isArray(entries) ? entries : [];
  const actions = {};
  const highRiskActions = new Set(['ORDER_STATUS_UPDATED', 'WORKFLOW_UPDATED', 'PAYOUT_APPROVED', 'SETTLEMENT_APPROVED']);

  list.forEach((entry) => {
    const action = entry.action || 'UNKNOWN';
    actions[action] = (actions[action] || 0) + 1;
  });

  return {
    totalEvents: list.length,
    actions,
    criticalActions: Object.entries(actions)
      .filter(([key]) => highRiskActions.has(key))
      .map(([key, count]) => ({ action: key, count })),
    highRiskActions: Array.from(highRiskActions).filter((key) => actions[key]),
  };
}

module.exports = {
  buildAdminOverview,
  buildSettlementPlan,
  summarizeAuditLogs,
};
