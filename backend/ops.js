function buildAdminOverview(orders = []) {
  const normalized = Array.isArray(orders) ? orders : [];
  const activeOrders = normalized.filter((order) => !['Delivered', 'CANCELLED'].includes(order.status)).length;
  const pendingPickup = normalized.filter((order) => order.status === 'Pending').length;
  const qcQueue = normalized.filter((order) => order.status === 'QC Passed').length;
  const revenue = normalized.reduce((total, order) => total + Number(order.estimated_cost || order.deposit_paid || 0), 0);

  const statusBreakdown = normalized.reduce((accumulator, order) => {
    const status = order.status || 'Pending';
    accumulator[status] = (accumulator[status] || 0) + 1;
    return accumulator;
  }, {});

  const trend = normalized
    .map((order) => ({
      date: order.preferred_date || order.created_at || new Date().toISOString().slice(0, 10),
      amount: Number(order.estimated_cost || order.deposit_paid || 0),
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
      estimated_cost: Number(order.estimated_cost || 0),
    })),
  };
}

function buildSettlementPlan({ revenue = 0, restockAllocation = 0, contingencyBuffer = 0, memberHours = [] } = {}) {
  const normalizedRevenue = Number(revenue) || 0;
  const normalizedRestock = Number(restockAllocation) || 0;
  const normalizedBuffer = Number(contingencyBuffer) || 0;
  const normalizedHours = Array.isArray(memberHours) ? memberHours.map((item) => ({
    user_id: Number(item.user_id),
    hours: Number(item.hours || 0),
  })) : [];

  const growthFund = Math.max(0, normalizedRevenue - normalizedRestock - normalizedBuffer) * 0.15;
  const distributableAmount = Math.max(0, normalizedRevenue - normalizedRestock - normalizedBuffer - growthFund);
  const totalHours = normalizedHours.reduce((sum, item) => sum + (Number.isFinite(item.hours) ? item.hours : 0), 0);

  const payouts = normalizedHours.map((item) => ({
    user_id: item.user_id,
    hours: item.hours,
    amount: totalHours > 0 ? distributableAmount * (item.hours / totalHours) : 0,
    status: 'PENDING_REVIEW',
  }));

  return {
    revenue: normalizedRevenue,
    restockAllocation: normalizedRestock,
    contingencyBuffer: normalizedBuffer,
    growthFund,
    distributableAmount,
    totalHours,
    payouts,
  };
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
