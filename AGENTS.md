# Repository Guidelines

## Project Structure & Reference Docs
- `app/` is the Next.js App Router surface; authenticated pages **must** render inside `AppLayout` with `.page-content` (see `docs/requirements/07_frontend_design_rules.md`).
- `components/` hosts shared UI; `lib/` and `shared/` provide cross-service auth, logging, and validation required by the architecture in `docs/requirements/05_architecture.md`.
- `services/integration/` contains the FastAPI webhook/sync service. Align its handlers with the flows in `docs/requirements/04_external_api_integration.md` and keep `.env` out of source control.
- `database/` and `scripts/` mirror the Supabase model described in `docs/requirements/03_data_model_supabase.md`; any change here must be reflected in `docs/requirements/` and the implementation checklist.
- `docs/requirements/` captures personas, SLAs (P99 ≤ 3 s freshness), and non-functional expectations. Read the relevant chapter before modifying adjacent code.

## Development Workflow
- Front end: `npm run dev` (Next.js), `npm run lint`, `npm run type-check`, `npm run build && npm run start` for smoke testing.
- Integration service: `cd services/integration && pip install -r requirements.txt && uvicorn app.main:app --reload`; use `docker build -t integration-service services/integration` for deployment rehearsal.
- Keep Supabase auth hydrated locally via `.env.local` and never bypass RLS in tests; use service-role keys only inside server-side code paths.
- When touching integration jobs or synchronization, walk through `docs/IMPLEMENTATION_CHECKLIST.md` to ensure webhook-first + retry rules stay compliant.

## Coding Standards
- TypeScript: 2-space indent, no semicolons, `PascalCase` components, `camelCase` utilities, route assets in kebab-case. Import Font Awesome icons via `@fortawesome/react-fontawesome`.
- Every authenticated page must wrap content with `AppLayout`, avoid redefining headers/sidebars, and scope CSS to `.page-content` to preserve the fixed layout.
- Python: PEP 8, structured logging via `structlog`, config through `app/core/config.py`, and OAuth2 Client Credentials flows per `shared/auth/`.
- Prefer server components and Supabase SSR helpers for data reads; keep polling out of UI and respect the “no cache” principle from the architecture spec.

## Testing & Quality Gates
- Minimum gates before review: `npm run lint`, `npm run type-check`, relevant UI smoke steps recorded, and `pytest --maxfail=1 --cov=app` inside `services/integration`.
- Add Jest/Vitest specs under `__tests__/` or alongside components when introducing new UI logic; Python tests live in `services/integration/tests/test_<module>.py`.
- Validate webhook/sync paths against the personas in `docs/requirements/02_personas_use_cases.md`: cover retry flows, orphan detection, and audit logging where applicable.

## Data & Integration Responsibilities
- Customers are the sole write domain of this service; expose only read APIs externally and funnel all changes through BFF handlers or internal routes.
- Webhook-first ingestion with idempotency keys is mandatory; supplement with bounded pull jobs (`/sync/*`) only for recovery.
- Store only reference data for orders/measurements, preserving external IDs and source systems; external systems hold the authoritative snapshots.
- Deletions follow the strategy in `docs/requirements/08_cross_service_data_strategy.md`: customer soft-deletes with notifications, external deletes mirrored via internal endpoints.

## Security, Ops & Collaboration
- Enforce Supabase RLS, `Cache-Control: no-store`, and OAuth2 CC for M2M traffic; never log PII outside approved structured fields.
- Rotate secrets regularly, keep environment differences documented, and rehearse backup/recovery targets (RPO ≤ 15 min, RTO ≤ 4 h) noted in `docs/requirements/06_nonfunctional_security_ops.md`.
- Commits use short imperative scopes (`dashboard: add job retry CTA`), and PRs must include linked issues, updated docs, commands run, risk assessment, and UI evidence when relevant.
- Tag reviewers by domain (`app`, `services/integration`, `database`, `docs`) and update checklists or requirement drafts whenever behavior or contracts shift.
