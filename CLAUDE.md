# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an internal customer management system built as a microservice with real-time capabilities. The system is designed with blast radius minimization and zero-trust principles following a ransomware incident recovery. It serves as the "Owning Service" for customer data in a microservices architecture.

**Critical Design Principles:**
- Real-time first: Cache usage is prohibited (except limited fallback during failures)
- Freshness SLO: Source → DB → UI P99 ≤ 3 seconds
- Webhook-first: External data sync prioritizes webhooks, with differential pull as backup
- Owner-based RLS: All data access follows Supabase Row Level Security based on ownership
- Microservice boundaries: This service is the source of truth for customer data; other services access via M2M API only

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18
- **BFF/API**: Next.js API Routes (Node.js)
- **Integration Service**: Python FastAPI
- **Database**: Supabase (PostgreSQL + Auth)
- **Auth**: Supabase Auth with OAuth2 Client Credentials for M2M
- **Deploy**: Vercel (frontend/BFF), Render (FastAPI)

## Essential Build & Development Commands

### Frontend (Next.js)
```bash
# Install dependencies
npm install

# Development server
npm run dev

# Type checking
npm run type-check

# Lint
npm run lint

# Production build
npm run build

# Production start
npm run start
```

### Integration Service (Python FastAPI)
```bash
# Navigate to service directory
cd services/integration

# Install dependencies
pip install -r requirements.txt

# Run development server
uvicorn app.main:app --reload

# Run tests
pytest

# Run with coverage
pytest --cov=app
```

### Database Migrations
Migrations are applied via Supabase MCP tools (if available) or directly via SQL:
- Migration files: `database/migrations/*.sql`
- Apply in numeric order (001, 002, 003, etc.)
- Use `mcp_supabase_apply_migration` if Supabase MCP is connected

## Critical Coding Rules

### Frontend Layout Rules (MOST IMPORTANT)

**MANDATORY**: All pages MUST use the `AppLayout` component wrapper.

**Correct page structure:**
```tsx
import AppLayout from '@/components/layout/AppLayout'

export default function Page() {
  return (
    <AppLayout>
      <div className="page-content">
        {/* Page-specific content */}
      </div>
    </AppLayout>
  )
}
```

**Exceptions (pages that should NOT use AppLayout):**
- `/login` - Login page
- `/signup` - Signup page (not yet implemented)

**Prohibited:**
- Creating pages without `AppLayout`
- Creating custom headers/sidebars per page
- Overriding global layout styles
- Hard-coding colors (use CSS variables instead)

### Design System
- Use color palette CSS variables: `--brand-primary`, `--brand-accent`, etc.
- Base theme: rainbowGradient 5 colors with readability priority
- Icons: Font Awesome (unified across app)
- Buttons: Use standardized classes (`.btn`, `.btn-primary`, etc.)
- Page content: Always wrap in `.page-content` class

### TypeScript/JavaScript
- Strict mode enabled (no implicit any)
- async/await preferred over promises
- Error handling is mandatory
- HTTP responses: Must include `Cache-Control: no-store` header (real-time requirement)
- Path alias: `@/*` maps to project root

### Python (FastAPI Integration Service)
- Type hints required (mypy compliant)
- Structured logging with `structlog`
- Environment variables via `pydantic-settings`
- Sensitive data must be masked in logs
- OAuth2 Client Credentials for M2M authentication

### SQL/Database
- RLS policies are mandatory on all tables
- Indexes optimized for real-time queries
- Triggers use immediate sync (no deferred)
- All schema changes must have comments
- No direct DB access from other services (API only)

### PowerShell Environment
This project runs in a PowerShell environment:
- **NEVER** use `&&`, `|`, or `cat` in commands
- Use PowerShell-native commands
- Chain commands with `;` if needed (for independent operations)

## Architecture & Data Flow

### Service Boundaries
- **This service (Customer Management)**: Owns customer data, is the only service that writes to customer DB
- **Other services**: Read customer data via M2M reference API only (no direct DB access)
- **Integration service**: Handles external API sync, sends data to this service's internal API

### API Structure
```
/api/customers/*        - CRUD operations for customers
/api/contacts/*         - CRUD operations for contacts
/api/orders/*           - Read-only view of external order data
/api/measurements/*     - Read-only view of external measurement data
/api/m2m/customers/search - M2M reference API (OAuth2 protected)
/api/internal/*         - Internal upsert endpoints for integration service
```

### Data Models (Core Tables)
- `teams` - Team/department master
- `customers` - Customer master (with owner_user_id, team_id, search_vector for FTS)
- `contacts` - Customer contacts (1:N with customers)
- `orders` - Order data with external_order_id linkage
- `measurements` - Measurement data with external_measurement_id linkage
- `integration_jobs` - External sync job tracking
- `audit_logs` - Audit trail (admin-only access)
- `profiles` - User profile (1:1 with auth.users)

### Real-time & Caching
- **Cache usage is prohibited** as a primary strategy
- Use Supabase Realtime for UI updates (WebSocket/SSE)
- Reads go to primary (read-your-writes consistency)
- Replicas only for latency-sensitive scenarios
- Limited fallback cache only during failures (short TTL, explicit flag)

### Security & Access Control
- **RLS**: Owner-based row-level security (owner_user_id) + admin exceptions
- **M2M Auth**: OAuth2 Client Credentials, short-lived tokens, minimal privileges
- **Audit**: All create/update/delete/sync/retry logged to audit_logs
- **Roles**: admin (full access), manager (team scope), user (owner scope), viewer (read-only)

## Directory Structure

```
customer_management/
├── app/                      # Next.js App Router pages & API routes
│   ├── (pages)/             # Page components
│   ├── api/                 # API route handlers
│   │   ├── customers/       # Customer CRUD
│   │   ├── contacts/        # Contact CRUD
│   │   ├── orders/          # Order read API
│   │   ├── measurements/    # Measurement read API
│   │   ├── m2m/            # M2M reference API
│   │   ├── internal/        # Internal upsert APIs
│   │   └── auth/           # Auth endpoints
│   └── layout.tsx          # Root layout
├── components/              # React components
│   └── layout/             # Layout components (AppLayout, Header, Sidebar, RightPanel)
├── lib/                    # Shared libraries
│   ├── auth/               # Auth helpers (session, OAuth2, roles)
│   ├── supabase/           # Supabase client
│   ├── middleware/         # Rate limiting, IP allowlist
│   ├── validation/         # Zod schemas
│   ├── audit/              # Audit logging
│   ├── customers/          # Customer resolver logic
│   └── errors/             # Error handling
├── services/
│   └── integration/        # Python FastAPI integration service
│       └── app/
│           ├── api/        # Webhook & sync endpoints
│           ├── core/       # Config, logging, auth, idempotency
│           └── services/   # External API client, customer API client, resolver, job tracker
├── database/
│   ├── migrations/         # SQL migration files (apply in order)
│   └── seeds/              # Test data
├── docs/
│   └── requirements/       # Detailed requirement documents
├── shared/                 # Shared code (if needed)
└── styles/                # Global styles

```

## Key Implementation Patterns

### Error Handling
- 4xx errors: Log failure, mark for review
- 5xx/network errors: Auto-retry with exponential backoff
- Circuit breaker pattern for external APIs
- Idempotency keys for safe retries

### External Integration (Webhook-first)
1. External API → Webhook → Integration service → Internal upsert API → Supabase
2. Differential pull as backup (cron-triggered)
3. Event deduplication via event_id/idempotency_key
4. Job tracking in integration_jobs table

### M2M Reference API
- OAuth2 Client Credentials authentication
- Rate limiting and IP allowlisting
- Read-only, no caching (strong consistency)
- SLO: P95 < 200ms
- Uses FTS (Full-Text Search) and indexes for performance

### Monitoring & Observability
- Structured logs: request_id, user_id, entity, action, duration, status
- Metrics: sync success rate, latency, webhook delay, M2M SLO, UI freshness
- Sensitive data masking in all logs

## Testing Strategy

- **Unit tests**: BFF/FastAPI business logic
- **Integration tests**: BFF ↔ Supabase, Integration ↔ External API mocks
- **E2E tests**: Key scenarios (customer detail with external ID, retry, M2M search, real-time updates)
- **Contract tests**: BFF-Frontend, Integration-External API, M2M-Consumer services

## Important Documentation

Before starting new features, read these requirement documents:
1. `docs/requirements/01_business_requirements.md` - Business scope, KPIs, priorities
2. `docs/requirements/02_personas_use_cases.md` - User personas and use cases
3. `docs/requirements/03_data_model_supabase.md` - Data model and RLS policies
4. `docs/requirements/04_external_api_integration.md` - External API integration patterns
5. `docs/requirements/05_architecture.md` - Architecture and API boundaries
6. `docs/requirements/06_nonfunctional_security_ops.md` - SLOs, security, operations
7. `docs/requirements/07_frontend_design_rules.md` - Frontend design rules (if exists)

Also check `.cursorrules` for the latest project guidelines and decisions.

## Prohibited Practices

### Backend
- Using cache as primary strategy (only allowed for failure fallback)
- Direct DB access from other services (must use M2M API)
- Bypassing RLS with service role key inappropriately
- Logging sensitive information

### Frontend
- Creating pages without AppLayout wrapper
- Creating custom headers/sidebars per page
- Overriding global layout styles
- Hard-coding colors outside CSS variables

### General
- Using `&&`, `|`, `cat` commands (PowerShell environment)
- Skipping error handling
- Missing audit logs for sensitive operations

## Environment & Deployment

- Environments: dev, staging, production
- Database schema sync via migrations
- Secrets: Environment-separated, minimal privilege, rotated regularly
- Recovery: PostgreSQL PITR/snapshots with documented runbooks

## Capacity Planning

- Customers: 100,000
- Orders: 1,000,000/year
- Measurements: 5,000,000/year
- Data retention: 5 years
- Backup: Monthly cold backup to NAS, restore capability required

## chat rules

- When starting a new query (conversation), always review and understand the documentation in docs\requirements before proceeding.

---

Last updated: 2025-10-21
Requirements version: v0.4
