# Mini CMS — Health Snapshot Dashboard

A personal health-tracking mini CMS built with **Next.js 16**, **Prisma**, **PostgreSQL**, and **React Bootstrap**. Users authenticate via GitHub OAuth, import daily health metrics (stress, respiration, body battery), create "Important Day" events, and analyse how those events correlate with health trends over short, medium, and long-term horizons.

Live deployment: **https://cms.144-91-77-107.sslip.io**

---

## Features

- **GitHub OAuth login** via NextAuth (database sessions, Prisma adapter).
- **Dashboard** with stress, respiration, and body-battery trend charts (SVG, smoothed moving averages).
- **Important Days CRUD** — full create / read / update / delete through the dashboard, communicating via REST API Route Handlers.
- **Rich-text event editor** with file & image upload support.
- **Visibility control** — events can be Private, Not Public (link-sharing), or Published.
- **Published days public section** with search, tag & impact filtering, and pagination.
- **Metric impact analysis** — short-term (7 day), medium-term (30 day), and long-term structural change analysis per event.
- **Analytics** — Microsoft Clarity integration, loaded only after cookie consent.
- **Cookie consent banner** — analytics cookies are blocked until the user accepts; the app remains fully functional when declined.
- **SEO** — dynamic sitemap, robots.txt, OpenGraph metadata, per-page canonical URLs.
- **Dockerized production deploy** with CI/CD via GitHub Actions to a VPS.

---

## Data Model

| Model                                     | Description                                                                                                                                           |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **User**                                  | NextAuth user with optional `userProfilePK` linking to health data. Has accounts, sessions, events, and metric rows.                                  |
| **ImportantEvent**                        | A user-created event with name, slug, dates, tags, expected impact (Positive/Negative), visibility, and rich HTML description. Related to categories. |
| **Category**                              | Tag-based categories with unique slugs, many-to-many with ImportantEvent.                                                                             |
| **Stress**                                | Daily stress metrics (average level, intensity, durations). Composite PK: `(pk_date, userProfilePK)`.                                                 |
| **Respiration**                           | Daily respiration metrics (avg waking, highest, lowest). Composite PK: `(pk_date, userProfilePK)`.                                                    |
| **BodyBattery**                           | Daily body battery metrics (charged, drained, highest, lowest, sleep values). Composite PK: `(pk_date, userProfilePK)`.                               |
| **Account / Session / VerificationToken** | Standard NextAuth models for OAuth and session management.                                                                                            |

### Key enums

- `EventImpact`: `POSITIVE` | `NEGATIVE`
- `EventVisibility`: `PUBLISHED` | `NOT_PUBLIC` | `PRIVATE`

---

## API (Route Handlers)

All endpoints require authentication via NextAuth session.

| Method   | Endpoint                        | Description                                                       |
| -------- | ------------------------------- | ----------------------------------------------------------------- |
| `GET`    | `/api/events`                   | List own events (paginated, searchable, filterable by visibility) |
| `GET`    | `/api/events/[id]`              | Get event detail (ownership check)                                |
| `POST`   | `/api/events`                   | Create event (JSON body)                                          |
| `PUT`    | `/api/events/[id]`              | Full update (JSON body)                                           |
| `PATCH`  | `/api/events/[id]`              | Partial update (JSON body)                                        |
| `DELETE` | `/api/events/[id]`              | Delete event (ownership check)                                    |
| `PATCH`  | `/api/events/update-visibility` | Change event visibility                                           |
| `POST`   | `/api/events/upload`            | Upload files/images for event editor                              |

---

## Tech Stack

- **Framework:** Next.js 16 (App Router, standalone output)
- **Language:** TypeScript
- **Database:** PostgreSQL 16 via Prisma ORM (with `@prisma/adapter-pg`)
- **Auth:** NextAuth v4 with GitHub provider + Prisma adapter
- **UI:** React Bootstrap 2, Bootstrap 5
- **Analytics:** Microsoft Clarity (opt-in via cookie consent)
- **Deployment:** Docker + Docker Compose, GitHub Actions CI/CD

---

## Prerequisites

- **Node.js** 20+
- **Docker** & **Docker Compose** (for the database, or use an external PostgreSQL 16 instance)
- A **GitHub OAuth App** (for authentication)

---

## Setup & Run

### 1. Clone & install

```bash
git clone <repo-url>
cd 2025-p4a-minicms-havlasmiskovska
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your values (database credentials, GitHub OAuth keys, NextAuth secret). See `.env.example` for all required variables.

Generate a NextAuth secret:

```bash
openssl rand -base64 32
```

### 3. Start the database

```bash
docker compose -f docker-compose.dev.yml up -d
```

### 4. Generate Prisma client & push schema

```bash
npm run prisma:generate
npm run prisma:push
```

### 5. Seed data (optional)

```bash
npm run prisma:seed
```

### 6. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Production Deployment

The app deploys via Docker:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

CI/CD is configured in `.github/workflows/deploy.yml` — pushes to `main` trigger automated lint, build, and deploy to the VPS.

---

## Project Structure

```
src/
  app/
    (public)/         — Public pages (home, login, published days)
    (private)/        — Authenticated pages (dashboard, events, charts)
    api/              — REST API Route Handlers
  components/         — Shared React components
  lib/                — Auth config, Prisma client, API helpers
prisma/
  schema.prisma       — Database schema
  seed.mjs            — Data seeder
  migrations/         — Prisma migrations
```
