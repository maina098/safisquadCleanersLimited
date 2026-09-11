# Safi Squad Cleaning Services

Safi Squad is a React and Vite customer website backed by an Express and Node.js API. The system supports service discovery, clear pricing, booking, order tracking, consent-aware analytics, and an authenticated operations portal.

## Repository structure

- `frontend/` React 19 + Vite customer experience, responsive styles, SEO assets, and first-party media
- `backend/` Express API, authentication, order workflow, payments, notifications, and PostgreSQL-ready persistence
- `backend/schema.sql` PostgreSQL schema reference
- `backend/*.json` local development fallback data when `DATABASE_URL` is not configured

The archived `frontend/public/fabricspa.com/` tree is retained as historical source material only. Runtime React media is served from `frontend/public/assets/` and the frontend no longer uses the archived pages as application routes.

## Local development

1. Install dependencies:

   ```powershell
   cd backend; npm install
   cd ..\frontend; npm install
   ```

2. Configure the API. Copy `backend/.env.example` to `backend/.env`. For PostgreSQL, create a database named `safisquad`, set `DATABASE_URL`, and apply `backend/schema.sql`. Without `DATABASE_URL`, the API uses the local JSON files for development.

   Booking requests are emailed to `safisquaadcleaningservices@gmail.com` when SMTP is configured. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and optionally `SMTP_FROM`, `OPERATIONS_EMAIL`, and `SMTP_SECURE=true` in `backend/.env`. The booking confirmation is only shown after the API has saved the reservation; the API response also reports email delivery as `SENT`, `FAILED`, or `NOT_CONFIGURED`.

3. Start the API in one terminal:

   ```powershell
   cd backend
   npm run dev
   ```

4. Start the frontend in another terminal:

   ```powershell
   cd frontend
   npm run dev
   ```

The frontend runs at `http://localhost:5173` and the API at `http://localhost:4000`.

## Verification

```powershell
cd frontend; npm run lint; npm run build
cd ..\backend; npm test
```

`VITE_API_URL` can point the frontend at a deployed API. Set `VITE_GA_MEASUREMENT_ID` only in an environment where analytics is configured; analytics loads after optional cookie consent.

## Production checklist

- Configure `DATABASE_URL`, JWT secret, frontend origin, admin credentials, and payment/SMS credentials.
- Configure SPA fallback so `/privacy-policy`, `/terms`, and `/faq` serve the React entry point; serve `404.html` for unknown static paths.
- Confirm HTTPS, CORS origin, secure secret storage, database backups, and rate limiting at the hosting layer.
- Submit `https://safisquad.com/sitemap.xml` to search engines and verify canonical URLs after deployment.
- Test booking, tracking, consent, keyboard navigation, forms, and responsive layouts at mobile and desktop widths.
