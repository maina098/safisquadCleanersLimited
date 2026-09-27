# Safi Squad Cleaning Services

Safi Squad is a React/Vite customer website and Express API for booking cleaning and garment-care services, tracking orders, and coordinating day-to-day operations through a role-based portal.

## Implemented features

### Customer website

- Service catalogue for dry cleaning, laundry, steam press, shoe care, toilet cleaning, Airbnb turnover, office cleaning, and other configured services.
- Public service pricing, detailed-price link, service rules, and a multi-line quick estimate calculator.
- Doorstep booking form with customer contact details, building and room information, pickup date/time, multiple services, notes, and duplicate-submit protection.
- Automatic tracking-code generation and booking confirmation response.
- Public order lookup with an order timeline from `Pending` through `Delivered`.
- Optional M-Pesa Daraja STK Push deposits and callback processing when payment credentials are configured.
- Idempotent payment callbacks, amount/order matching, payment event publication, and duplicate-payment protection.
- Operations email notifications through SMTP and SMS notifications through Twilio when configured.
- Public FAQ, privacy policy, terms, 404 page, sitemap, and robots file.
- Cookie consent with optional Google Analytics loading only after acceptance.
- Responsive layouts, keyboard focus states, labelled forms, announced errors, and mobile-safe modals.
- WhatsApp contact shortcut, phone/email contact links, service media, SEO metadata, and canonical URLs.

### Operations portal

- JWT sign-in with bcrypt password hashing, refresh tokens, token-version revocation, active-account checks, and role-aware authorization.
- Role-specific workspace navigation for Management, Secretariat, Finance, Promotions, Technical, Admin, Super Admin, and Member accounts.
- Overview dashboard with active orders, revenue, pending pickups, quality-control queue, total orders, operational health, staffing, backlog, revenue trend, and status breakdown.
- Order queue with customer context, tracking codes, service details, amounts, pickup dates, status controls, and refresh behavior.
- Enforced order lifecycle: `Pending` -> `Picked Up` -> `In-Progress` -> `QC Passed` -> `Out for Delivery` -> `Delivered`.
- Workflow updates, actor attribution, order version checks, audit logging, QR tracking links, and management override support with an override reason.
- Finance workspace with payment totals, settlement runs, restock allocation, contingency buffer, growth fund, distributable amount, and payout approval gates.
- Scheduled settlement draft generation with configurable restock and contingency allocations.
- Team directory and administrator-managed user provisioning, approval, activation, and status controls.
- Promotions workspace for campaign name, channel, budget, and campaign status.
- Technical workspace with system logs and an incident runbook.
- Shared inter-department inbox with priorities, ownership, unread/resolved states, and role-filtered access.
- Maintenance mode controls and system-wide broadcasts for authorized Technical, Management, and Super Admin users.
- Role-filtered server-sent events at `/api/dashboard/stream`, event history/replay, connection heartbeat, and Redis Pub/Sub/Streams support when `REDIS_URL` is configured.
- In-process event transport fallback for single-instance local development.

## Architecture

- `frontend/`: React 19 and Vite customer site plus operations portal.
- `frontend/src/App.jsx`: public flows, authentication, portal workspace, dashboards, and shared UI behavior.
- `frontend/src/App.css` and `frontend/src/index.css`: public and portal styling.
- `backend/server.js`: Express API, persistence selection, authentication, bookings, payments, notifications, maintenance, and dashboard routes.
- `backend/validators.js`: service catalogue, booking normalization, and amount calculation.
- `backend/orderStateMachine.js`: allowed order transitions.
- `backend/security.js`: password hashing, JWT issuance, role normalization, and authorization middleware.
- `backend/ops.js`: overview, settlements, and audit summaries.
- `backend/events.js`: local event bus plus optional Redis transport and event replay.
- `backend/schema.sql`: PostgreSQL reference schema.
- `backend/*.json`: local development persistence for orders, users, payments, payouts, messages, and workflow data.

The API uses PostgreSQL when `DATABASE_URL` is set. Without it, the backend uses the local JSON files so the application can run without a database. PostgreSQL is required for production deployment.

## Requirements

- Node.js 20 or newer recommended.
- npm.
- PostgreSQL for production or multi-instance deployments.
- Redis is optional and required only for shared real-time event delivery across API instances.

## Local setup

Install dependencies:

```powershell
cd backend
npm install
cd ..\frontend
npm install
```

Create `backend/.env` for local configuration. A minimal local setup is:

```text
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:5173
JWT_SECRET=use-a-private-development-secret
ADMIN_EMAIL=admin@safisquad.local
ADMIN_PASSWORD=replace-this-password
```

Add `DATABASE_URL` to use PostgreSQL. Leave it unset to use JSON persistence. Start both services in separate terminals:

```powershell
cd backend
npm run dev
```

```powershell
cd frontend
npm run dev
```

The frontend runs at `http://localhost:5173` and the API at `http://localhost:4000`.

## Configuration

Core settings:

- `NODE_ENV`, `PORT`, `FRONTEND_URL`, `JWT_SECRET`, `DATABASE_URL`
- `DB_POOL_MAX`, `DB_IDLE_TIMEOUT_MS`, `DB_CONNECTION_TIMEOUT_MS`
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- `REDIS_URL`

Notifications:

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `OPERATIONS_EMAIL`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`, `OPERATIONS_PHONE`

Payments and settlements:

- `DARAJA_ENV`, `DARAJA_CONSUMER_KEY`, `DARAJA_CONSUMER_SECRET`, `DARAJA_SHORTCODE`, `DARAJA_PASSKEY`, `DARAJA_CALLBACK_URL`
- `SAFARICOM_IPS`, `MPESA_SKIP_IP_VALIDATION`
- `DEFAULT_RESTOCK_ALLOCATION`, `DEFAULT_CONTINGENCY_BUFFER`

Frontend settings:

- `VITE_API_URL` to point the Vite app at a deployed API.
- `VITE_GA_MEASUREMENT_ID` to enable Google Analytics after optional cookie consent.

In production, `JWT_SECRET` must be at least 32 characters, `FRONTEND_URL` must be an absolute URL, and `DATABASE_URL` must be a PostgreSQL URL.

## Test accounts

Local test accounts can be provisioned with:

```powershell
cd backend
node seed-test-accounts.js
```

This creates or updates these PostgreSQL accounts with the password `SafiTest!2026`:

```text
management.test@safisquad.local  MANAGEMENT
secretariat.test@safisquad.local SECRETARIAT
finance.test@safisquad.local     FINANCE
promotions.test@safisquad.local  PROMOTIONS
technical.test@safisquad.local  TECHNICAL
```

Change these development credentials before using any shared environment. Management and Super Admin accounts should be provisioned by an authorized administrator. Self-service signup supports the configured operational roles and still requires administrator approval where applicable.

## API surface

### Public

- `GET /api/health`
- `GET /api/summary`
- `GET /api/site-content`
- `GET /api/services`
- `POST /api/auth/login`
- `POST /api/auth/signup`
- `POST /api/auth/refresh`
- `POST /api/orders`
- `GET /api/orders/:trackingCode`
- `POST /api/webhooks/mpesa`

### Authenticated operations

- `GET /api/dashboard/stream`
- `GET /api/technical/metrics/sse`
- `GET/POST/PATCH /api/messages` and `/api/messages/:id`
- `GET/POST /api/users`
- `PATCH /api/users/:id/approval`
- `PATCH /api/users/:id/status`
- `GET /api/orders`
- `GET /api/orders/:id/qr`
- `PATCH /api/orders/:id/status`
- `PATCH /api/orders/:id/workflow`
- `GET /api/admin/overview`
- `GET /api/admin/audit`
- `GET /api/admin/metrics`
- `GET /api/management/overview`
- `GET /api/settlements`
- `POST /api/settlements/:weekStart/calculate`
- `POST /api/settlements/:id/approve`
- `GET/POST /api/system/maintenance`
- `POST /api/system/broadcast`

Authorization is enforced by the API even when a route is hidden from a user’s portal navigation.

## Verification

Run the backend tests and frontend checks:

```powershell
cd backend
npm test
cd ..\frontend
npm run lint
npm run build
```

The backend tests cover service amount calculation, booking validation, money rounding, role authorization, order transition rules, admin overview metrics, settlement allocation, and audit summaries.

Before deployment, also verify booking submission, tracking, sign-in, each role’s navigation, status transitions, settlement permissions, inbox messages, SSE reconnect behavior, maintenance banners, payment callbacks, and responsive layouts at desktop and mobile widths.

## Production checklist

- Use private secrets and production credentials; never reuse the sample test password.
- Use PostgreSQL with backups and migrations managed by the deployment process.
- Configure HTTPS, exact CORS origins, Redis persistence where needed, SMTP, Twilio, and Daraja callback credentials.
- Keep M-Pesa callback IP validation enabled unless there is a documented operational reason to disable it.
- Add hosting-level rate limiting, monitoring, structured logs, and alerting.
- Configure SPA fallback for `/`, `/privacy-policy`, `/terms`, `/faq`, and `/portal`.
- Run `npm test`, `npm run lint`, and `npm run build` before release.