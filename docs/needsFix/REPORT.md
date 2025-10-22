### Needs-Fix Assessment Report (v0.8)

#### Scope
- Evaluated current backend (Next.js BFF + FastAPI integration) and shared libraries as implemented up to 2025-10-20.
- Cross-checked against docs/requirements (v0.4 policy), security rules, SLOs, and implementation checklist (v0.8).

---

### Executive Summary
- Overall alignment with requirements is strong: real-time focus (no-store), microservice boundaries, RLS-first for user-facing CRUD, OAuth2 CC adoption, Webhook-first integration, auditing, and idempotency are in place.
- Key risks remain in M2M/internal authentication and operational hardening. The most critical: token verification stub and incomplete IP allowlist/rate limiting enforcement in M2M, and the reliance on the Supabase service-role key in server handlers (RLS bypass) without additional guardrails.

---

### Findings and Recommendations

#### 1) OAuth2 token verification is a stub (Critical)
- Files: `lib/auth/oauth2.ts` (verifyOAuth2Token returns true)
- Impact: Any bearer token is accepted by `/api/m2m/*` and `/api/internal/*` routes, enabling unauthorized data access and writes.
- Recommendation:
  - Implement JWT verification using `jose` with JWKs. Add envs: `OAUTH2_JWKS_URL`, `OAUTH2_ISSUER`, `OAUTH2_AUDIENCE`.
  - If tokens are opaque: add introspection endpoint support.
  - Enforce `exp`, `nbf`, `aud`, `iss`, and signature checks. Reject non-matching `scope`/`role` claims.

#### 2) M2M: IP Allowlist and Rate Limit not enforced in route (High)
- Files: `app/api/m2m/customers/search/route.ts` (TODO comments)
- Impact: M2M endpoint can be brute-forced or abused from non-allowed IPs.
- Recommendation:
  - Integrate `getClientIP`/`isIPAllowed` from `lib/middleware/ipAllowlist.ts` and `checkRateLimit` from `lib/middleware/rateLimit.ts` at the start of the handler.
  - Return 403 for disallowed IPs, 429 for rate-limit exceeded, and log structured security events.
  - Production: move rate limit store to a shared backend (e.g., Upstash Redis) to work across serverless instances.

#### 3) Service role key usage in server handlers (Design/Security) (High)
- Files: `lib/supabase/server.ts` (uses `SUPABASE_SERVICE_ROLE_KEY`), used by `/api/m2m/*` and `/api/internal/*`.
- Impact: Service role bypasses RLS. While internal-only, misuse or route exposure risks broad data access.
- Recommendation:
  - Prefer Postgres RPC functions (`security definer`) with explicit, narrow SQL for internal writes/reads instead of raw table access with service key.
  - Alternatively, create restricted API functions that select only needed columns and enforce additional predicates (e.g., `deleted_at is null`, `limit`, `order by`).
  - Add defense-in-depth: double-check allowed fields, validate inputs strictly, and log access.

#### 4) Input validation missing in internal upserts (High)
- Files: `app/api/internal/orders/upsert/route.ts`, `app/api/internal/measurements/upsert/route.ts`
- Impact: Potential schema drift, bad data, and security risks (e.g., oversized payloads, invalid types).
- Recommendation:
  - Apply `upsertOrderSchema` and `upsertMeasurementSchema` (Zod) before DB operations.
  - Enforce max lengths on text fields; sanitize strings. Reject unexpected fields.

#### 5) `.env.template` is missing at repo root (Medium)
- Files: none at root; read attempt failed
- Impact: Onboarding friction; misconfiguration risk in environments.
- Recommendation:
  - Add `.env.template` with all variables and inline comments for dev/stg/prod. Include Supabase, OAuth2, M2M IPs, and log levels.

#### 6) `integration_jobs` recording not implemented (Medium)
- Files: TODOs in `services/integration/app/api/webhooks.py` and internal upsert routes
- Impact: Reduced operability; retry and failure analytics are limited.
- Recommendation:
  - Insert job rows on webhook start/finish with `status` transitions. Record errors and `attempts`. Connect to UI later.

#### 7) PII minimization for M2M (Medium)
- Files: `app/api/m2m/customers/search/route.ts` returns `contact`, `address`
- Impact: Unnecessary PII exposure to other services.
- Recommendation:
  - Return minimal fields by default: `id`, `name`, `code`. Offer explicit `fields` param if absolutely required.

#### 8) Audit masking coverage (Low→Medium)
- Files: `lib/audit/logger.ts` (`SENSITIVE_FIELDS`)
- Impact: Email/phone/address might be logged in diffs.
- Recommendation:
  - Add `email`, `phone`, `address` to masking keys and consider regex for typical PII patterns.

#### 9) Consistent error responses (Low)
- Files: various route handlers mix direct `NextResponse.json` and `errorResponse`
- Impact: Inconsistent API shape for error handling.
- Recommendation:
  - Use `errorResponse` helper uniformly for consistency and logging.

#### 10) Rate limit store (scalability note) (Low)
- Files: `lib/middleware/rateLimit.ts`
- Impact: In-memory storage is per-instance only.
- Recommendation:
  - Use a shared store (Redis/Upstash) for production; keep in-memory for local dev.

---

### Alignment Check (Requirements vs Implementation)
- Real-time/no-store: ✓ All API responses set `Cache-Control: no-store`. Next global headers configured.
- RLS owner-based: ✓ User-facing CRUD uses anon key and session; RLS applies. Internal routes bypass by design; guardrails recommended.
- OAuth2 CC for M2M: ✓ Adopted. Verification stub → must fix.
- Webhook-first: ✓ Implemented with HMAC + timestamp + idempotency.
- Auditing: ✓ Inserted on create/update/delete; diffs generated and masking in place.
- FTS + triggers: ✓ FTS usage present; triggers assumed per migrations.
- Capacity/SLO: ✕ Performance validation not yet measured (to be done post-deploy).

---

### Conclusion
Security is the top priority for the next iteration: implement token verification, enforce IP allowlist and rate limiting in M2M, and reduce service-role exposure via RPC. Operationally, add `integration_jobs` persistence and `.env.template`. These changes will significantly reduce risk and improve readiness for staging.
