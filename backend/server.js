require('dotenv').config();

const fs = require('fs');
const path = require('path');
const cors = require('cors');
const express = require('express');
const pool = require('./db');
const { hashPassword, verifyPassword, issueToken, authGuard } = require('./security');
const twilio = require('twilio');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const cron = require('node-cron');

const app = express();
const port = Number(process.env.PORT) || 4000;
const orderStatuses = ['Pending', 'Picked Up', 'In-Progress', 'QC Passed', 'Out for Delivery', 'Delivered'];
const serviceCatalog = [
  { id: 'house-deep-cleaning', name: 'House deep-cleaning', rule: 'FIXED', price: 3500 },
  { id: 'laundry', name: 'Laundry', rule: 'PER_KG', price: 250 },
  { id: 'carpet-cleaning', name: 'Carpet cleaning', rule: 'PER_SQM', price: 180 },
  { id: 'office-cleaning-contract', name: 'Office cleaning contract', rule: 'MONTHLY', price: 15000 },
];
const localOrdersPath = path.join(__dirname, 'orders.json');
const localOrders = fs.existsSync(localOrdersPath) ? JSON.parse(fs.readFileSync(localOrdersPath, 'utf8')) : [];
const localUsersPath = path.join(__dirname, 'users.json');
const localUsers = fs.existsSync(localUsersPath) ? JSON.parse(fs.readFileSync(localUsersPath, 'utf8')) : [];
const localWorkflowPath = path.join(__dirname, 'workflow.json');
const localWorkflow = fs.existsSync(localWorkflowPath) ? JSON.parse(fs.readFileSync(localWorkflowPath, 'utf8')) : [];
const localPayoutsPath = path.join(__dirname, 'payouts.json');
const localPayouts = fs.existsSync(localPayoutsPath) ? JSON.parse(fs.readFileSync(localPayoutsPath, 'utf8')) : [];
const usingLocalStorage = !process.env.DATABASE_URL;

function saveLocalOrders() { fs.writeFileSync(localOrdersPath, JSON.stringify(localOrders, null, 2)); }
function saveLocalUsers() { fs.writeFileSync(localUsersPath, JSON.stringify(localUsers, null, 2)); }
function saveLocalWorkflow() { fs.writeFileSync(localWorkflowPath, JSON.stringify(localWorkflow, null, 2)); }
function saveLocalPayouts() { fs.writeFileSync(localPayoutsPath, JSON.stringify(localPayouts, null, 2)); }
function calculateOrderTotal(serviceId, quantity) { const service = serviceCatalog.find((item) => item.id === serviceId); if (!service) return null; return { service, total: service.price * Math.max(1, Number(quantity) || 1) }; }
async function notifyOperations(order) {
  const results = { email: 'NOT_CONFIGURED', sms: 'NOT_CONFIGURED' };
  const services = Array.isArray(order.services) ? order.services : [order.service];
  const details = order.service_details || {};
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT) || 587, secure: process.env.SMTP_SECURE === 'true', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
      await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: process.env.OPERATIONS_EMAIL || 'safisquaadcleaningservices@gmail.com', replyTo: order.email || undefined, subject: `New Safi Squad pickup request ${order.tracking_code}`, text: [`New Safi Squad pickup request`, `Tracking code: ${order.tracking_code}`, `Name: ${order.customer_name}`, `Phone / WhatsApp: ${order.phone}`, `Customer email: ${order.email || 'Not provided'}`, `Services: ${services.join(', ')}`, `Building / estate: ${details.building || order.address}`, `Room / house: ${details.room || 'Not provided'}`, `Floor / level: ${details.floor || 'Not provided'}`, `Picking date: ${order.preferred_date}`, `Picking time: ${details.preferredTime || 'Not provided'}`, `Notes: ${details.notes || 'None'}`, `Estimated cost: KES ${order.estimated_cost}`].join('\n') });
      results.email = 'SENT';
    } catch (error) { console.error('Operations email failed', error.message); results.email = 'FAILED'; }
  }
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM && process.env.OPERATIONS_PHONE) {
    try { const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN); await client.messages.create({ body: `New Safi Squad order ${order.tracking_code}: ${services.join(', ')} for ${order.customer_name}.`, from: process.env.TWILIO_FROM, to: process.env.OPERATIONS_PHONE }); results.sms = 'SENT'; } catch (error) { console.error('Operations SMS failed', error.message); results.sms = 'FAILED'; }
  }
  return results;
}
async function triggerMpesaStk(phone, amount, trackingCode) {
  if (!process.env.DARAJA_CONSUMER_KEY || !process.env.DARAJA_CONSUMER_SECRET || !process.env.DARAJA_SHORTCODE || !process.env.DARAJA_PASSKEY || !process.env.DARAJA_CALLBACK_URL) return { status: 'NOT_CONFIGURED' };
  const auth = Buffer.from(`${process.env.DARAJA_CONSUMER_KEY}:${process.env.DARAJA_CONSUMER_SECRET}`).toString('base64');
  const tokenResponse = await fetch(`${process.env.DARAJA_ENV === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke'}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${auth}` } });
  const token = (await tokenResponse.json()).access_token;
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const password = Buffer.from(`${process.env.DARAJA_SHORTCODE}${process.env.DARAJA_PASSKEY}${timestamp}`).toString('base64');
  const response = await fetch(`${process.env.DARAJA_ENV === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke'}/mpesa/stkpush/v1/processrequest`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ BusinessShortCode: process.env.DARAJA_SHORTCODE, Password: password, Timestamp: timestamp, TransactionType: 'CustomerPayBillOnline', Amount: Math.ceil(amount), PartyA: phone, PartyB: process.env.DARAJA_SHORTCODE, PhoneNumber: phone, CallBackURL: process.env.DARAJA_CALLBACK_URL, AccountReference: trackingCode, TransactionDesc: 'SafiCleaners deposit' }) });
  return response.json();
}
async function createScheduledSettlementDraft() {
  const revenue = usingLocalStorage ? localOrders.reduce((sum, order) => sum + Number(order.deposit_paid || 0), 0) : Number((await pool.query("SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'PAID' AND created_at >= NOW() - INTERVAL '7 days'")).rows[0].total);
  const restockAllocation = Number(process.env.DEFAULT_RESTOCK_ALLOCATION) || 0;
  const contingencyBuffer = Number(process.env.DEFAULT_CONTINGENCY_BUFFER) || 0;
  const growthFund = Math.max(0, revenue - restockAllocation - contingencyBuffer) * 0.15;
  const draft = { id: Date.now(), week_start: new Date().toISOString().slice(0, 10), revenue, restock_allocation: restockAllocation, contingency_buffer: contingencyBuffer, growth_fund: growthFund, distributable_amount: Math.max(0, revenue - restockAllocation - contingencyBuffer - growthFund), status: 'PENDING_REVIEW', created_at: new Date().toISOString(), source: 'SUNDAY_CRON' };
  if (usingLocalStorage) { localPayouts.unshift({ settlement: draft, payouts: [], approval_required: true }); saveLocalPayouts(); } else await pool.query('INSERT INTO settlement_runs (week_start, revenue, restock_allocation, contingency_buffer, growth_fund, distributable_amount) VALUES ($1,$2,$3,$4,$5,$6)', [draft.week_start, draft.revenue, draft.restock_allocation, draft.contingency_buffer, draft.growth_fund, draft.distributable_amount]);
  console.log(`Settlement draft created for ${draft.week_start}; approval required before disbursement.`);
}

async function ensureSchema() {
  if (usingLocalStorage) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY, tracking_code VARCHAR(20) UNIQUE NOT NULL,
      customer_name VARCHAR(120) NOT NULL, phone VARCHAR(40) NOT NULL, email VARCHAR(255),
      address TEXT NOT NULL, preferred_date DATE NOT NULL, service VARCHAR(120) NOT NULL,
      service_details TEXT, quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
      estimated_cost NUMERIC(10, 2) NOT NULL DEFAULT 0, deposit_paid NUMERIC(10, 2) NOT NULL DEFAULT 0, status VARCHAR(40) NOT NULL DEFAULT 'Pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS deposit_paid NUMERIC(10, 2) NOT NULL DEFAULT 0;
    CREATE TABLE IF NOT EXISTS order_events (
      id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      status VARCHAR(40) NOT NULL, note TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, role VARCHAR(40) NOT NULL, phone VARCHAR(40), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS workflow_steps (id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE, status VARCHAR(40) NOT NULL, started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), completed_at TIMESTAMPTZ, actor_id INTEGER REFERENCES users(id), note TEXT);
    CREATE TABLE IF NOT EXISTS order_photos (id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE, photo_type VARCHAR(20) NOT NULL, url TEXT NOT NULL, uploaded_by INTEGER REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS payments (id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE, amount NUMERIC(10,2) NOT NULL, type VARCHAR(30) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'PENDING', provider_reference VARCHAR(120), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS business_settings (key VARCHAR(80) PRIMARY KEY, value NUMERIC(10,2) NOT NULL);
    CREATE TABLE IF NOT EXISTS staff_hours (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), week_start DATE NOT NULL, hours NUMERIC(8,2) NOT NULL CHECK (hours >= 0), UNIQUE (user_id, week_start));
    CREATE TABLE IF NOT EXISTS settlement_runs (id SERIAL PRIMARY KEY, week_start DATE NOT NULL, revenue NUMERIC(10,2) NOT NULL, restock_allocation NUMERIC(10,2) NOT NULL, contingency_buffer NUMERIC(10,2) NOT NULL, growth_fund NUMERIC(10,2) NOT NULL, distributable_amount NUMERIC(10,2) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'PENDING_REVIEW', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), approved_at TIMESTAMPTZ, approved_by INTEGER REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS payouts (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), week_start DATE NOT NULL, amount NUMERIC(10,2) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'PENDING_REVIEW', approved_by INTEGER REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS audit_logs (id SERIAL PRIMARY KEY, actor_id INTEGER REFERENCES users(id), action VARCHAR(120) NOT NULL, entity_type VARCHAR(80) NOT NULL, entity_id VARCHAR(80), metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  `);
}

async function seedLocalAdmin() {
  if (localUsers.length || !process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) return;
  localUsers.push({ id: 1, email: process.env.ADMIN_EMAIL.toLowerCase(), password_hash: await hashPassword(process.env.ADMIN_PASSWORD), role: 'ADMIN', created_at: new Date().toISOString() });
  saveLocalUsers();
}

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', async (_request, response) => {
  if (usingLocalStorage) return response.json({ status: 'ok', database: 'local-file' });
  try {
    await pool.query('SELECT 1');
    response.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('Database health check failed', error.message);
    response.status(503).json({ status: 'degraded', database: 'disconnected' });
  }
});

app.get('/api/summary', (_request, response) => {
  response.json({
    activeProjects: 24,
    teamMembers: 18,
    tasksCompleted: 86,
    completionRate: 72,
  });
});

app.get('/api/site-content', (_request, response) => {
  response.json({
    cities: '5+',
    stores: 5,
    garments: '5,000',
    services: ['Dry cleaning', 'Laundry', 'Steam press', 'Shoe care', 'Home cleaning', 'House cleaning', 'Compound cleaning', 'Toilet cleaning', "Airbnb's cleaning", 'Office cleanup'],
    sigma: ['Unique barcode tags', 'Specialised segregation', 'Wash care instructions', 'Fabric-friendly detergents', 'Steam press', 'Three-stage quality check'],
  });
});

app.get('/api/services', (_request, response) => response.json({ services: serviceCatalog }));

app.post('/api/auth/login', async (request, response) => {
  const { email, password } = request.body;
  if (!email || !password) return response.status(400).json({ error: 'Email and password are required.' });
  try {
    const user = usingLocalStorage
      ? localUsers.find((item) => item.email === email.toLowerCase())
      : (await pool.query('SELECT id, email, password_hash, role FROM users WHERE email = $1', [email.toLowerCase()])).rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) return response.status(401).json({ error: 'Invalid email or password.' });
    response.json({ token: issueToken(user), user: { id: user.id, email: user.email, role: user.role } });
  } catch (error) { response.status(500).json({ error: 'Login is unavailable.' }); }
});

app.get('/api/users', authGuard(['ADMIN']), async (_request, response) => {
  if (usingLocalStorage) return response.json({ users: localUsers.map(({ password_hash, ...user }) => user) });
  const result = await pool.query('SELECT id, email, role, phone, created_at FROM users ORDER BY created_at ASC');
  response.json({ users: result.rows });
});

app.post('/api/users', authGuard(['ADMIN']), async (request, response) => {
  const { email, password, role = 'MEMBER', phone } = request.body;
  if (!email || !password || !['ADMIN', 'MEMBER', 'FINANCE_OFFICER'].includes(role)) return response.status(400).json({ error: 'Email, password, and a valid staff role are required.' });
  const passwordHash = await hashPassword(password);
  if (usingLocalStorage) {
    if (localUsers.some((user) => user.email === email.toLowerCase())) return response.status(409).json({ error: 'Email already exists.' });
    const user = { id: localUsers.length + 1, email: email.toLowerCase(), password_hash: passwordHash, role, phone: phone || null, created_at: new Date().toISOString() };
    localUsers.push(user); saveLocalUsers(); return response.status(201).json({ user: { id: user.id, email: user.email, role: user.role, phone: user.phone } });
  }
  try {
    const result = await pool.query('INSERT INTO users (email, password_hash, role, phone) VALUES ($1,$2,$3,$4) RETURNING id, email, role, phone', [email.toLowerCase(), passwordHash, role, phone || null]);
    response.status(201).json({ user: result.rows[0] });
  } catch (_error) { response.status(409).json({ error: 'Could not create staff user.' }); }
});

app.post('/api/orders', async (request, response) => {
  const { name, phone, email, address, building, room, floor, preferredDate, preferredTime, serviceId, service, services = [], details, quantity, estimatedCost } = request.body;
  const requestedServices = Array.isArray(services) ? services.filter(Boolean) : [service].filter(Boolean);
  const pickupAddress = address || [building, room, floor].filter(Boolean).join(', ');
  if (!name || !phone || !email || !pickupAddress || !building || !room || !preferredDate || !preferredTime || !requestedServices.length) {
    return response.status(400).json({ error: 'Name, phone, email, pickup details, preferred date and time, and at least one service are required.' });
  }
  const selectedService = service || requestedServices[0];
  const selected = calculateOrderTotal(serviceId || serviceCatalog.find((item) => item.name === selectedService)?.id || 'house-deep-cleaning', quantity);
  if (!selected) return response.status(400).json({ error: 'Unknown service.' });
  const total = requestedServices.reduce((sum, requestedService) => { const match = serviceCatalog.find((item) => item.name === requestedService); return sum + (match ? match.price * Math.max(1, Number(quantity) || 1) : 0) }, 0) || selected.total;
  const serviceDetails = { building, room, floor: floor || '', preferredTime, notes: details || '', services: requestedServices };
  const customerIsNew = usingLocalStorage ? !localOrders.some((item) => item.phone === phone) : (await pool.query('SELECT 1 FROM orders WHERE phone = $1 LIMIT 1', [phone])).rowCount === 0;
  const depositPaid = customerIsNew ? total * 0.5 : 0;
  if (usingLocalStorage) {
    const now = new Date().toISOString();
    const order = { id: localOrders.length + 1, tracking_code: `SQ-${Date.now().toString(36).toUpperCase()}`, customer_name: name, phone, email, address: pickupAddress, preferred_date: preferredDate, service: requestedServices.join(', '), services: requestedServices, service_id: selected.service.id, service_details: serviceDetails, quantity: Number(quantity) || 1, estimated_cost: total, deposit_paid: depositPaid, customer_is_new: customerIsNew, status: 'Pending', created_at: now, updated_at: now, events: [{ status: 'Pending', note: 'Booking received', created_at: now }], workflow_steps: [{ status: 'Pending', started_at: now }], photos: [] };
    localOrders.unshift(order); saveLocalOrders();
    if (depositPaid > 0) triggerMpesaStk(phone, depositPaid, order.tracking_code).catch((error) => console.error('M-Pesa STK request failed', error.message));
    const notification = await notifyOperations(order);
    return response.status(201).json({ order, notification });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const trackingCode = `SQ-${Date.now().toString(36).toUpperCase()}`;
    const orderResult = await client.query(
      `INSERT INTO orders (tracking_code, customer_name, phone, email, address, preferred_date, service, service_details, quantity, estimated_cost, deposit_paid)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [trackingCode, name, phone, email, pickupAddress, preferredDate, requestedServices.join(', '), JSON.stringify(serviceDetails), Number(quantity) || 1, total, depositPaid],
    );
    const order = orderResult.rows[0];
    await client.query('INSERT INTO order_events (order_id, status, note) VALUES ($1, $2, $3)', [order.id, 'Pending', 'Booking received']);
    await client.query('INSERT INTO workflow_steps (order_id, status, actor_id, note) VALUES ($1, $2, $3, $4)', [order.id, 'Pending', null, 'Booking received']);
    await client.query('INSERT INTO payments (order_id, amount, type, status) VALUES ($1, $2, $3, $4)', [order.id, depositPaid, 'DEPOSIT', 'PENDING']);
    await client.query('COMMIT');
    if (depositPaid > 0) triggerMpesaStk(phone, depositPaid, order.tracking_code).catch((error) => console.error('M-Pesa STK request failed', error.message));
    const notification = await notifyOperations({ ...order, services: requestedServices, service_details: serviceDetails });
    response.status(201).json({ order: { ...order, services: requestedServices, service_details: serviceDetails, events: [{ status: 'Pending', note: 'Booking received', created_at: order.created_at }] }, notification });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Order creation failed', error.message);
    response.status(500).json({ error: 'Could not save the booking.' });
  } finally { client.release(); }
});

app.get('/api/orders/:trackingCode', async (request, response) => {
  if (usingLocalStorage) {
    const order = localOrders.find((item) => item.tracking_code === request.params.trackingCode.toUpperCase());
    return order ? response.json({ order }) : response.status(404).json({ error: 'Order not found.' });
  }
  try {
    const orderResult = await pool.query('SELECT * FROM orders WHERE tracking_code = $1', [request.params.trackingCode.toUpperCase()]);
    if (!orderResult.rowCount) return response.status(404).json({ error: 'Order not found.' });
    const events = await pool.query('SELECT status, note, created_at FROM order_events WHERE order_id = $1 ORDER BY created_at ASC', [orderResult.rows[0].id]);
    response.json({ order: { ...orderResult.rows[0], events: events.rows } });
  } catch (error) { response.status(500).json({ error: 'Could not load the order.' }); }
});

app.get('/api/orders', authGuard(['ADMIN', 'MEMBER', 'FINANCE_OFFICER']), async (_request, response) => {
  if (usingLocalStorage) return response.json({ orders: localOrders });
  try {
    const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
    const orders = await Promise.all(result.rows.map(async (order) => {
      const [events, workflow, photos] = await Promise.all([
        pool.query('SELECT status, note, created_at FROM order_events WHERE order_id = $1 ORDER BY created_at ASC', [order.id]),
        pool.query('SELECT status, started_at, completed_at, actor_id, note FROM workflow_steps WHERE order_id = $1 ORDER BY started_at ASC', [order.id]),
        pool.query('SELECT photo_type, url, uploaded_by, created_at FROM order_photos WHERE order_id = $1 ORDER BY created_at ASC', [order.id]),
      ]);
      return { ...order, events: events.rows, workflow_steps: workflow.rows, photos: photos.rows };
    }));
    response.json({ orders });
  } catch (error) { response.status(500).json({ error: 'Could not load orders.' }); }
});

app.get('/api/orders/:id/qr', authGuard(['ADMIN', 'MEMBER']), async (request, response) => {
  const qr = await QRCode.toDataURL(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/scan/${request.params.id}`);
  response.json({ orderId: Number(request.params.id), qrDataUrl: qr });
});

app.patch('/api/orders/:id/status', authGuard(['ADMIN', 'MEMBER']), async (request, response) => {
  const { status, note } = request.body;
  if (!orderStatuses.includes(status)) return response.status(400).json({ error: 'Invalid order status.' });
  if (usingLocalStorage) {
    const order = localOrders.find((item) => item.id === Number(request.params.id));
    if (!order) return response.status(404).json({ error: 'Order not found.' });
    order.status = status; order.updated_at = new Date().toISOString(); order.events.push({ status, note: note || `Status updated to ${status}`, created_at: order.updated_at }); saveLocalOrders();
    return response.json({ order });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [status, request.params.id]);
    if (!result.rowCount) { await client.query('ROLLBACK'); return response.status(404).json({ error: 'Order not found.' }); }
    await client.query('INSERT INTO order_events (order_id, status, note) VALUES ($1, $2, $3)', [request.params.id, status, note || `Status updated to ${status}`]);
    await client.query('COMMIT');
    response.json({ order: result.rows[0] });
  } catch (error) { await client.query('ROLLBACK'); response.status(500).json({ error: 'Could not update the order.' }); }
  finally { client.release(); }
});

app.patch('/api/orders/:id/workflow', authGuard(['ADMIN', 'MEMBER']), async (request, response) => {
  const { status, note, photoUrl, photoType } = request.body;
  if (!orderStatuses.includes(status)) return response.status(400).json({ error: 'Invalid workflow status.' });
  if (photoUrl && !['BEFORE', 'AFTER'].includes(photoType)) return response.status(400).json({ error: 'photoType must be BEFORE or AFTER.' });
  const now = new Date().toISOString();
  if (usingLocalStorage) {
    const order = localOrders.find((item) => item.id === Number(request.params.id));
    if (!order) return response.status(404).json({ error: 'Order not found.' });
    order.status = status; order.updated_at = now;
    order.events.push({ status, note: note || `Workflow updated to ${status}`, created_at: now });
    order.workflow_steps = order.workflow_steps || []; order.workflow_steps.push({ status, started_at: now, actor_id: request.user.userId, note: note || null });
    if (photoUrl) { order.photos = order.photos || []; order.photos.push({ photo_type: photoType, url: photoUrl, uploaded_by: request.user.userId, created_at: now }); }
    saveLocalOrders(); saveLocalWorkflow();
    return response.json({ order });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [status, request.params.id]);
    if (!result.rowCount) { await client.query('ROLLBACK'); return response.status(404).json({ error: 'Order not found.' }); }
    await client.query('INSERT INTO order_events (order_id, status, note) VALUES ($1, $2, $3)', [request.params.id, status, note || `Workflow updated to ${status}`]);
    await client.query('INSERT INTO workflow_steps (order_id, status, actor_id, note) VALUES ($1, $2, $3, $4)', [request.params.id, status, request.user.userId, note || null]);
    if (photoUrl) await client.query('INSERT INTO order_photos (order_id, photo_type, url, uploaded_by) VALUES ($1, $2, $3, $4)', [request.params.id, photoType, photoUrl, request.user.userId]);
    await client.query('INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata) VALUES ($1, $2, $3, $4, $5)', [request.user.userId, 'WORKFLOW_UPDATED', 'ORDER', request.params.id, JSON.stringify({ status, photoUrl: Boolean(photoUrl) })]);
    await client.query('COMMIT'); response.json({ order: result.rows[0] });
  } catch (error) { await client.query('ROLLBACK'); response.status(500).json({ error: 'Could not update workflow.' }); }
  finally { client.release(); }
});

app.get('/api/settlements', authGuard(['ADMIN', 'FINANCE_OFFICER']), async (_request, response) => {
  if (usingLocalStorage) return response.json({ payouts: localPayouts });
  const result = await pool.query(`SELECT sr.*, COALESCE(json_agg(p ORDER BY p.amount DESC) FILTER (WHERE p.id IS NOT NULL), '[]') AS payouts FROM settlement_runs sr LEFT JOIN payouts p ON p.week_start = sr.week_start GROUP BY sr.id ORDER BY sr.created_at DESC`);
  response.json({ settlements: result.rows });
});

app.post('/api/settlements/:weekStart/calculate', authGuard(['ADMIN', 'FINANCE_OFFICER']), async (request, response) => {
  const { weekStart } = request.params;
  const revenue = Number(request.body.revenue) || 0;
  const restockAllocation = Number(request.body.restockAllocation) || 0;
  const contingencyBuffer = Number(request.body.contingencyBuffer) || 0;
  const growthFund = Math.max(0, revenue - restockAllocation - contingencyBuffer) * 0.15;
  const distributableAmount = Math.max(0, revenue - restockAllocation - contingencyBuffer - growthFund);
  const run = { id: Date.now(), week_start: weekStart, revenue, restock_allocation: restockAllocation, contingency_buffer: contingencyBuffer, growth_fund: growthFund, distributable_amount: distributableAmount, status: 'PENDING_REVIEW', created_at: new Date().toISOString() };
  let memberHours = Array.isArray(request.body.memberHours) ? request.body.memberHours : [];
  if (!usingLocalStorage) memberHours = (await pool.query('SELECT user_id, hours FROM staff_hours WHERE week_start = $1', [weekStart])).rows;
  const totalHours = memberHours.reduce((sum, item) => sum + Number(item.hours || 0), 0);
  const payouts = memberHours.map((item) => ({ user_id: Number(item.user_id), week_start: weekStart, hours: Number(item.hours || 0), amount: totalHours ? distributableAmount * Number(item.hours || 0) / totalHours : 0, status: 'PENDING_REVIEW' }));
  if (usingLocalStorage) { localPayouts.unshift({ settlement: run, payouts, approval_required: true }); saveLocalPayouts(); return response.status(201).json({ settlement: run, payouts, approval_required: true }); }
  const result = await pool.query('INSERT INTO settlement_runs (week_start, revenue, restock_allocation, contingency_buffer, growth_fund, distributable_amount) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [weekStart, revenue, restockAllocation, contingencyBuffer, growthFund, distributableAmount]);
  for (const payout of payouts) await pool.query('INSERT INTO payouts (user_id, week_start, amount, status) VALUES ($1,$2,$3,$4)', [payout.user_id, weekStart, payout.amount, 'PENDING_REVIEW']);
  response.status(201).json({ settlement: result.rows[0], payouts, approval_required: true });
});

app.post('/api/settlements/:id/approve', authGuard(['ADMIN', 'FINANCE_OFFICER']), async (request, response) => {
  if (usingLocalStorage) {
    const run = localPayouts.find((item) => item.settlement.id === Number(request.params.id));
    if (!run) return response.status(404).json({ error: 'Settlement not found.' });
    run.settlement.status = 'APPROVED'; run.settlement.approved_at = new Date().toISOString(); run.settlement.approved_by = request.user.userId; saveLocalPayouts(); return response.json({ settlement: run.settlement, disbursement: 'READY_FOR_B2C_REVIEW' });
  }
  const result = await pool.query('UPDATE settlement_runs SET status = $1, approved_at = NOW(), approved_by = $2 WHERE id = $3 RETURNING *', ['APPROVED', request.user.userId, request.params.id]);
  if (!result.rowCount) return response.status(404).json({ error: 'Settlement not found.' });
  response.json({ settlement: result.rows[0], disbursement: 'READY_FOR_B2C_REVIEW' });
});

app.listen(port, async () => {
  try { await ensureSchema(); await seedLocalAdmin(); console.log(usingLocalStorage ? 'Using local order storage' : 'Database schema ready'); } catch (error) { console.error('Database schema setup failed', error.message); }
  console.log(`Safi Squad API running on http://localhost:${port}`);
  cron.schedule('0 23 * * 0', () => createScheduledSettlementDraft().catch((error) => console.error('Settlement draft failed', error.message)));
});
