# Safi Squad Cleaning Services

Safi Squad is a React/Vite customer experience backed by an Express API. It combines public booking and tracking with one shared operations system presented through five role-specific dashboard views.

## System features

### Customer experience

- Service catalogue, detailed pricing, estimate calculator, and responsive marketing pages
- Booking form with service selection, pickup details, pricing, validation, and operations notifications
- Order tracking by tracking code with lifecycle timeline
- M-Pesa STK Push support and callback processing with duplicate-payment protection
- Cookie consent, optional analytics, SEO metadata, sitemap, privacy, terms, and FAQ pages

### Shared operations foundation

- PostgreSQL as the production source of truth
- Local JSON fallback for development without `DATABASE_URL`
- JWT authentication with bcrypt password hashing
- Role-aware access checks on both frontend navigation and API handlers
- Transaction/order audit logging
- Order state machine that blocks skipped lifecycle transitions
- Management overrides require a reason
- Inter-department inbox with priorities, read/resolved states, and ownership checks
- Redis Pub/Sub and Streams when `REDIS_URL` is configured, with an in-process event fallback
- Role-filtered SSE stream with an immediate connection heartbeat
- Maintenance mode and system-wide broadcasts
- Idempotent M-Pesa payment webhook handling

### Dashboard views

Management sees the full control room: overview metrics, orders, finance, team, marketing, technical, audit, escalations, and system health.

Secretariat sees overview, orders, workflow progression, customer/order context, and shared queries. Secretariat can advance normal order states.

Finance sees overview, finance and settlement data, payment events, delivered-order events, and shared queries. Finance cannot change order status.

Promotions sees overview, marketing campaigns, attribution workspace, health events, and shared queries.

Technical sees overview, technical logs/runbook, health and system events, maintenance controls, and broadcasts.

All authenticated dashboards receive relevant live events through `/api/dashboard/stream` and share `/api/messages` for cross-department communication.

## Repository structure

- `frontend/` React 19 + Vite customer site and operations portal
- `frontend/src/App.jsx` customer flow, authentication screens, portal shell, dashboard views
- `frontend/src/App.css` public-site and portal layout styles
- `backend/server.js` Express routes, authentication, orders, payments, messages, maintenance, and dashboard APIs
- `backend/events.js` local/Redis event transport and history
- `backend/orderStateMachine.js` allowed order transitions
- `backend/security.js` JWT, role normalization, and authorization
- `backend/schema.sql` PostgreSQL reference schema
- `backend/*.json` local development persistence files

## Local setup

1. Install dependencies:

   ```powershell
   cd backend; npm install
   cd ..\frontend; npm install
   ```

2. Copy configuration:

   ```powershell
   Copy-Item backend/.env.example backend/.env
   ```
- Administrator-provisioned sign-in only for dashboard accounts

   Configure `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`. PostgreSQL is recommended. If `DATABASE_URL` is empty, the backend uses local JSON files.

3. For multi-instance real-time delivery, configure Redis:

   ```text
   REDIS_URL=redis://localhost:6379
   ```

   Without Redis, the event bus still works for a single local API process.

4. Start the services:

   ```powershell
   cd backend; npm run dev
   cd ..\frontend; npm run dev
   ```

   Frontend: `http://localhost:5173`  
   API: `http://localhost:4000`

## Local test accounts

The project does not commit production credentials. Provision dashboard accounts through the administrator API using `POST /api/users`.

Recommended local test emails:

```text
management.test@safisquad.local
secretariat.test@safisquad.local
finance.test@safisquad.local
promotions.test@safisquad.local
technical.test@safisquad.local
```

The current local test password for all five accounts is `SafiTest!2026`. Self-service sign-up can create Secretariat, Finance, Promotions, and Technical accounts. Management and Super Admin accounts must be provisioned by an authorized administrator.

Recreate or reset these local accounts with:

```powershell
cd backend; node seed-test-accounts.js
```

Never reuse development passwords in production. The only administrator password is the value you set as `ADMIN_PASSWORD` in your private `backend/.env`.

## Important API routes

- `POST /api/auth/login` - sign in
- `POST /api/auth/signup` - create an operational account
- `GET /api/dashboard/stream` - role-filtered SSE events
- `GET/POST/PATCH /api/messages` - inter-department inbox
- `GET /api/management/overview` - Management-only aggregation
- `GET /api/admin/metrics` - dashboard metrics
- `GET /api/orders` - authenticated order list
- `PATCH /api/orders/:id/status` - role-controlled lifecycle transition
- `PATCH /api/orders/:id/workflow` - workflow/photo update
- `POST /api/webhooks/mpesa` - payment callback
- `GET/POST /api/system/maintenance` - Technical/Super Admin maintenance control
- `POST /api/system/broadcast` - Technical, Management, or Super Admin broadcast
- `GET /api/health` - API/database health

## Verification

```powershell
cd backend; npm test
cd ..\frontend; npm run lint; npm run build
```

For browser verification, test sign-in, sign-up, role-specific navigation, SSE status, order updates, inbox messages, maintenance banners, and responsive layouts at desktop and mobile widths.

`VITE_API_URL` can point the frontend at a deployed API. Set `VITE_GA_MEASUREMENT_ID` only where analytics is configured; analytics loads after optional cookie consent.

## Production checklist

- Use strong private values for `JWT_SECRET`, `ADMIN_PASSWORD`, database, Redis, SMTP, and payment credentials.
- Do not enable broad self-service role provisioning without an approval workflow.
- Configure HTTPS, exact CORS origins, database backups, Redis persistence, rate limiting, and webhook signature validation at the hosting layer.
- Configure SMTP for booking notifications and daily operational reporting.
- Configure Daraja callback URL and verify provider credentials before enabling payments.
- Configure SPA fallback for `/privacy-policy`, `/terms`, `/faq`, and `/portal`.
- Run the backend and frontend verification commands before deployment.
