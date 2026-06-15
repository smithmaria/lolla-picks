# Lolla Picks
Real-time web app for planning a festival schedule with friends. Create a room, share a join code, and vote on which Lollapalooza 2026 artists you want to see. Votes update live across all participants, and the group can build and export a shared per-day schedule.

## Features
- **Rooms with join codes** — create a room, share a short code, others join by name + password.
- **Live voting** — allocate a budget of votes across artists; tallies update in realtime for everyone in the room (Supabase Realtime).
- **Flexible vote settings** — admin configures festival days, votes-per-user, and vote scope (`overall` or `per_day`).
- **Shared schedule builder** — pick a set of artists and lay them out on a per-day, per-stage grid; export the schedule as an image.
- **Admin controls** — the room creator manages settings, members, and room status (`open` / `locked`).
- **No accounts** — participation is identified by a per-room name + password; sessions persist in `localStorage`.

## Tech Stack
- **Frontend:** React 18, TypeScript, Vite, React Router, Tailwind CSS
- **Backend:** Supabase (Postgres + Row Level Security + Realtime)
- **Export:** `html-to-image`
- **Testing:** Vitest + React Testing Library (unit/component), Playwright (E2E smoke tests)
- **Hosting:** Vercel

## Prerequisites

- Node.js 18+ and npm
- Access to the project's Supabase instance (need URL and anon key)

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# then fill in the Supabase values (see below)

# 3. Run the dev server
npm run dev
```

The app runs at `http://localhost:5173` by default.

### Environment variables

Set these in `.env` (see `.env.example`):

| Variable                 | Description                                  |
| ------------------------ | -------------------------------------------- |
| `VITE_SUPABASE_URL`      | The Supabase project URL                     |
| `VITE_SUPABASE_ANON_KEY` | The Supabase anonymous (public) API key      |


## Database setup

SQL migrations live in `supabase/migrations/` and are applied
in order. When making schema changes, add a new migration and push it with the
[Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref <project-ref>
supabase db push
```

## Available scripts

| Command             | Description                                      |
| ------------------- | ------------------------------------------------ |
| `npm run dev`       | Start the Vite dev server                        |
| `npm run build`     | Type-check and build for production              |
| `npm run preview`   | Preview the production build locally             |
| `npm run lint`      | Run ESLint                                        |
| `npm test`          | Run unit/component tests once (Vitest)           |
| `npm run test:watch`| Run Vitest in watch mode                          |
| `npm run test:e2e`  | Run Playwright E2E smoke tests                    |


## Testing

Three layers, run independently:

- **Unit / component** (`npm test`) — Vitest + React Testing Library, colocated as
  `*.test.ts(x)` next to the code they test. Covers the vote/schedule math and validation logic.
- **E2E** (`npm run test:e2e`) — Playwright smoke tests in `browser/`. Scoped to UI-only
  paths that never write to Supabase.
  First run: `npx playwright install chromium`.

## Deployment

Deployed on **Vercel**. `vercel.json` rewrites all routes to `index.html` for client-side
routing. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables in
the Vercel project settings, then connect the repo for automatic deploys.
