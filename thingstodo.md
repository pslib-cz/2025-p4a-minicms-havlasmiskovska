# Things To Do (Unsatisfied Assignment Items)

## Data model

## Public section requirements

## Dashboard architecture and features

- Refactor dashboard data operations to communicate via Route Handlers API (assignment requires dashboard <-> backend via API).
- Ensure dashboard core management views are implemented as Client Components where required by assignment wording.
- Add pagination to own-content list in dashboard (`/private/events`).
- Add content edit functionality (currently no full edit flow for event content fields).
- Add content delete functionality.

## API (Route Handlers)

- Done: Full CRUD Route Handlers for `ImportantEvent` are implemented.
    - `GET` list: `/api/events`
    - `GET` detail: `/api/events/[id]`
    - `POST` create: `/api/events`
    - `PUT` update: `/api/events/[id]`
    - `PATCH` partial update: `/api/events/[id]`
    - `DELETE` remove: `/api/events/[id]`
- Done: auth/session checks, ownership checks, and server-side validation are enforced in all CRUD handlers.

## Analytics + consent

- Integrate at least one analytics tool (Google Analytics / Clarity / Matomo / equivalent) and verify pageview tracking.
- Add cookie consent flow for analytics cookies and keep app functional when consent is denied.

## Deployment/discoverability evidence

## Documentation and setup

- Add `.env.example` (currently missing).
- Replace placeholder `README.md` with full required documentation:
    - app description
    - data model
    - feature list
    - run/setup instructions
