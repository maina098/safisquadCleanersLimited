require('dotenv').config();

const fs = require('fs');
const path = require('path');
const cors = require('cors');
const express = require('express');
const pool = require('./db');
const { hashPassword, verifyPassword, issueToken, issueRefreshToken, authGuard, normalizeRole, verifyToken } = require('./security');
const { calculateServiceAmount, normalizeOrderInput, ORDER_STATUS_SEQUENCE } = require('./validators');
const { decimal, money, moneyString, addMoney } = require('./money');
const { buildAdminOverview, buildSettlementPlan, summarizeAuditLogs } = require('./ops');
const { emit, subscribe, recentEvents, eventsAfter, replayEvents, initializeRedis } = require('./events');
const { assertTransition } = require('./orderStateMachine');
const twilio = require('twilio');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const cron = require('node-cron');
const config = require('./config');

const app = express();
const port = config.port;
const orderStatuses = ['Pending', 'Picked Up', 'In-Progress', 'QC Passed', 'Out for Delivery', 'Delivered'];
const serviceCatalog = [
  { id: 'house-deep-cleaning', name: '2 Bedroom deep clean', rule: 'FIXED', price: 5500 },
  { id: 'laundry', name: 'Laundry', rule: 'PER_KG', price: 200 },
  { id: 'carpet-cleaning', name: 'Carpet cleaning', rule: 'PER_SQM', price: 300 },
  { id: 'small-office-cleaning', name: 'Small office cleaning', rule: 'FIXED', price: 2500 },
];
const localOrdersPath = path.join(__dirname, 'orders.json');
const localOrders = fs.existsSync(localOrdersPath) ? JSON.parse(fs.readFileSync(localOrdersPath, 'utf8')) : [];
const localUsersPath = path.join(__dirname, 'users.json');
const localUsers = fs.existsSync(localUsersPath) ? JSON.parse(fs.readFileSync(localUsersPath, 'utf8')) : [];
const localWorkflowPath = path.join(__dirname, 'workflow.json');
const localWorkflow = fs.existsSync(localWorkflowPath) ? JSON.parse(fs.readFileSync(localWorkflowPath, 'utf8')) : [];
const localPayoutsPath = path.join(__dirname, 'payouts.json');
const localPayouts = fs.existsSync(localPayoutsPath) ? JSON.parse(fs.readFileSync(localPayoutsPath, 'utf8')) : [];
const localAuditPath = path.join(__dirname, 'audit.json');
const localAuditLogs = fs.existsSync(localAuditPath) ? JSON.parse(fs.readFileSync(localAuditPath, 'utf8')) : [];
const localMessagesPath = path.join(__dirname, 'messages.json');
const localMessages = fs.existsSync(localMessagesPath) ? JSON.parse(fs.readFileSync(localMessagesPath, 'utf8')) : [];
const localPaymentsPath = path.join(__dirname, 'payments.json');
const localPayments = fs.existsSync(localPaymentsPath) ? JSON.parse(fs.readFileSync(localPaymentsPath, 'utf8')) : [];
const localMpesaRequestsPath = path.join(__dirname, 'mpesa_requests.json');
const localMpesaRequests = fs.existsSync(localMpesaRequestsPath) ? JSON.parse(fs.readFileSync(localMpesaRequestsPath, 'utf8')) : [];
const localSystemPath = path.join(__dirname, 'system.json');
const localSystem = fs.existsSync(localSystemPath) ? JSON.parse(fs.readFileSync(localSystemPath, 'utf8')) : { maintenance: { enabled: false } };
const usingLocalStorage = !process.env.DATABASE_URL;
const sseConnections = new Map();
const MAX_SSE_PER_USER = 3;
const MAX_SSE_LIFETIME_MS = 30 * 60 * 1000;

app.locals.resolveAuthUser = async (userId) => {
  if (usingLocalStorage) {
    const user = localUsers.find((item) => item.id === Number(userId));
    return user ? { is_active: user.is_active !== false, status: user.status || 'ACTIVE', token_version: Number(user.token_version) || 0 } : null;
  }
  const result = await pool.query('SELECT is_active, status, token_version FROM users WHERE id = $1', [userId]);
  return result.rows[0] || null;
};

function saveLocalOrders() { fs.writeFileSync(localOrdersPath, JSON.stringify(localOrders, null, 2)); }
function saveLocalUsers() { fs.writeFileSync(localUsersPath, JSON.stringify(localUsers, null, 2)); }
function saveLocalWorkflow() { fs.writeFileSync(localWorkflowPath, JSON.stringify(localWorkflow, null, 2)); }
function saveLocalPayouts() { fs.writeFileSync(localPayoutsPath, JSON.stringify(localPayouts, null, 2)); }
function saveLocalAudit() { fs.writeFileSync(localAuditPath, JSON.stringify(localAuditLogs, null, 2)); }
function saveLocalMessages() { fs.writeFileSync(localMessagesPath, JSON.stringify(localMessages, null, 2)); }
function saveLocalPayments() { fs.writeFileSync(localPaymentsPath, JSON.stringify(localPayments, null, 2)); }
function saveLocalMpesaRequests() { fs.writeFileSync(localMpesaRequestsPath, JSON.stringify(localMpesaRequests, null, 2)); }
function saveLocalSystem() { fs.writeFileSync(localSystemPath, JSON.stringify(localSystem, null, 2)); }
function departmentForRole(role) {
  const normalized = normalizeRole(role);
  if (normalized === 'SUPER_ADMIN' || normalized === 'ADMIN' || normalized === 'MANAGEMENT') return 'MANAGEMENT';
  if (normalized === 'FINANCE' || normalized === 'FINANCE_OFFICER') return 'FINANCE';
  if (['SECRETARIAT', 'PROMOTIONS', 'TECHNICAL'].includes(normalized)) return normalized;
  return 'SECRETARIAT';
}
const roleEvents = {
  SECRETARIAT: ['order.*', 'payment.*', 'query.*', 'system.*'],
  FINANCE: ['order.delivered', 'payment.*', 'query.*', 'system.*'],
  MANAGEMENT: ['*'],
  PROMOTIONS: ['order.*', 'promo.*', 'health.*', 'system.*'],
  TECHNICAL: ['health.*', 'system.*', 'order.status_changed'],
};
function logAudit(actorId, action, entityType, entityId, metadata = {}) {
  const entry = { id: Date.now() + Math.random(), actor_id: actorId || null, action, entity_type: entityType, entity_id: String(entityId || ''), metadata, created_at: new Date().toISOString() };
  if (usingLocalStorage) {
    localAuditLogs.unshift(entry); saveLocalAudit();
    return entry;
  }
  return pool.query('INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata) VALUES ($1, $2, $3, $4, $5)', [actorId || null, action, entityType, entityId || null, JSON.stringify(metadata || {})]);
}
function calculateOrderTotal(serviceId, quantity) { return calculateServiceAmount(serviceId, quantity); }
function isSafePhotoUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    return hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1' && !hostname.startsWith('10.') && !hostname.startsWith('192.168.') && !hostname.startsWith('169.254.');
  } catch (_error) { return false; }
}
function paymentMetadata(callback) {
  const items = callback?.CallbackMetadata?.Item || [];
  return Object.fromEntries(items.map((item) => [item.Name, item.Value]));
}
function applyPaymentEvent(order, payment) {
  const amount = money(payment.amount || 0);
  order.deposit_paid = addMoney(order.deposit_paid || 0, amount);
  order.updated_at = new Date().toISOString();
  emit('payment.received', { orderId: order.id, trackingCode: order.tracking_code, amount, reference: payment.provider_reference });
}
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
  const result = await response.json();
  if (result.ResponseCode === '0' && result.CheckoutRequestID) {
    if (usingLocalStorage) {
      const order = localOrders.find((item) => item.tracking_code === trackingCode);
      if (order) { localMpesaRequests.push({ order_id: order.id, tracking_code: trackingCode, checkout_request_id: result.CheckoutRequestID, amount, status: 'PENDING', created_at: new Date().toISOString() }); saveLocalMpesaRequests(); }
    } else {
      await pool.query('INSERT INTO mpesa_requests (order_id, checkout_request_id, amount) SELECT id, $1, $2 FROM orders WHERE tracking_code = $3 ON CONFLICT (checkout_request_id) DO NOTHING', [result.CheckoutRequestID, amount, trackingCode]);
    }
  }
  return result;
}
async function createScheduledSettlementDraft() {
  const revenue = usingLocalStorage ? localOrders.reduce((sum, order) => addMoney(sum, order.deposit_paid || 0), 0) : (await pool.query("SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'PAID' AND created_at >= NOW() - INTERVAL '7 days'")).rows[0].total;
  const restockAllocation = money(process.env.DEFAULT_RESTOCK_ALLOCATION || 0);
  const contingencyBuffer = money(process.env.DEFAULT_CONTINGENCY_BUFFER || 0);
  const distributableBeforeGrowth = decimal(revenue).minus(restockAllocation).minus(contingencyBuffer);
  const growthFund = money(distributableBeforeGrowth.isNegative() ? 0 : distributableBeforeGrowth.times('0.15'));
  const distributableAmount = money(decimal(revenue).minus(restockAllocation).minus(contingencyBuffer).minus(growthFund).isNegative() ? 0 : decimal(revenue).minus(restockAllocation).minus(contingencyBuffer).minus(growthFund));
  const draft = { id: Date.now(), week_start: new Date().toISOString().slice(0, 10), revenue: money(revenue), restock_allocation: restockAllocation, contingency_buffer: contingencyBuffer, growth_fund: growthFund, distributable_amount: distributableAmount, status: 'PENDING_REVIEW', created_at: new Date().toISOString(), source: 'SUNDAY_CRON' };
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
      version INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS deposit_paid NUMERIC(10, 2) NOT NULL DEFAULT 0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;
    CREATE TABLE IF NOT EXISTS order_events (
      id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      status VARCHAR(40) NOT NULL, note TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, role VARCHAR(40) NOT NULL, phone VARCHAR(40), name VARCHAR(120), is_active BOOLEAN NOT NULL DEFAULT TRUE, token_version INTEGER NOT NULL DEFAULT 0, status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', approved_by INTEGER REFERENCES users(id), approved_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(120);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
    CREATE TABLE IF NOT EXISTS workflow_steps (id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE, status VARCHAR(40) NOT NULL, started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), completed_at TIMESTAMPTZ, actor_id INTEGER REFERENCES users(id), note TEXT);
    CREATE TABLE IF NOT EXISTS order_photos (id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE, photo_type VARCHAR(20) NOT NULL, url TEXT NOT NULL, uploaded_by INTEGER REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS payments (id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE, amount NUMERIC(10,2) NOT NULL, type VARCHAR(30) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'PENDING', provider_reference VARCHAR(120), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CONSTRAINT payments_provider_reference_unique UNIQUE (provider_reference));
    CREATE TABLE IF NOT EXISTS mpesa_requests (id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE, checkout_request_id VARCHAR(120) UNIQUE NOT NULL, amount NUMERIC(10,2) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'PENDING', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), completed_at TIMESTAMPTZ);
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_provider_reference_unique') THEN
        ALTER TABLE payments ADD CONSTRAINT payments_provider_reference_unique UNIQUE (provider_reference);
      END IF;
    END $$;
    CREATE TABLE IF NOT EXISTS business_settings (key VARCHAR(80) PRIMARY KEY, value NUMERIC(10,2) NOT NULL);
    CREATE TABLE IF NOT EXISTS staff_hours (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), week_start DATE NOT NULL, hours NUMERIC(8,2) NOT NULL CHECK (hours >= 0), UNIQUE (user_id, week_start));
    CREATE TABLE IF NOT EXISTS settlement_runs (id SERIAL PRIMARY KEY, week_start DATE NOT NULL, revenue NUMERIC(10,2) NOT NULL, restock_allocation NUMERIC(10,2) NOT NULL, contingency_buffer NUMERIC(10,2) NOT NULL, growth_fund NUMERIC(10,2) NOT NULL, distributable_amount NUMERIC(10,2) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'PENDING_REVIEW', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), approved_at TIMESTAMPTZ, approved_by INTEGER REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS payouts (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), week_start DATE NOT NULL, amount NUMERIC(10,2) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'PENDING_REVIEW', approved_by INTEGER REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS audit_logs (id SERIAL PRIMARY KEY, actor_id INTEGER REFERENCES users(id), action VARCHAR(120) NOT NULL, entity_type VARCHAR(80) NOT NULL, entity_id VARCHAR(80), metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS transactions (id SERIAL PRIMARY KEY, order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL, amount NUMERIC(12,2) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    ALTER TABLE transactions ALTER COLUMN amount TYPE NUMERIC(12,2) USING amount::NUMERIC(12,2);
    ALTER TABLE orders ALTER COLUMN estimated_cost TYPE NUMERIC(12,2) USING estimated_cost::NUMERIC(12,2), ALTER COLUMN deposit_paid TYPE NUMERIC(12,2) USING deposit_paid::NUMERIC(12,2);
    ALTER TABLE payments ALTER COLUMN amount TYPE NUMERIC(12,2) USING amount::NUMERIC(12,2);
    ALTER TABLE mpesa_requests ALTER COLUMN amount TYPE NUMERIC(12,2) USING amount::NUMERIC(12,2);
    ALTER TABLE audit_logs ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
    CREATE OR REPLACE FUNCTION prevent_audit_modification() RETURNS TRIGGER AS $$ BEGIN RAISE EXCEPTION 'audit_logs is append-only'; END; $$ LANGUAGE plpgsql;
    DROP TRIGGER IF EXISTS audit_logs_immutable ON audit_logs;
    CREATE TRIGGER audit_logs_immutable BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
    CREATE TABLE IF NOT EXISTS inter_dept_messages (id SERIAL PRIMARY KEY, from_dept VARCHAR(40) NOT NULL, to_dept VARCHAR(40) NOT NULL, subject VARCHAR(160) NOT NULL, body TEXT NOT NULL, related_type VARCHAR(80), related_id VARCHAR(80), priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL', status VARCHAR(20) NOT NULL DEFAULT 'UNREAD', created_by INTEGER REFERENCES users(id), assigned_to INTEGER REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), read_at TIMESTAMPTZ, resolved_at TIMESTAMPTZ);
    CREATE INDEX IF NOT EXISTS inter_dept_messages_recipient_idx ON inter_dept_messages (to_dept, status);
  `);
}

async function seedLocalAdmin() {
  if (localUsers.length || !process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) return;
  localUsers.push({ id: 1, email: process.env.ADMIN_EMAIL.toLowerCase(), password_hash: await hashPassword(process.env.ADMIN_PASSWORD), role: 'SUPER_ADMIN', is_active: true, status: 'ACTIVE', token_version: 0, created_at: new Date().toISOString() });
  saveLocalUsers();
}

const allowedOrigins = [process.env.FRONTEND_URL, 'https://safisquad.co.ke', 'https://www.safisquad.co.ke', process.env.NODE_ENV !== 'production' && 'http://localhost:5173', process.env.NODE_ENV !== 'production' && 'http://127.0.0.1:5173'].filter(Boolean);
app.use(cors({ origin: (origin, callback) => { if (!origin || allowedOrigins.includes(origin)) return callback(null, true); return callback(new Error(`CORS blocked: ${origin}`)); }, credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'], maxAge: 86400 }));
app.use(express.json());

app.get('/api/health', async (_request, response) => {
  if (usingLocalStorage) return response.json({ status: 'ok', database: 'local-file' });
  try {
    await pool.query('SELECT 1');
    response.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('Database health check failed', error.message);
    emit('health.degraded', { service: 'database', message: 'Database connectivity degraded' });
    response.status(503).json({ status: 'degraded', database: 'disconnected' });
  }
});

app.get('/api/system/maintenance', authGuard(), (_request, response) => response.json(localSystem.maintenance));

app.post('/api/system/maintenance', authGuard(['TECHNICAL', 'SUPER_ADMIN']), async (request, response) => {
  const { enabled, message = 'Safi Squad is temporarily unavailable while we perform maintenance.', durationMinutes = 60 } = request.body || {};
  if (typeof enabled !== 'boolean') return response.status(400).json({ error: 'enabled must be a boolean.' });
  const duration = Math.max(1, Math.min(1440, Number(durationMinutes) || 60));
  localSystem.maintenance = { enabled, message: String(message).trim(), until: enabled ? Date.now() + duration * 60_000 : null, updatedAt: new Date().toISOString() };
  if (usingLocalStorage) saveLocalSystem();
  await logAudit(request.user.userId, enabled ? 'MAINTENANCE_ENABLED' : 'MAINTENANCE_DISABLED', 'SYSTEM', 'maintenance', { message, durationMinutes: duration });
  emit(enabled ? 'system.maintenance' : 'system.restored', { ...localSystem.maintenance });
  response.json({ ok: true, maintenance: localSystem.maintenance });
});

app.post('/api/system/broadcast', authGuard(['TECHNICAL', 'SUPER_ADMIN', 'MANAGEMENT']), async (request, response) => {
  const { message, priority = 'NORMAL' } = request.body || {};
  if (!message || !['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(priority)) return response.status(400).json({ error: 'Message and valid priority are required.' });
  await logAudit(request.user.userId, 'SYSTEM_BROADCAST', 'SYSTEM', 'broadcast', { priority, message });
  emit('system.broadcast', { message: String(message).trim(), priority, fromUserId: request.user.userId });
  response.status(201).json({ ok: true });
});

app.post('/api/webhooks/mpesa', async (request, response) => {
  const callback = request.body?.Body?.stkCallback || request.body?.stkCallback || {};
  const forwardedIp = request.headers['x-forwarded-for']?.split(',')[0].trim();
  const callbackIp = forwardedIp || request.socket.remoteAddress?.replace(/^::ffff:/, '');
  const safaricomIps = new Set((process.env.SAFARICOM_IPS || '196.201.214.200,196.201.214.206,196.201.213.114,196.201.214.207,196.201.214.208,196.201.213.44,196.201.212.127,196.201.212.128,196.201.212.129,196.201.212.132,196.201.212.136,196.201.212.138').split(',').map((ip) => ip.trim()).filter(Boolean));
  if (process.env.NODE_ENV === 'production' && process.env.MPESA_SKIP_IP_VALIDATION !== 'true' && !safaricomIps.has(callbackIp)) return response.status(401).json({ error: 'Untrusted callback source.' });
  const checkoutRequestId = callback.CheckoutRequestID || request.body?.CheckoutRequestID;
  if (!checkoutRequestId) return response.status(400).json({ error: 'Checkout request reference is required.' });
  const resultCode = Number(callback.ResultCode);
  const metadata = paymentMetadata(callback.CallbackMetadata);
  const reference = metadata.AccountReference || request.body?.accountReference || '';
  const providerReference = metadata.MpesaReceiptNumber || checkoutRequestId;
  if (!reference) return response.status(400).json({ error: 'Payment reference is required.' });
  if (usingLocalStorage && localPayments.some((payment) => payment.provider_reference === providerReference)) return response.json({ ResultCode: 0, ResultDesc: 'Already processed' });
  let pendingRequest;
  if (usingLocalStorage) {
    pendingRequest = localMpesaRequests.find((item) => item.checkout_request_id === checkoutRequestId && item.status === 'PENDING');
    if (!pendingRequest) return response.status(400).json({ error: 'Unknown or completed checkout request.' });
  } else {
    const pendingResult = await pool.query("SELECT order_id, amount FROM mpesa_requests WHERE checkout_request_id = $1 AND status = 'PENDING'", [checkoutRequestId]);
    pendingRequest = pendingResult.rows[0];
    if (!pendingRequest) return response.status(400).json({ error: 'Unknown or completed checkout request.' });
  }
  const trackingCode = String(reference).toUpperCase();
  const amount = money(metadata.Amount || request.body?.amount || 0);
  if (resultCode !== 0) {
    if (usingLocalStorage) { pendingRequest.status = 'FAILED'; pendingRequest.completed_at = new Date().toISOString(); saveLocalMpesaRequests(); }
    emit('payment.failed', { trackingCode, reference: providerReference, resultCode, message: callback.ResultDesc || 'Payment failed' });
    return response.json({ ResultCode: 0, ResultDesc: 'Callback received' });
  }
  if (!decimal(pendingRequest.amount).eq(decimal(amount))) return response.status(400).json({ error: 'Callback amount does not match the initiated payment.' });
  if (usingLocalStorage) {
    const order = localOrders.find((item) => item.tracking_code === trackingCode);
    if (!order) return response.status(404).json({ error: 'Order not found.' });
    const payment = { id: Date.now(), order_id: order.id, amount, type: 'DEPOSIT', status: 'PAID', provider_reference: providerReference, created_at: new Date().toISOString() };
    localPayments.unshift(payment); applyPaymentEvent(order, payment);
    const pending = localMpesaRequests.find((item) => item.checkout_request_id === checkoutRequestId);
    if (pending) { pending.status = 'COMPLETED'; pending.completed_at = new Date().toISOString(); }
    saveLocalPayments(); saveLocalOrders(); saveLocalMpesaRequests();
    return response.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const requestResult = await client.query("SELECT order_id FROM mpesa_requests WHERE checkout_request_id = $1 AND status = 'PENDING' FOR UPDATE", [checkoutRequestId]);
    if (!requestResult.rowCount) { await client.query('ROLLBACK'); return response.status(400).json({ error: 'Unknown or completed checkout request.' }); }
    if (Number(requestResult.rows[0].order_id) !== Number(pendingRequest.order_id)) { await client.query('ROLLBACK'); return response.status(400).json({ error: 'Checkout request does not match the payment order.' }); }
    const orderResult = await client.query('SELECT * FROM orders WHERE tracking_code = $1 FOR UPDATE', [trackingCode]);
    if (!orderResult.rowCount) { await client.query('ROLLBACK'); return response.status(404).json({ error: 'Order not found.' }); }
    const paymentResult = await client.query(
      'INSERT INTO payments (order_id, amount, type, status, provider_reference) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (provider_reference) DO NOTHING RETURNING *',
      [orderResult.rows[0].id, amount, 'DEPOSIT', 'PAID', providerReference],
    );
    if (!paymentResult.rowCount) { await client.query('ROLLBACK'); return response.json({ ResultCode: 0, ResultDesc: 'Accepted (duplicate)' }); }
    await client.query('UPDATE orders SET deposit_paid = deposit_paid + $1, updated_at = NOW() WHERE id = $2', [amount, orderResult.rows[0].id]);
    await client.query("UPDATE mpesa_requests SET status = 'COMPLETED', completed_at = NOW() WHERE checkout_request_id = $1", [checkoutRequestId]);
    await client.query('COMMIT');
    emit('payment.received', { orderId: orderResult.rows[0].id, trackingCode, amount, reference: providerReference });
    response.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) { await client.query('ROLLBACK'); response.status(500).json({ error: 'Could not record payment.' }); } finally { client.release(); }
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
      : (await pool.query('SELECT id, email, password_hash, role, is_active, status, token_version FROM users WHERE email = $1', [email.toLowerCase()])).rows[0];
    if (!user || user.is_active === false || user.status === 'PENDING' || user.status === 'SUSPENDED' || !(await verifyPassword(password, user.password_hash))) return response.status(401).json({ error: 'Invalid email or password.' });
    response.json({ token: issueToken(user), refreshToken: issueRefreshToken(user), user: { id: user.id, email: user.email, role: normalizeRole(user.role), department: departmentForRole(user.role) } });
  } catch (error) { response.status(500).json({ error: 'Login is unavailable.' }); }
});

app.post('/api/auth/refresh', async (request, response) => {
  const refreshToken = request.body?.refreshToken;
  if (!refreshToken) return response.status(401).json({ error: 'Refresh token is required.' });
  try {
    const payload = verifyToken(refreshToken);
    if (payload.type !== 'refresh') return response.status(401).json({ error: 'Invalid refresh token.' });
    const user = usingLocalStorage
      ? localUsers.find((item) => item.id === Number(payload.userId))
      : (await pool.query('SELECT id, email, role, is_active, status, token_version FROM users WHERE id = $1', [payload.userId])).rows[0];
    if (!user || user.is_active === false || user.status !== 'ACTIVE' || Number(user.token_version || 0) !== Number(payload.tokenVersion || 0)) return response.status(401).json({ error: 'Refresh token revoked.' });
    response.json({ token: issueToken(user), refreshToken: issueRefreshToken(user) });
  } catch (_error) { response.status(401).json({ error: 'Invalid or expired refresh token.' }); }
});

app.get('/api/dashboard/stream', authGuard(), (request, response) => {
  const userId = String(request.user.userId);
  const connections = sseConnections.get(userId) || new Set();
  if (connections.size >= MAX_SSE_PER_USER) {
    const oldest = connections.values().next().value;
    oldest.end();
    connections.delete(oldest);
  }
  connections.add(response);
  sseConnections.set(userId, connections);
  const department = departmentForRole(request.user.role);
  const patterns = roleEvents[department] || roleEvents.SECRETARIAT;
  response.status(200).set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' });
  response.flushHeaders();
  response.write(': connected\n\n');
  const send = (envelope) => response.write(`data: ${JSON.stringify(envelope)}\n\n`);
  const lastEventId = request.headers['last-event-id'] || request.query.lastEventId;
  const replay = lastEventId ? patterns.flatMap((pattern) => eventsAfter(lastEventId, pattern)) : [];
  const replaySince = Date.now() - 5 * 60 * 1000;
  Promise.all(patterns.map((pattern) => replayEvents(replaySince, pattern))).then((batches) => {
    const events = [...replay, ...batches.flat()].filter((event, index, all) => all.findIndex((candidate) => candidate.id === event.id) === index).sort((a, b) => new Date(a.at) - new Date(b.at));
    events.slice(-100).forEach(send);
  }).catch(() => {});
  const cleanups = patterns.map((pattern) => subscribe(pattern, send));
  const heartbeat = setInterval(() => response.write(': ping\n\n'), 25000);
  const lifetime = setTimeout(() => response.end(), MAX_SSE_LIFETIME_MS);
  request.on('close', () => { clearTimeout(lifetime); clearInterval(heartbeat); cleanups.forEach((cleanup) => cleanup()); connections.delete(response); if (connections.size === 0) sseConnections.delete(userId); });
});

app.get('/api/technical/metrics/sse', authGuard(['TECHNICAL', 'ADMIN']), (_request, response) => {
  const byUser = Object.fromEntries([...sseConnections.entries()].map(([userId, connections]) => [userId, connections.size]));
  response.json({ total: Object.values(byUser).reduce((sum, count) => sum + count, 0), uniqueUsers: Object.keys(byUser).length, byUser });
});

app.get('/api/messages', authGuard(), async (request, response) => {
  const department = departmentForRole(request.user.role);
  if (usingLocalStorage) {
    const messages = localMessages.filter((message) => department === 'MANAGEMENT' || message.to_dept === department || message.from_dept === department);
    return response.json({ messages });
  }
  const result = department === 'MANAGEMENT'
    ? await pool.query('SELECT * FROM inter_dept_messages ORDER BY created_at DESC LIMIT 100')
    : await pool.query('SELECT * FROM inter_dept_messages WHERE to_dept = $1 OR from_dept = $1 ORDER BY created_at DESC LIMIT 100', [department]);
  response.json({ messages: result.rows });
});

app.post('/api/messages', authGuard(), async (request, response) => {
  const { toDept, subject, body, relatedType, relatedId, priority = 'NORMAL' } = request.body || {};
  const validDepartments = ['SECRETARIAT', 'FINANCE', 'MANAGEMENT', 'PROMOTIONS', 'TECHNICAL'];
  const fromDept = departmentForRole(request.user.role);
  if (!validDepartments.includes(toDept) || !subject || !body || !['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(priority)) return response.status(400).json({ error: 'Recipient, subject, body, and valid priority are required.' });
  if (toDept === fromDept && fromDept !== 'MANAGEMENT') return response.status(400).json({ error: 'Choose another department.' });
  if (usingLocalStorage) {
    const message = { id: Date.now(), from_dept: fromDept, to_dept: toDept, subject: String(subject).trim(), body: String(body).trim(), related_type: relatedType || null, related_id: relatedId || null, priority, status: 'UNREAD', created_by: request.user.userId, created_at: new Date().toISOString() };
    localMessages.unshift(message); saveLocalMessages(); emit('query.raised', { messageId: message.id, toDept, fromDept, subject: message.subject, priority });
    return response.status(201).json({ message });
  }
  const result = await pool.query('INSERT INTO inter_dept_messages (from_dept, to_dept, subject, body, related_type, related_id, priority, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *', [fromDept, toDept, String(subject).trim(), String(body).trim(), relatedType || null, relatedId || null, priority, request.user.userId]);
  emit('query.raised', { messageId: result.rows[0].id, toDept, fromDept, subject: result.rows[0].subject, priority });
  response.status(201).json({ message: result.rows[0] });
});

app.patch('/api/messages/:id', authGuard(), async (request, response) => {
  const { status } = request.body || {};
  if (!['READ', 'RESOLVED', 'ARCHIVED'].includes(status)) return response.status(400).json({ error: 'Invalid message status.' });
  const department = departmentForRole(request.user.role);
  if (usingLocalStorage) {
    const message = localMessages.find((item) => item.id === Number(request.params.id));
    if (!message) return response.status(404).json({ error: 'Message not found.' });
    if (department !== 'MANAGEMENT' && message.to_dept !== department && message.from_dept !== department) return response.status(403).json({ error: 'You cannot update this message.' });
    message.status = status;
    if (status === 'READ') message.read_at = new Date().toISOString();
    if (status === 'RESOLVED') message.resolved_at = new Date().toISOString();
    saveLocalMessages();
    return response.json({ message });
  }
  const timestamp = status === 'READ' ? 'read_at' : status === 'RESOLVED' ? 'resolved_at' : null;
  const visibility = department === 'MANAGEMENT' ? '' : ' AND (to_dept = $3 OR from_dept = $3)';
  const values = department === 'MANAGEMENT' ? [status, request.params.id] : [status, request.params.id, department];
  const result = await pool.query(`UPDATE inter_dept_messages SET status = $1${timestamp ? `, ${timestamp} = NOW()` : ''} WHERE id = $2${visibility} RETURNING *`, values);
  if (!result.rowCount) return response.status(404).json({ error: 'Message not found.' });
  response.json({ message: result.rows[0] });
});

app.get('/api/users', authGuard(['ADMIN']), async (_request, response) => {
  if (usingLocalStorage) return response.json({ users: localUsers.map(({ password_hash, token_version, ...user }) => user) });
  const result = await pool.query('SELECT id, email, role, phone, is_active, status, approved_by, approved_at, created_at FROM users ORDER BY created_at ASC');
  response.json({ users: result.rows });
});

app.post('/api/users', authGuard(['ADMIN']), async (request, response) => {
  const { email, password, role = 'MEMBER', phone } = request.body;
  const validStaffRoles = ['ADMIN', 'SUPER_ADMIN', 'MANAGEMENT', 'SECRETARIAT', 'FINANCE', 'FINANCE_OFFICER', 'PROMOTIONS', 'TECHNICAL', 'MEMBER'];
  if (!email || !password || !validStaffRoles.includes(String(role).toUpperCase())) return response.status(400).json({ error: 'Email, password, and a valid staff role are required.' });
  const normalizedRole = String(role).toUpperCase();
  const passwordHash = await hashPassword(password);
  if (usingLocalStorage) {
    if (localUsers.some((user) => user.email === email.toLowerCase())) return response.status(409).json({ error: 'Email already exists.' });
    const user = { id: localUsers.length + 1, email: email.toLowerCase(), password_hash: passwordHash, role: normalizedRole, phone: phone || null, is_active: true, status: 'ACTIVE', token_version: 0, created_at: new Date().toISOString() };
    localUsers.push(user); saveLocalUsers(); return response.status(201).json({ user: { id: user.id, email: user.email, role: user.role, phone: user.phone } });
  }
  try {
    const result = await pool.query("INSERT INTO users (email, password_hash, role, phone, status, is_active) VALUES ($1,$2,$3,$4,'ACTIVE',TRUE) RETURNING id, email, role, phone, is_active, status", [email.toLowerCase(), passwordHash, normalizedRole, phone || null]);
    response.status(201).json({ user: result.rows[0] });
  } catch (_error) { response.status(409).json({ error: 'Could not create staff user.' }); }
});

app.post('/api/auth/signup', async (request, response) => {
  const { email, password, role = 'CUSTOMER', name, phone } = request.body || {};
  const requestedRole = normalizeRole(role);
  const allowedRoles = ['CUSTOMER', 'MEMBER', 'SECRETARIAT', 'FINANCE', 'FINANCE_OFFICER', 'PROMOTIONS', 'TECHNICAL'];
  if (!email || !password || !name || !allowedRoles.includes(requestedRole) || String(password).length < 12) return response.status(400).json({ error: 'Name, email, a 12-character password, and a valid role are required.' });
  const status = requestedRole === 'CUSTOMER' ? 'ACTIVE' : 'PENDING';
  const isActive = status === 'ACTIVE';
  const passwordHash = await hashPassword(password);
  try {
    if (usingLocalStorage) {
      if (localUsers.some((user) => user.email === String(email).toLowerCase())) return response.status(409).json({ error: 'Email already exists.' });
      localUsers.push({ id: localUsers.length + 1, email: String(email).toLowerCase(), password_hash: passwordHash, role: requestedRole, name: String(name).trim(), phone: phone || null, status, is_active: isActive, token_version: 0, created_at: new Date().toISOString() });
      saveLocalUsers();
    } else {
      await pool.query('INSERT INTO users (email, password_hash, role, name, phone, status, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7)', [String(email).toLowerCase(), passwordHash, requestedRole, String(name).trim(), phone || null, status, isActive]);
    }
    emit('user.signup_requested', { email: String(email).toLowerCase(), requestedRole, status });
    response.status(status === 'ACTIVE' ? 201 : 202).json({ message: status === 'ACTIVE' ? 'Account created.' : 'Account pending administrator approval.' });
  } catch (_error) { response.status(409).json({ error: 'Could not create account.' }); }
});

app.patch('/api/users/:id/approval', authGuard(['ADMIN']), async (request, response) => {
  const status = String(request.body?.status || '').toUpperCase();
  if (!['PENDING', 'ACTIVE', 'SUSPENDED'].includes(status)) return response.status(400).json({ error: 'Invalid approval status.' });
  const isActive = status === 'ACTIVE';
  if (usingLocalStorage) {
    const user = localUsers.find((item) => item.id === Number(request.params.id));
    if (!user) return response.status(404).json({ error: 'User not found.' });
    user.status = status; user.is_active = isActive; user.approved_by = request.user.userId; user.approved_at = status === 'ACTIVE' ? new Date().toISOString() : null; user.token_version = (Number(user.token_version) || 0) + 1;
    saveLocalUsers();
    return response.json({ user: { id: user.id, email: user.email, role: user.role, status: user.status, is_active: user.is_active } });
  }
  const result = await pool.query('UPDATE users SET status = $1, is_active = $2, approved_by = $3, approved_at = CASE WHEN $1 = \'ACTIVE\' THEN NOW() ELSE NULL END, token_version = token_version + 1 WHERE id = $4 RETURNING id, email, role, status, is_active, approved_by, approved_at', [status, isActive, request.user.userId, request.params.id]);
  if (!result.rowCount) return response.status(404).json({ error: 'User not found.' });
  response.json({ user: result.rows[0] });
});

app.patch('/api/users/:id/status', authGuard(['ADMIN']), async (request, response) => {
  const isActive = request.body?.isActive;
  if (typeof isActive !== 'boolean') return response.status(400).json({ error: 'isActive must be a boolean.' });
  if (usingLocalStorage) {
    const user = localUsers.find((item) => item.id === Number(request.params.id));
    if (!user) return response.status(404).json({ error: 'User not found.' });
    user.is_active = isActive;
    user.token_version = (Number(user.token_version) || 0) + 1;
    saveLocalUsers();
    return response.json({ user: { id: user.id, email: user.email, role: user.role, is_active: user.is_active } });
  }
  const result = await pool.query('UPDATE users SET is_active = $1, token_version = token_version + 1 WHERE id = $2 RETURNING id, email, role, is_active, token_version', [isActive, request.params.id]);
  if (!result.rowCount) return response.status(404).json({ error: 'User not found.' });
  response.json({ user: result.rows[0] });
});

app.post('/api/orders', async (request, response) => {
  const validation = normalizeOrderInput(request.body || {});
  if (!validation.ok) {
    return response.status(400).json({ error: validation.errors[0] || 'The booking information is incomplete.' });
  }

  const { name, phone, email, address, building, room, floor, preferredDate, preferredTime, serviceId, service, services = [], details, quantity } = request.body;
  const requestedServices = Array.isArray(services) ? services.filter(Boolean) : [service].filter(Boolean);
  const pickupAddress = address || [building, room, floor].filter(Boolean).join(', ');
  const selectedService = service || requestedServices[0] || validation.data.service;
  const selected = calculateOrderTotal(serviceId || validation.data.serviceId || 'house-deep-cleaning', quantity || validation.data.quantity);
  if (!selected) return response.status(400).json({ error: 'Unknown service.' });

  const total = requestedServices.reduce((sum, requestedService) => {
    const match = serviceCatalog.find((item) => item.name === requestedService || item.id === requestedService);
    return sum + (match ? match.price * Math.max(1, Number(quantity) || 1) : 0);
  }, 0) || selected.total;
  const serviceDetails = { building, room, floor: floor || '', preferredTime, notes: details || '', services: requestedServices };
  const customerIsNew = usingLocalStorage ? !localOrders.some((item) => item.phone === phone) : (await pool.query('SELECT 1 FROM orders WHERE phone = $1 LIMIT 1', [phone])).rowCount === 0;
  const depositPaid = customerIsNew ? total * 0.5 : 0;

  if (usingLocalStorage) {
    const now = new Date().toISOString();
    const order = {
      id: localOrders.length + 1,
      tracking_code: `SQ-${Date.now().toString(36).toUpperCase()}`,
      customer_name: name,
      phone,
      email,
      address: pickupAddress,
      preferred_date: preferredDate,
      service: requestedServices.join(', ') || selected.service.name,
      services: requestedServices.length ? requestedServices : [selected.service.name],
      service_id: selected.service.id,
      service_details: serviceDetails,
      quantity: Number(quantity) || validation.data.quantity,
      estimated_cost: total,
      deposit_paid: depositPaid,
      customer_is_new: customerIsNew,
      status: 'Pending',
      version: 0,
      created_at: now,
      updated_at: now,
      events: [{ status: 'Pending', note: 'Booking received', created_at: now }],
      workflow_steps: [{ status: 'Pending', started_at: now }],
      photos: [],
    };
    localOrders.unshift(order); saveLocalOrders();
    logAudit(null, 'ORDER_CREATED', 'ORDER', order.tracking_code, { customerName: name, total, trackingCode: order.tracking_code });
    emit('order.created', { orderId: order.id, trackingCode: order.tracking_code, amount: total, services: order.services });
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
      [trackingCode, name, phone, email, pickupAddress, preferredDate, requestedServices.join(', ') || selected.service.name, JSON.stringify(serviceDetails), Number(quantity) || validation.data.quantity, total, depositPaid],
    );
    const order = orderResult.rows[0];
    await client.query('INSERT INTO order_events (order_id, status, note) VALUES ($1, $2, $3)', [order.id, 'Pending', 'Booking received']);
    await client.query('INSERT INTO workflow_steps (order_id, status, actor_id, note) VALUES ($1, $2, $3, $4)', [order.id, 'Pending', null, 'Booking received']);
    await client.query('INSERT INTO payments (order_id, amount, type, status) VALUES ($1, $2, $3, $4)', [order.id, depositPaid, 'DEPOSIT', 'PENDING']);
    await client.query('INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata) VALUES ($1, $2, $3, $4, $5)', [null, 'ORDER_CREATED', 'ORDER', String(order.id), JSON.stringify({ trackingCode, total, customerName: name })]);
    await client.query('COMMIT');
    emit('order.created', { orderId: order.id, trackingCode: order.tracking_code, amount: total, services: requestedServices });
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

app.patch('/api/orders/:id/status', authGuard(['ADMIN', 'MEMBER', 'FINANCE_OFFICER']), async (request, response) => {
  const { status, note, version } = request.body;
  if (!orderStatuses.includes(status)) return response.status(400).json({ error: 'Invalid order status.' });
  const expectedVersion = Number(version);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) return response.status(400).json({ error: 'A valid order version is required. Refresh the order and try again.' });
  const canOverride = ['ADMIN', 'SUPER_ADMIN', 'MANAGEMENT'].includes(normalizeRole(request.user.role));
  const canAdvance = ['ADMIN', 'SUPER_ADMIN', 'MANAGEMENT', 'SECRETARIAT', 'MEMBER'].includes(normalizeRole(request.user.role));
  if (!canAdvance) return response.status(403).json({ error: 'Only Secretariat or Management can change order status.' });
  if (usingLocalStorage) {
    const order = localOrders.find((item) => item.id === Number(request.params.id));
    if (!order) return response.status(404).json({ error: 'Order not found.' });
    if (!Number.isInteger(order.version)) order.version = 0;
    if (order.version !== expectedVersion) return response.status(409).json({ error: 'Order was modified by another user. Refresh and try again.', code: 'STALE_ORDER_VERSION', order });
    const previousStatus = order.status;
    try { assertTransition(previousStatus, status, { override: canOverride }); } catch (error) { return response.status(409).json({ error: error.message }); }
    if (canOverride && previousStatus !== status && !note) return response.status(400).json({ error: 'Management overrides require a reason.' });
    order.status = status; order.version += 1; order.updated_at = new Date().toISOString(); order.events.push({ status, note: note || `Status updated to ${status}`, created_at: order.updated_at });
    saveLocalOrders();
    emit('order.status_changed', { orderId: order.id, trackingCode: order.tracking_code, previousStatus, status, actorId: request.user.userId });
    if (status === 'Delivered') emit('order.delivered', { orderId: order.id, trackingCode: order.tracking_code, amount: order.estimated_cost });
    logAudit(request.user.userId, 'ORDER_STATUS_UPDATED', 'ORDER', order.id, { previousStatus, currentStatus: status, note: note || `Status updated to ${status}` });
    return response.json({ order });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const previous = await client.query('SELECT status, version FROM orders WHERE id = $1 FOR UPDATE', [request.params.id]);
    if (!previous.rowCount) { await client.query('ROLLBACK'); return response.status(404).json({ error: 'Order not found.' }); }
    try { assertTransition(previous.rows[0].status, status, { override: canOverride }); } catch (error) { await client.query('ROLLBACK'); return response.status(409).json({ error: error.message }); }
    if (canOverride && previous.rows[0].status !== status && !note) { await client.query('ROLLBACK'); return response.status(400).json({ error: 'Management overrides require a reason.' }); }
    const result = await client.query('UPDATE orders SET status = $1, version = version + 1, updated_at = NOW() WHERE id = $2 AND version = $3 RETURNING *', [status, request.params.id, expectedVersion]);
    if (!result.rowCount) { await client.query('ROLLBACK'); return response.status(409).json({ error: 'Order was modified by another user. Refresh and try again.', code: 'STALE_ORDER_VERSION' }); }
    await client.query('INSERT INTO order_events (order_id, status, note) VALUES ($1, $2, $3)', [request.params.id, status, note || `Status updated to ${status}`]);
    await client.query('INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata) VALUES ($1, $2, $3, $4, $5)', [request.user.userId, 'ORDER_STATUS_UPDATED', 'ORDER', request.params.id, JSON.stringify({ previousStatus: previous.rows[0]?.status, currentStatus: status, note: note || `Status updated to ${status}` })]);
    await client.query('COMMIT');
    emit('order.status_changed', { orderId: result.rows[0].id, trackingCode: result.rows[0].tracking_code, previousStatus: previous.rows[0]?.status, status, actorId: request.user.userId });
    if (status === 'Delivered') emit('order.delivered', { orderId: result.rows[0].id, trackingCode: result.rows[0].tracking_code, amount: result.rows[0].estimated_cost });
    response.json({ order: result.rows[0] });
  } catch (error) { await client.query('ROLLBACK'); response.status(500).json({ error: 'Could not update the order.' }); }
  finally { client.release(); }
});

app.patch('/api/orders/:id/workflow', authGuard(['ADMIN', 'MEMBER']), async (request, response) => {
  const { status, note, photoUrl, photoType, version } = request.body;
  if (!orderStatuses.includes(status)) return response.status(400).json({ error: 'Invalid workflow status.' });
  const expectedVersion = Number(version);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) return response.status(400).json({ error: 'A valid order version is required. Refresh the order and try again.' });
  const role = normalizeRole(request.user.role);
  if (!['ADMIN', 'SUPER_ADMIN', 'MANAGEMENT', 'SECRETARIAT', 'MEMBER'].includes(role)) return response.status(403).json({ error: 'Only Secretariat or Management can update workflow.' });
  if (photoUrl && !['BEFORE', 'AFTER'].includes(photoType)) return response.status(400).json({ error: 'photoType must be BEFORE or AFTER.' });
  if (photoUrl && !isSafePhotoUrl(photoUrl)) return response.status(400).json({ error: 'photoUrl must be a valid HTTPS URL on a public host.' });
  const now = new Date().toISOString();
  if (usingLocalStorage) {
    const order = localOrders.find((item) => item.id === Number(request.params.id));
    if (!order) return response.status(404).json({ error: 'Order not found.' });
    if (!Number.isInteger(order.version)) order.version = 0;
    if (order.version !== expectedVersion) return response.status(409).json({ error: 'Order was modified by another user. Refresh and try again.', code: 'STALE_ORDER_VERSION', order });
    try { assertTransition(order.status, status, { override: ['ADMIN', 'SUPER_ADMIN', 'MANAGEMENT'].includes(role) }); } catch (error) { return response.status(409).json({ error: error.message }); }
    order.status = status; order.version += 1; order.updated_at = now;
    order.events.push({ status, note: note || `Workflow updated to ${status}`, created_at: now });
    order.workflow_steps = order.workflow_steps || []; order.workflow_steps.push({ status, started_at: now, actor_id: request.user.userId, note: note || null });
    if (photoUrl) { order.photos = order.photos || []; order.photos.push({ photo_type: photoType, url: photoUrl, uploaded_by: request.user.userId, created_at: now }); }
    saveLocalOrders(); saveLocalWorkflow();
    emit('order.status_changed', { orderId: order.id, trackingCode: order.tracking_code, status, actorId: request.user.userId });
    return response.json({ order });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const previous = await client.query('SELECT status, version FROM orders WHERE id = $1 FOR UPDATE', [request.params.id]);
    if (!previous.rowCount) { await client.query('ROLLBACK'); return response.status(404).json({ error: 'Order not found.' }); }
    try { assertTransition(previous.rows[0].status, status, { override: ['ADMIN', 'SUPER_ADMIN', 'MANAGEMENT'].includes(role) }); } catch (error) { await client.query('ROLLBACK'); return response.status(409).json({ error: error.message }); }
    if (['ADMIN', 'SUPER_ADMIN', 'MANAGEMENT'].includes(role) && previous.rows[0].status !== status && !note) { await client.query('ROLLBACK'); return response.status(400).json({ error: 'Management overrides require a reason.' }); }
    const result = await client.query('UPDATE orders SET status = $1, version = version + 1, updated_at = NOW() WHERE id = $2 AND version = $3 RETURNING *', [status, request.params.id, expectedVersion]);
    if (!result.rowCount) { await client.query('ROLLBACK'); return response.status(409).json({ error: 'Order was modified by another user. Refresh and try again.', code: 'STALE_ORDER_VERSION' }); }
    await client.query('INSERT INTO order_events (order_id, status, note) VALUES ($1, $2, $3)', [request.params.id, status, note || `Workflow updated to ${status}`]);
    await client.query('INSERT INTO workflow_steps (order_id, status, actor_id, note) VALUES ($1, $2, $3, $4)', [request.params.id, status, request.user.userId, note || null]);
    if (photoUrl) await client.query('INSERT INTO order_photos (order_id, photo_type, url, uploaded_by) VALUES ($1, $2, $3, $4)', [request.params.id, photoType, photoUrl, request.user.userId]);
    await client.query('INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata) VALUES ($1, $2, $3, $4, $5)', [request.user.userId, 'WORKFLOW_UPDATED', 'ORDER', request.params.id, JSON.stringify({ status, photoUrl: Boolean(photoUrl) })]);
    await client.query('COMMIT');
    emit('order.status_changed', { orderId: result.rows[0].id, trackingCode: result.rows[0].tracking_code, status, actorId: request.user.userId });
    response.json({ order: result.rows[0] });
  } catch (error) { await client.query('ROLLBACK'); response.status(500).json({ error: 'Could not update workflow.' }); }
  finally { client.release(); }
});

app.get('/api/admin/overview', authGuard(['ADMIN', 'MEMBER', 'FINANCE_OFFICER']), async (_request, response) => {
  const orders = usingLocalStorage ? localOrders : (await pool.query('SELECT * FROM orders')).rows;
  const overview = buildAdminOverview(orders);
  response.json({ ...overview });
});

app.get('/api/admin/audit', authGuard(['ADMIN', 'MEMBER', 'FINANCE_OFFICER']), async (_request, response) => {
  if (usingLocalStorage) {
    const summary = summarizeAuditLogs(localAuditLogs.slice(0, 50));
    return response.json({ audit: localAuditLogs.slice(0, 50), summary });
  }
  const result = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 50');
  response.json({ audit: result.rows, summary: summarizeAuditLogs(result.rows) });
});

app.get('/api/admin/metrics', authGuard(['ADMIN', 'MEMBER', 'FINANCE_OFFICER']), async (_request, response) => {
  const orders = usingLocalStorage ? localOrders : (await pool.query('SELECT * FROM orders')).rows;
  const overview = buildAdminOverview(orders);
  const counts = overview.statusBreakdown;
  const health = {
    onTrack: Math.max(0, Math.round((Number(counts['Delivered'] || 0) / Math.max(1, overview.totalOrders)) * 100)),
    staffing: Math.max(0, 100 - Math.min(80, overview.pendingPickup * 12)),
    backlog: Math.max(0, overview.activeOrders - overview.qcQueue),
  };
  response.json({ overview, health, lastUpdated: new Date().toISOString() });
});

app.get('/api/management/overview', authGuard(['ADMIN']), async (_request, response) => {
  const orders = usingLocalStorage ? localOrders : (await pool.query('SELECT * FROM orders')).rows;
  const overview = buildAdminOverview(orders);
  const messages = usingLocalStorage
    ? localMessages
    : (await pool.query("SELECT * FROM inter_dept_messages WHERE status IN ('UNREAD', 'READ') ORDER BY created_at DESC LIMIT 100")).rows;
  const pipeline = orderStatuses.reduce((counts, status) => ({ ...counts, [status]: orders.filter((order) => order.status === status).length }), {});
  const unreadQueries = messages.filter((message) => message.status === 'UNREAD').length;
  const urgentQueries = messages.filter((message) => message.status === 'UNREAD' && ['HIGH', 'URGENT'].includes(message.priority)).length;
  const todayInNairobi = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date());
  const ordersToday = usingLocalStorage
    ? orders.filter((order) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date(order.created_at)) === todayInNairobi).length
    : (await pool.query("SELECT COUNT(*)::int AS count FROM orders WHERE created_at >= (CURRENT_DATE AT TIME ZONE 'Africa/Nairobi') AND created_at < ((CURRENT_DATE + INTERVAL '1 day') AT TIME ZONE 'Africa/Nairobi')")).rows[0].count;
  response.json({ ordersToday, revenue: overview.revenue, slaBreaches: orders.filter((order) => order.status !== 'Delivered' && Date.now() - new Date(order.updated_at || order.created_at).getTime() > 24 * 3600_000).length, activeStaff: usingLocalStorage ? localUsers.filter((user) => user.role !== 'CUSTOMER').length : (await pool.query("SELECT COUNT(*)::int AS count FROM users WHERE role <> 'CUSTOMER'")).rows[0].count, pipeline, unreadQueries, urgentQueries, maintenance: localSystem.maintenance, refreshedAt: new Date().toISOString() });
});

app.get('/api/settlements', authGuard(['ADMIN', 'FINANCE_OFFICER']), async (_request, response) => {
  if (usingLocalStorage) {
    const settlements = localPayouts.map((item) => ({
      ...item.settlement,
      payouts: item.payouts || [],
      approval_required: item.approval_required || true,
    }));
    return response.json({ settlements, summary: { totalSettlements: settlements.length, totalDistributable: settlements.reduce((sum, item) => addMoney(sum, item.distributable_amount || 0), 0) } });
  }
  const result = await pool.query(`SELECT sr.*, COALESCE(json_agg(p ORDER BY p.amount DESC) FILTER (WHERE p.id IS NOT NULL), '[]') AS payouts FROM settlement_runs sr LEFT JOIN payouts p ON p.week_start = sr.week_start GROUP BY sr.id ORDER BY sr.created_at DESC`);
  response.json({ settlements: result.rows, summary: { totalSettlements: result.rowCount, totalDistributable: result.rows.reduce((sum, item) => addMoney(sum, item.distributable_amount || 0), 0) } });
});

app.post('/api/settlements/:weekStart/calculate', authGuard(['ADMIN', 'FINANCE_OFFICER']), async (request, response) => {
  const { weekStart } = request.params;
  const revenue = money(request.body.revenue || 0);
  const restockAllocation = money(request.body.restockAllocation || 0);
  const contingencyBuffer = money(request.body.contingencyBuffer || 0);
  const memberHours = Array.isArray(request.body.memberHours) ? request.body.memberHours : [];
  const plan = buildSettlementPlan({ revenue, restockAllocation, contingencyBuffer, memberHours });
  const run = { id: Date.now(), week_start: weekStart, revenue: plan.revenue, restock_allocation: plan.restockAllocation, contingency_buffer: plan.contingencyBuffer, growth_fund: plan.growthFund, distributable_amount: plan.distributableAmount, status: 'PENDING_REVIEW', created_at: new Date().toISOString() };
  const payouts = plan.payouts.map((item) => ({ user_id: Number(item.user_id), week_start: weekStart, hours: Number(item.hours || 0), amount: money(item.amount || 0), status: 'PENDING_REVIEW' }));
  if (usingLocalStorage) { localPayouts.unshift({ settlement: run, payouts, approval_required: true }); saveLocalPayouts(); return response.status(201).json({ settlement: run, payouts, approval_required: true, plan }); }
  const result = await pool.query('INSERT INTO settlement_runs (week_start, revenue, restock_allocation, contingency_buffer, growth_fund, distributable_amount) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [weekStart, plan.revenue, plan.restockAllocation, plan.contingencyBuffer, plan.growthFund, plan.distributableAmount]);
  for (const payout of payouts) await pool.query('INSERT INTO payouts (user_id, week_start, amount, status) VALUES ($1,$2,$3,$4)', [payout.user_id, weekStart, payout.amount, 'PENDING_REVIEW']);
  response.status(201).json({ settlement: result.rows[0], payouts, approval_required: true, plan });
});

app.post('/api/settlements/:id/approve', authGuard(['ADMIN', 'FINANCE_OFFICER']), async (request, response) => {
  if (usingLocalStorage) {
    const run = localPayouts.find((item) => item.settlement.id === Number(request.params.id));
    if (!run) return response.status(404).json({ error: 'Settlement not found.' });
    run.settlement.status = 'APPROVED'; run.settlement.approved_at = new Date().toISOString(); run.settlement.approved_by = request.user.userId; saveLocalPayouts();
    logAudit(request.user.userId, 'SETTLEMENT_APPROVED', 'SETTLEMENT', String(run.settlement.id), { approvedAmount: run.settlement.distributable_amount });
    return response.json({ settlement: run.settlement, disbursement: 'READY_FOR_B2C_REVIEW' });
  }
  const result = await pool.query('UPDATE settlement_runs SET status = $1, approved_at = NOW(), approved_by = $2 WHERE id = $3 RETURNING *', ['APPROVED', request.user.userId, request.params.id]);
  if (!result.rowCount) return response.status(404).json({ error: 'Settlement not found.' });
  await pool.query('INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata) VALUES ($1, $2, $3, $4, $5)', [request.user.userId, 'SETTLEMENT_APPROVED', 'SETTLEMENT', request.params.id, JSON.stringify({ approvedAmount: result.rows[0].distributable_amount })]);
  response.json({ settlement: result.rows[0], disbursement: 'READY_FOR_B2C_REVIEW' });
});

app.get('/api/admin/track/:trackingCode', async (request, response) => {
  const trackingCode = String(request.params.trackingCode || '').toUpperCase();
  if (!trackingCode) return response.status(400).json({ error: 'Tracking code is required.' });
  const order = usingLocalStorage ? localOrders.find((item) => item.tracking_code === trackingCode) : (await pool.query('SELECT * FROM orders WHERE tracking_code = $1', [trackingCode])).rows[0];
  if (!order) return response.status(404).json({ error: 'Order not found.' });
  const events = usingLocalStorage ? (order.events || []) : (await pool.query('SELECT status, note, created_at FROM order_events WHERE order_id = $1 ORDER BY created_at ASC', [order.id])).rows;
  const checkpoints = ['Pending', 'Picked Up', 'In-Progress', 'QC Passed', 'Out for Delivery', 'Delivered'];
  const currentStage = checkpoints.includes(order.status) ? order.status : checkpoints[0];
  const progress = Math.round(((checkpoints.indexOf(currentStage) + 1) / checkpoints.length) * 100);
  response.json({ order, progress, checkpoints, events });
});

app.listen(port, async () => {
  try { await ensureSchema(); await seedLocalAdmin(); await initializeRedis(); console.log(usingLocalStorage ? 'Using local order storage' : 'Database schema ready'); } catch (error) { console.error('Database schema setup failed', error.message); }
  console.log(`Safi Squad API running on http://localhost:${port}`);
  cron.schedule('0 23 * * 0', () => createScheduledSettlementDraft().catch((error) => console.error('Settlement draft failed', error.message)));
});
