# Organizador Financeiro — Development Planning

## Tech Stack Summary

| Component | Choice |
|-----------|--------|
| Backend | Python |
| Frontend | React + shadcn/ui + Tailwind |
| Auth | better-auth |
| Database | PostgreSQL 18 |
| ORM | SQLAlchemy |
| Migrations | Alembic |
| Dev | PostgreSQL container |
| Prod | Docker containers |

## Phase 1: Skeleton & Infrastructure ✅

- [x] Project structure (monorepo or separate backend/frontend)
- [x] Docker Compose for local PostgreSQL
- [x] Backend: FastAPI or Flask app skeleton
- [x] Frontend: Vite + React + shadcn/ui + Tailwind setup
- [x] Alembic initialization
- [x] better-auth integration (structure ready, frontend integration pending)
- [x] Basic health/status endpoints

## Phase 2: Core Domain Models ✅

- [x] **Bank accounts**: CRUD, balance tracking
- [x] **Credit cards**: Model with invoice close date, payment date
- [x] **Investment accounts**: Extended structure (holdings, history, performance)
- [x] User model (single-user per deployment)
- [x] Unit tests for all models and services
- [x] Integration tests for all API endpoints
- [x] Database migration

## Phase 3: Payments

- [ ] One-time payments
- [ ] Recurring payments (with/without end date)
- [ ] Recurring edit rules: single occurrence vs multiple/future
- [ ] Payment status and reconciliation

## Phase 4: Credit Card Workflows

- [x] Invoice close date logic
- [x] Payment due date handling
- [x] Statement generation / summary

## Phase 5: Reports & Analytics

- [x] Chart library integration (e.g. Recharts)
- [x] Expense breakdown by category/time
- [x] Income vs expenses
- [x] Professional report layout

## Phase 6: Polish & Deployment

- [ ] Professional layout refinements
- [ ] Container build for backend and frontend
- [ ] Production deployment configuration
- [ ] Documentation

## Domain Notes

### Recurring Payment Edits

- **Single event**: Override one occurrence (e.g. skip, change amount)
- **Multiple events**: Apply change to N future occurrences or all future
- Consider: effective date, override vs base rule

### Credit Cards

- Track: limit, current balance, invoice close day, payment due day
- Invoice = transactions between close dates
- Payment = transfer from bank to credit card

### Single User

- No multi-tenancy; one user per deployment
- Auth still required; simplifies data model
