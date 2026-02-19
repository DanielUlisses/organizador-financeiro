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

## Phase 2: Core Domain Models

- [ ] **Bank accounts**: CRUD, balance tracking
- [ ] **Credit cards**: Model with invoice close date, payment date
- [ ] **Investment accounts**: Basic structure
- [ ] User model (single-user per deployment)

## Phase 3: Payments

- [ ] One-time payments
- [ ] Recurring payments (with/without end date)
- [ ] Recurring edit rules: single occurrence vs multiple/future
- [ ] Payment status and reconciliation

## Phase 4: Credit Card Workflows

- [ ] Invoice close date logic
- [ ] Payment due date handling
- [ ] Statement generation / summary

## Phase 5: Reports & Analytics

- [ ] Chart library integration (e.g. Recharts)
- [ ] Expense breakdown by category/time
- [ ] Income vs expenses
- [ ] Professional report layout

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
