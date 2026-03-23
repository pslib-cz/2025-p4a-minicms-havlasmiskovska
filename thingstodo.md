# Things To Do (Unsatisfied Assignment Items)

## Data model


## Public section requirements


## SEO requirements
- Add dynamic metadata generated from content (`generateMetadata` for list/detail pages).
- Add OpenGraph metadata.
- Add canonical URLs (`alternates.canonical`).
- Add `sitemap.xml` route (`src/app/sitemap.ts`).
- Add `robots.txt` route (`src/app/robots.ts`).

## Dashboard architecture and features
- Refactor dashboard data operations to communicate via Route Handlers API (assignment requires dashboard <-> backend via API).
- Ensure dashboard core management views are implemented as Client Components where required by assignment wording.
- Add pagination to own-content list in dashboard (`/private/events`).
- Add content edit functionality (currently no full edit flow for event content fields).
- Add content delete functionality.

## API (Route Handlers)
- Implement full CRUD Route Handlers for the main content entity (`ImportantEvent`):
  - `GET` list/detail
  - `POST` create
  - `PUT/PATCH` edit
  - `DELETE` remove
- Keep auth/session checks, ownership checks, and server-side validation in all CRUD handlers.

## UI library requirement
- Integrate one required UI component library (React Bootstrap, PrimeReact, Mantine, MUI, Ant Design, Fluent UI, NextUI, or Carbon).

## Analytics + consent
- Integrate at least one analytics tool (Google Analytics / Clarity / Matomo / equivalent) and verify pageview tracking.
- Add cookie consent flow for analytics cookies and keep app functional when consent is denied.

## Deployment/discoverability evidence
- Add Lighthouse audit evidence (notes or screenshot reference in docs).
- Add deployment info and post-deployment setup evidence for:
  - Google Search Console
  - Bing Webmaster Tools

## Documentation and setup
- Add `.env.example` (currently missing).
- Replace placeholder `README.md` with full required documentation:
  - app description
  - data model
  - feature list
  - run/setup instructions
