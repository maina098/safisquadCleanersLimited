# Safi Squad Frontend

React 19 + Vite customer experience for Safi Squad Cleaning Services.

## Routes and behavior

- `/` customer homepage with service cards, pricing calculator, booking modal, and order tracking
- `/privacy-policy`, `/terms`, `/faq` public SPA routes with page-specific metadata and canonical URLs
- `/#admin` authenticated operations portal entry point
- `/404.html` static fallback page for hosts that support a public 404 asset

All authored runtime media is under `public/assets/`. The large `public/fabricspa.com/` archive is not an application dependency and should not be included in new routes.

## Commands

```powershell
npm run dev
npm run lint
npm run build
npm run preview
```

Set `VITE_API_URL` for the API endpoint and `VITE_GA_MEASUREMENT_ID` for optional analytics. Analytics is injected only after the visitor accepts optional cookies.

## Responsive and accessibility standards

The layout uses fluid typography, constrained content widths, grid-to-stack breakpoints, visible keyboard focus rings, labelled form controls, announced errors, and touch-friendly controls. Validate at 320px, 375px, 768px, and 1280px widths before release.
