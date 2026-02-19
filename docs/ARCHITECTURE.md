# Organizador Financeiro — Architecture & Phase 1 Roadmap

## 1. Common Features in Finance Management Software

Below is a comparison of features typically found in personal finance software vs. what is planned in this project. **Please indicate for each item whether it is required for your vision or not.**

### Account Management

| Feature | Common in Industry | In Our Planning | **Required?** |
|---------|--------------------|-----------------|---------------|
| Bank accounts (multi-account) | ✓ Core | ✓ Phase 2 | *[x] Yes  [ ] No* |
| Credit cards (invoice close/payment dates) | ✓ Core | ✓ Phase 2–4 | *[x] Yes  [ ] No* |
| Investment accounts | ✓ Common | ✓ Phase 2 (basic) | *[x] Yes  [ ] No* |
| Loans / mortgages | ✓ Common | ✗ Not planned | *[x] Yes  [ ] No* |
| Manual data entry only (no bank sync) | ✓ Some apps | ✓ Assumed | *[x] Yes  [ ] No* |
| Bank/Open Banking sync (import data) | ✓ Many apps | ✗ Not planned | *[ ] Yes  [x] No* |

### Payments & Transactions

| Feature | Common in Industry | In Our Planning | **Required?** |
|---------|--------------------|-----------------|---------------|
| One-time payments | ✓ Core | ✓ Phase 3 | *[x] Yes  [ ] No* |
| Recurring payments | ✓ Core | ✓ Phase 3 | *[x] Yes  [ ] No* |
| Recurring edit rules (single vs multiple) | ✓ Advanced | ✓ Phase 3 | *[x] Yes  [ ] No* |
| Payment status & reconciliation | ✓ Core | ✓ Phase 3 | *[x] Yes  [ ] No* |
| Categories / tags for transactions | ✓ Core | ✗ Implicit | *[x] Yes  [ ] No* |
| Bill pay (actual payment initiation) | ✓ Some apps | ✗ Not planned | *[x] Yes  [ ] No* |

### Budgeting & Goals

| Feature | Common in Industry | In Our Planning | **Required?** |
|---------|--------------------|-----------------|---------------|
| Budget creation / allocation | ✓ Core | ✗ Not explicit | *[x] Yes  [ ] No* |
| Zero-based budgeting style | ✓ YNAB-style | ✗ Not planned | *[ ] Yes  [x] No* |
| Savings / spending goals | ✓ Common | ✗ Not planned | *[x] Yes  [ ] No* |
| Cash flow projection | ✓ Common | ✗ Not planned | *[x] Yes  [ ] No* |

### Credit Card Workflows

| Feature | Common in Industry | In Our Planning | **Required?** |
|---------|--------------------|-----------------|---------------|
| Invoice close date logic | ✓ Core | ✓ Phase 4 | *[x] Yes  [ ] No* |
| Payment due date handling | ✓ Core | ✓ Phase 4 | *[x] Yes  [ ] No* |
| Statement / invoice summary | ✓ Core | ✓ Phase 4 | *[x] Yes  [ ] No* |

### Reports & Analytics

| Feature | Common in Industry | In Our Planning | **Required?** |
|---------|--------------------|-----------------|---------------|
| Expense breakdown by category/time | ✓ Core | ✓ Phase 5 | *[x] Yes  [ ] No* |
| Income vs expenses | ✓ Core | ✓ Phase 5 | *[x] Yes  [ ] No* |
| Net worth tracking | ✓ Core | ✗ Not explicit | *[x] Yes  [ ] No* |
| Custom reports | ✓ Common | ✓ Phase 5 (general) | *[x] Yes  [ ] No* |
| Charts / visualizations (Recharts) | ✓ Common | ✓ Phase 5 | *[x] Yes  [ ] No* |
| Data export (CSV/Excel) | ✓ Common | ✗ Not planned | *[ ] Yes  [x] No* |

### Alerts & Notifications

| Feature | Common in Industry | In Our Planning | **Required?** |
|---------|--------------------|-----------------|---------------|
| Payment due reminders | ✓ Common | ✗ Not planned | *[x] Yes  [ ] No* |
| Budget overspend alerts | ✓ Common | ✗ Not planned | *[x] Yes  [ ] No* |
| Customizable alerts | ✓ Some apps | ✗ Not planned | *[x] Yes  [ ] No* |

### Access & Security

| Feature | Common in Industry | In Our Planning | **Required?** |
|---------|--------------------|-----------------|---------------|
| Web app | ✓ Core | ✓ React frontend | *[x] Yes  [ ] No* |
| Mobile app | ✓ Common | ✗ Web only | *[x] Yes  [ ] No* | Observation: it is only required to capture mobile notification and send to webapplication as transaction
| Single user per deployment | ✓ Some apps | ✓ Design decision | *[x] Yes  [ ] No* |
| better-auth integration | N/A | ✓ Phase 1 | *[x] Yes  [ ] No* |

---

## 2. Decisions Needed Before Finalizing Architecture

Please answer these so we can lock the skeleton and roadmap:

1. **Monorepo vs separate repos**  
   Single repo with `backend/` and `frontend/` (recommended), or separate repositories?
   - *[x] Monorepo  [ ] Separate repos*

2. **Backend framework**  
   - *[x] FastAPI  [ ] Flask*

3. **Features not yet planned**  
   Which of these should be in scope (even if later phases)?
   - Categories/tags for transactions
   - Budget creation/allocation
   - Net worth dashboard
   - Data export (CSV/Excel)
   - Alerts/notifications
   - Loans/mortgages
   - Bank/csv/ofx/pdf import classify flow

4. **Investment accounts depth**  
   Phase 2 mentions "basic structure". Do you want:
   - *[ ] Basic: name, balance, type only  [x] Extended: holdings, history, performance*

---

## 3. Application Architecture (Draft)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React)                                │
│  Vite + React + shadcn/ui + Tailwind + Recharts (Phase 5)                    │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ HTTP / REST (or tRPC later)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (Python)                                │
│  FastAPI | Flask  ──►  Routes  ──►  Services  ──►  Repositories/Models       │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ SQLAlchemy ORM
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PostgreSQL 18                                      │
│  users, accounts, transactions, payments, recurring_rules, ...               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Proposed Directory Structure (Monorepo)

```
organizador-financeiro/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI/Flask app entry
│   │   ├── config.py
│   │   ├── api/                 # Route handlers
│   │   │   ├── routes/
│   │   │   │   ├── health.py
│   │   │   │   ├── auth.py      # better-auth proxied/hooked
│   │   │   │   └── ...
│   │   ├── services/            # Business logic
│   │   ├── models/              # SQLAlchemy models
│   │   └── db/                  # DB session, engine
│   ├── alembic/
│   ├── alembic.ini
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── components/
│   │   ├── pages/
│   │   ├── lib/
│   │   └── ...
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
├── docker/
│   └── docker-compose.yml       # PostgreSQL + (optional) app stacks
├── docs/
├── .env.example
└── README.md
```

---

## 4. Phase 1 — Skeleton & Infrastructure — Implementation Roadmap

All Phase 1 items from `docs/PLANNING.md`, ordered by dependency:

| # | Task | Depends On | Description |
|---|------|------------|-------------|
| 1 | **Project structure** | — | Create monorepo layout: `backend/`, `frontend/`, `docker/` |
| 2 | **Docker Compose for PostgreSQL** | 1 | `docker-compose.yml` with PostgreSQL 18, health check, init scripts |
| 3 | **Backend skeleton** | 1 | FastAPI or Flask app, config, structure (`api/`, `services/`, `models/`, `db/`) |
| 4 | **Frontend skeleton** | 1 | Vite + React + TypeScript + shadcn/ui + Tailwind |
| 5 | **Alembic init** | 2, 3 | Alembic in `backend/`, connection from `.env`, initial migration |
| 6 | **better-auth integration** | 3 | Auth routes, session handling, protected endpoints |
| 7 | **Health/status endpoints** | 3 | `/health`, `/ready` (DB check) for backend |

### Detailed Step-by-Step

1. **Project structure** — Add folders and minimal placeholders so tooling and agents understand the layout.
2. **Docker Compose** — PostgreSQL 18 container, env vars for `DATABASE_URL`, volume for data.
3. **Backend skeleton** — Choose FastAPI or Flask; set up `main.py`, config loading from env, CORS if needed.
4. **Frontend skeleton** — Vite + React + TS; add shadcn/ui and Tailwind; optional landing page.
5. **Alembic** — Init in backend; point to PostgreSQL from Docker; first migration can be empty or user table only.
6. **better-auth** — Integrate with backend; login/logout/register flows; middleware for protected routes.
7. **Health endpoints** — `/health` (alive) and `/ready` (DB connectivity) for orchestration and monitoring.

---

## 5. Next Steps

1. **Fill the “Required?” checkboxes and Decisions sections** above.
2. Once confirmed, we can:
   - Lock architecture and update `PLANNING.md`.
   - Start implementing Phase 1 tasks in the order above.
   - Add any newly required features to later phases.

---

*Last updated: Phase 1 planning*
