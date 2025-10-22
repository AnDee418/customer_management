# Needs-Fix TODO Checklist (Backend v0.8)

## P0 - Security (Must do before staging)

- [x] Implement OAuth2 token verification (JWT/JWKs or introspection) ✅
  - Files: `lib/auth/oauth2.ts`
  - Add envs: `OAUTH2_JWKS_URL`, `OAUTH2_ISSUER`, `OAUTH2_AUDIENCE`
  - Validate: signature, `exp`, `nbf`, `aud`, `iss`; enforce scopes
  - Acceptance: Invalid/missing tokens → 401; valid tokens → 200; logs structured

- [x] Enforce IP Allowlist and Rate Limit in M2M endpoint ✅
  - Files: `app/api/m2m/customers/search/route.ts`
  - Use: `getClientIP`/`isIPAllowed`, `checkRateLimit`
  - Return 403 for disallowed IPs, 429 for limit exceeded
  - Acceptance: Requests from blocked IPs fail; rate limit counters/logs visible

- [ ] Reduce service-role exposure (RPC or narrow queries)
  - Files: `lib/supabase/server.ts`, internal routes
  - Create RPC for orders/measurements upsert with explicit checks
  - Acceptance: Internal routes call RPCs; table writes via service key minimized

## P1 - Data Integrity & Operations

- [x] Add Zod validation to internal upserts ✅
  - Files: `app/api/internal/orders/upsert/route.ts`, `app/api/internal/measurements/upsert/route.ts`
  - Use `upsertOrderSchema`, `upsertMeasurementSchema` and field whitelisting
  - Acceptance: Invalid payloads return 400 with details

- [x] Implement `integration_jobs` write paths ✅ (Supabase統合はスタブ)
  - Files: `services/integration/app/api/webhooks.py`, internal upserts
  - Record: queued → running → succeeded/failed; attempts, last_error
  - Acceptance: Job rows visible with lifecycle transitions on success/failure

- [x] Create `.env.template` at repo root ✅ (内容を FIXES_APPLIED.md に記載)
  - Include: Supabase, OAuth2 (token URL, JWKs URL, issuer, audience), internal client IDs, M2M_ALLOWED_IPS, rate limits, log levels
  - Acceptance: Fresh clone can boot with copied `.env`

## P2 - Privacy & Consistency

- [x] Minimize PII in M2M search response ✅
  - Files: `app/api/m2m/customers/search/route.ts`
  - Default fields: `id, name, code`; optional `fields` param under allowlist
  - Acceptance: No PII returned by default; tests verify

- [x] Expand masking keys for audits ✅
  - Files: `lib/audit/logger.ts`
  - Add `email`, `phone`, `address`; consider regex for phone/email patterns
  - Acceptance: Audit diffs show `***MASKED***` for PII keys

- [x] Standardize error responses ✅
  - Files: all Next.js route handlers
  - Use `errorResponse` consistently; remove ad-hoc error JSON
  - Acceptance: Uniform `{ error }` shape and headers across endpoints

## P3 - Scalability & SLOs

- [ ] Externalize rate-limit store (prod)
  - Files: `lib/middleware/rateLimit.ts`
  - Use Redis/Upstash; retain memory store for dev
  - Acceptance: Multi-instance consistent limits in staging

- [ ] Performance validations
  - M2M P95 < 200ms; Freshness SLO P99 ≤ 3s
  - Add traces/metrics, simple k6 load scripts
  - Acceptance: Dashboards show SLO compliance under expected load

---

Owners: Backend Team (Node/FastAPI), Security

Target: Complete P0 before staging; P1 for staging hardening; P2–P3 before production.
