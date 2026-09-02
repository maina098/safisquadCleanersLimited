# V Legendary

A full-stack workspace dashboard with a React frontend, Express/Node.js backend, and PostgreSQL-ready data layer.

## Structure

- `frontend/` React + Vite dashboard and migrated Fabricspa website
- `backend/` Express API, PostgreSQL pool, and schema

## Run locally

1. Create a PostgreSQL database named `vlegendary`.
2. Copy `backend/.env.example` to `backend/.env` and update `DATABASE_URL`.
3. Apply `backend/schema.sql` to the database.
4. Start the API:

   ```powershell
   cd backend
   npm run dev
   ```

5. In another terminal, start the frontend:

   ```powershell
   cd frontend
   npm run dev
   ```

The dashboard runs at `http://localhost:5173`; the migrated Fabricspa website is available at `http://localhost:5173/fabricspa.com/index.html`; the API runs at `http://localhost:4000`.
