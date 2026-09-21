const ALLOWED_TRANSITIONS = {
  Pending: ['Picked Up'],
  'Picked Up': ['In-Progress'],
  'In-Progress': ['QC Passed'],
  'QC Passed': ['Out for Delivery'],
  'Out for Delivery': ['Delivered'],
  Delivered: [],
};

function assertTransition(from, to, { override = false } = {}) {
  if (from === to) return;
  if (override) return;
  if (!ALLOWED_TRANSITIONS[from]?.includes(to)) throw new Error(`Illegal transition: ${from} -> ${to}`);
}

module.exports = { ALLOWED_TRANSITIONS, assertTransition };