const serviceCatalog = [
  { id: 'house-deep-cleaning', name: '2 Bedroom deep clean', rule: 'FIXED', price: 5500, category: 'home' },
  { id: 'laundry', name: 'Laundry', rule: 'PER_KG', price: 200, category: 'laundry' },
  { id: 'carpet-cleaning', name: 'Carpet cleaning', rule: 'PER_SQM', price: 300, category: 'home' },
  { id: 'small-office-cleaning', name: 'Small office cleaning', rule: 'FIXED', price: 2500, category: 'office' },
  { id: 'bedroom-deep-clean', name: 'Bedroom deep clean', rule: 'FIXED', price: 3200, category: 'home' },
  { id: 'toilet-cleaning', name: 'Toilet cleaning', rule: 'FIXED', price: 1800, category: 'home' },
  { id: 'airbnb-restock', name: 'Airbnb / turnover clean', rule: 'FIXED', price: 4200, category: 'airbnb' },
  { id: 'sofa-care', name: 'Sofa and upholstery care', rule: 'FIXED', price: 2500, category: 'home' },
];
const { money } = require('./money');

const ORDER_STATUS_SEQUENCE = ['Pending', 'Picked Up', 'In-Progress', 'QC Passed', 'Out for Delivery', 'Delivered'];

function calculateServiceAmount(serviceId, quantity = 1) {
  const service = serviceCatalog.find((item) => item.id === serviceId) || serviceCatalog[0];
  const itemQuantity = Math.max(1, Number(quantity) || 1);
  return {
    service,
    quantity: itemQuantity,
    total: money(money(service.price) * itemQuantity),
  };
}

function normalizeOrderInput(payload = {}) {
  const errors = [];
  const name = String(payload.name || '').trim();
  const phone = String(payload.phone || '').trim();
  const email = String(payload.email || '').trim();
  const address = String(payload.address || '').trim();
  const building = String(payload.building || '').trim();
  const room = String(payload.room || '').trim();
  const preferredDate = String(payload.preferredDate || '').trim();
  const preferredTime = String(payload.preferredTime || '').trim();
  const requestedServices = Array.isArray(payload.services) ? payload.services.filter(Boolean) : [];
  const primaryService = String(payload.service || payload.serviceId || requestedServices[0] || '').trim();

  if (!name) errors.push('Customer name is required.');
  if (!phone) errors.push('Phone number is required.');
  if (!email) errors.push('Email address is required.');
  if (!address && !(building || room)) errors.push('Pickup address is required.');
  if (!preferredDate) errors.push('Preferred pickup date is required.');
  if (!preferredTime) errors.push('Preferred pickup time is required.');
  if (!requestedServices.length && !primaryService) errors.push('At least one service is required.');

  const quantity = Number(payload.quantity || 1);
  if (!Number.isFinite(quantity) || quantity < 1) errors.push('Quantity must be at least 1.');

  const orchestratedServices = requestedServices.length ? requestedServices : [primaryService];
  const selectedService = serviceCatalog.find((item) => item.name === primaryService || item.id === primaryService)
    || serviceCatalog.find((item) => item.name === orchestratedServices[0] || item.id === orchestratedServices[0]);

  if (!selectedService) errors.push('Service selection is invalid.');

  const normalized = {
    name,
    phone,
    email,
    address: address || [building, room].filter(Boolean).join(', '),
    building,
    room,
    preferredDate,
    preferredTime,
    service: primaryService || (selectedService && selectedService.name) || '',
    services: orchestratedServices,
    quantity: Math.max(1, Number(quantity) || 1),
    details: String(payload.details || payload.notes || '').trim(),
    serviceId: selectedService ? selectedService.id : null,
  };

  return { ok: errors.length === 0, errors, data: normalized };
}

module.exports = {
  serviceCatalog,
  ORDER_STATUS_SEQUENCE,
  calculateServiceAmount,
  normalizeOrderInput,
};
