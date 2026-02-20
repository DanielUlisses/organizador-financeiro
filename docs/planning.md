# Organizador Financeiro — Frontend Planning

## Scope

This planning document defines the next frontend phases for the web application, aligned with existing repository phases and architecture decisions.

Core goals:

- Build a responsive app shell with compact header and collapsed left sidebar navigation.
- Deliver a complete financial dashboard with strong visual analytics.
- Implement account, credit card, investments, analytics, settings, profile, and login experiences.
- Validate each phase with automated tests using the test agent and MCP tooling during development.

### Locked Decisions (Confirmed)

- `docs/planning.md` is now the main planning document for frontend execution.
- Authentication remains email/password only, with backend auth lock-in deferred to the final frontend phase.
- Header notifications include all internal events (excluding external events/integrations).
- Current implementation focus is frontend only; import workflow is deferred until the full frontend experience is complete.

---

## Frontend Phases

## Phase 0: App Shell, Routing, and Theme

- [x] Routing structure with protected/public pages:
  - `/login`
  - `/dashboard`
  - `/accounts`
  - `/credit-cards`
  - `/investments`
  - `/analytics`
  - `/settings`
  - `/profile`
- [x] Login page exists in this phase as UI route/screen; full authentication enforcement is deferred to final phase
- [x] Main layout with:
  - Collapsed left hamburger sidebar for sections
  - Small top header with app title, user name/avatar, notifications icon
  - Content-focused main area
- [x] Responsive breakpoints for mobile/tablet/desktop
- [x] Light/dark theme toggle with persisted preference
- [x] Shared month navigation state (global provider/store)
- [ ] Shared UI building blocks (`KpiCard`, `ChartCard`, `SectionHeader`, `MonthNavigator`)
- [x] Header notification center for internal events:
  - Pending payments
  - Upcoming credit card due dates
  - Budget threshold alerts
  - Internal reconciliation warnings

## Phase 1: Dashboard

- [x] KPI cards:
  - Current balance
  - Monthly expenses
  - Monthly income
  - Investment percentage over income
  - Expense percentage over income
- [x] Balance split:
  - By account
  - By credit card
- [x] Budgets overview:
  - Configured budgets
  - Consumed amount
- [x] Charts and graphs:
  - Balance trend with chart background on balance card
  - Income vs expenses trend
  - Budget consumption charts
- [x] Month navigation for past and future months
- [x] Independent loading/empty/error states per dashboard widget

## Phase 2: Accounts

- [x] Account statement page for selected month
- [x] Month navigation (past/future)
- [x] Account balance health charts
- [x] Transaction actions:
  - Confirm transaction (consolidation)
  - Update transaction
  - Delete transaction
  - Transfer between accounts
- [x] Sorting and filtering in statement table

## Phase 3: Credit Cards

- [x] Credit card statement/invoice by billing cycle
- [x] Invoice workflow:
  - Open/closed invoice cycle
  - Due date and payment status
  - Invoice summary totals
- [x] Credit card transaction management (create/update/delete)
- [x] Chart set focused on card usage, invoice evolution, and categories
- [x] Month/cycle navigation aligned with account and dashboard behavior

## Phase 4: Investments

- [x] Asset tracking
- [x] Portfolio tracking
- [x] Investment transactions
- [x] Performance charts and indicators
- [x] Allocation and evolution visualizations

## Phase 5: Settings and Profile

- [x] Settings (navigable sections):
  - Currency
  - Transaction ordering (older/newer first)
  - Bank account management (create/list bank accounts)
  - Credit card management
  - Notification preferences (what to be notified about)
- [x] Profile page:
  - User information editing
  - Picture upload
  - Auto-crop workflow for profile image fitting
  - Visualize updated uploaded image files from external storage destination
- [x] Header notification center: working dropdown with notification items when user clicks icon

## Phase 6: Analytics and Custom Correlations

- [x] Phase 6 kickoff: analytics revamp started
- [x] Phase 6 checklist governance:
  - Use this checklist as the implementation tracker for all Phase 6 work
  - Tick each checkbox immediately after its feature is implemented and validated
  - Do not mark items as complete before tests/validation pass for that feature
- [x] Analytics page IA update:
  - Replace left navigation inside analytics with top menu sections (similar grouping behavior to settings page)
  - Keep maximum horizontal space for charts and tables
  - Proposed top sections:
    - Expense trends
    - Expense composition
    - Category comparison
    - Income vs expenses table
    - Investment analysis
- [x] Global analytics filters (applied to all charts/tables in phase):
  - Year selector is mandatory for all analytics sections
  - If selected year contains future months, include planned expenses/incomes in projections
  - Category multi-select (select/deselect categories to show/hide series)
  - Consistent legend toggles and visual state for hidden series
- [x] Expense trends area chart (primary chart):
  - One chart with timeframe switcher: monthly, semester, yearly
  - Time aggregation behavior:
    - Monthly: Jan-Dec points for selected year
    - Semester: H1/H2 totals for selected year
    - Yearly: year-over-year trend (including current selected year context)
  - Series selection:
    - Total expenses
    - Optional stacked/segmented categories based on category selection
  - Show planned future values distinctly (forecast/planned style) when applicable
- [x] Expense composition pie chart:
  - Monthly total expenses split by category
  - Uses selected month within selected year
  - Supports category hide/show interaction with recalculated percentages
- [x] Category comparison chart (time-window comparison):
  - Compare category totals between months for rolling windows: 3, 6, 9, 12 months
  - Window anchored to selected month/year
  - Include planned values for future months in the selected window
  - Visual option: grouped bars or multi-line comparison (final UI decision during implementation)
- [x] Income vs expenses analytics table:
  - 12-month matrix supporting both past and future months from selected anchor month
  - For each month:
    - Income by category + income total
    - Expenses by category + expense total
    - Net result (income - expenses)
  - Clear subtotal/total row styling to maximize readability
- [x] Investment analysis section:
  - Area chart for portfolio growth per investment account over time
  - Support account select/deselect similar to category toggles
  - Respect year filter and include planned/projection points when available
  - Add investment account balances widget/group similar to dashboard balance section for quick account-level totals
- [x] Cross-metric analysis tools:
  - Correlate expense behavior with income and portfolio growth in shared period context
  - Enable quick compare of selected categories/accounts without leaving analytics page
- [x] Custom charts configuration:
  - Select metrics
  - Select period/window
  - Compare series with shared timeline
- [x] Save and reuse custom chart presets

## Phase 7: Authentication Lock-In and Data Import

- [x] Phase 7 kickoff (login/security setup baseline)
- [x] Frontend auth foundation:
  - Auth provider with persisted/expiring session model
  - Login form wired to sign-in flow and redirect to intended protected route
  - Session refresh touchpoint on protected route navigation
- [x] Backend auth contract wiring (setup phase):
  - Frontend auth API client wired to `/auth/login`, `/auth/session`, `/auth/me`, `/auth/logout`
  - Graceful fallback mode while backend lock-in endpoints are still being finalized
- [x] Email/password authentication lock-in for frontend + backend integration
- [x] Protected route enforcement and session refresh behavior
- [ ] Login/logout/session expiration UX polish
- [ ] CSV/OFX import workflow:
  - Upload
  - Preview
  - Mapping
  - Confirm import
- [ ] Import status notifications in header (internal event type)

Phase 7 sequencing note:

- CSV/OFX import remains intentionally separated from the login/security setup step.

---

## Suggested Component Tree

```text
frontend/src/
  app/
    providers/
      ThemeProvider.tsx
      AuthProvider.tsx
      NotificationsProvider.tsx
      MonthContextProvider.tsx
    router/
      AppRouter.tsx
      ProtectedRoute.tsx
  layouts/
    AppLayout.tsx
    AuthLayout.tsx
    Sidebar/
      Sidebar.tsx
      SidebarSection.tsx
      SidebarToggle.tsx
    Header/
      Header.tsx
      HeaderUserMenu.tsx
      HeaderNotifications.tsx
  pages/
    Login/
      LoginPage.tsx
      LoginForm.tsx
    Dashboard/
      DashboardPage.tsx
      widgets/
        BalanceKpiCard.tsx
        IncomeKpiCard.tsx
        ExpenseKpiCard.tsx
        InvestedIncomeKpiCard.tsx
        ExpenseIncomeRatioCard.tsx
        AccountBalanceWidget.tsx
        CreditCardBalanceWidget.tsx
        BudgetConsumptionWidget.tsx
        BalanceMonthlyBackgroundChart.tsx
    Accounts/
      AccountsPage.tsx
      AccountStatementPage.tsx
      components/
        AccountHealthChart.tsx
        AccountTransactionsTable.tsx
        ConfirmTransactionDialog.tsx
        TransferBetweenAccountsDialog.tsx
    CreditCards/
      CreditCardsPage.tsx
      CreditCardStatementPage.tsx
      components/
        InvoiceSummaryCard.tsx
        CreditCardUsageChart.tsx
        CreditCardTransactionsTable.tsx
    Investments/
      InvestmentsPage.tsx
      components/
        PortfolioOverview.tsx
        AssetAllocationChart.tsx
        PerformanceChart.tsx
        InvestmentTransactionsTable.tsx
    Settings/
      SettingsPage.tsx
      sections/
        CurrencySettings.tsx
        TransactionSortingSettings.tsx
        AccountManagementSettings.tsx
        CreditCardManagementSettings.tsx
        DataImportSettings.tsx
    Profile/
      ProfilePage.tsx
      components/
        ProfileForm.tsx
        AvatarUploadCropper.tsx
    Analytics/
      AnalyticsPage.tsx
      components/
        BudgetAnalyticsChart.tsx
        CategoryAnalyticsChart.tsx
        InvestmentAnalyticsChart.tsx
        CustomMetricsBuilder.tsx
        SavedChartPresets.tsx
  components/
    common/
      PageTitle.tsx
      SectionHeader.tsx
      MonthNavigator.tsx
      KpiCard.tsx
      ChartCard.tsx
      EmptyState.tsx
      LoadingState.tsx
      ErrorState.tsx
    forms/
      CurrencyInput.tsx
      AmountInput.tsx
      DateInput.tsx
      SearchInput.tsx
    tables/
      DataTable.tsx
      TableFiltersBar.tsx
  services/
    apiClient.ts
    authApi.ts
    dashboardApi.ts
    accountsApi.ts
    creditCardsApi.ts
    investmentsApi.ts
    analyticsApi.ts
    settingsApi.ts
  hooks/
    useMonthNavigation.ts
    useDashboardData.ts
    useAccountStatement.ts
    useCreditCardStatement.ts
    useInvestmentsData.ts
    useNotifications.ts
  tests/
    setup/
      vitest.setup.ts
    unit/
    integration/
    e2e/
```

---

## Test and Validation Plan Per Phase (Agent + MCP)

Development expectation: every phase must include implementation + validation before being considered complete.

### Validation stack

- Test execution specialist: `test-agent` subagent
- MCP tools:
  - `user-vitest-runner-ping`
  - `user-vitest-runner-run-vitest`
  - `user-vitest-runner-run-vitest-coverage`
  - `user-eslint-lint-files`

### Minimum validation checklist by phase

#### Phase 0

- [ ] Unit tests for layout and navigation components
- [ ] Public routing tests for initial screens (`/login`, `/dashboard`, section placeholders)
- [ ] Theme toggle persistence tests
- [ ] Responsive behavior snapshot/basic interaction tests
- [ ] Header notification center tests for internal event rendering
- [ ] MCP validation:
  - Ping vitest runner
  - Run vitest
  - Run vitest coverage
  - Lint touched frontend files

#### Phase 1

- [ ] Unit tests for KPI cards, month navigator, and chart wrappers
- [ ] Integration tests for dashboard data orchestration and widget states
- [ ] Error/empty/loading state tests per dashboard widget
- [ ] Month switching tests (past/future transitions)
- [ ] MCP validation cycle (same sequence as Phase 0)

#### Phase 2

- [ ] Unit tests for account table actions and dialogs
- [ ] Integration tests for statement totals and month navigation
- [ ] Confirm/update/delete/transfer workflow tests
- [ ] Regression tests for sorting and filtering
- [ ] MCP validation cycle

#### Phase 3

- [ ] Unit tests for invoice calculators and card statement components
- [ ] Integration tests for billing cycle navigation and status transitions
- [ ] Tests for card usage charts data mapping
- [ ] Regression tests for transaction CRUD in credit card context
- [ ] MCP validation cycle

#### Phase 4

- [ ] Unit tests for portfolio aggregates and performance indicators
- [ ] Integration tests for investment transactions and updates
- [ ] Chart data transformation tests for allocations and performance trends
- [ ] MCP validation cycle

#### Phase 5

- [x] Unit tests for settings sections and profile form
- [x] Avatar upload/crop interaction tests
- [x] Updated file visualization tests from external upload storage URL path
- [x] Integration tests for persisted settings effects
- [x] MCP validation cycle

#### Phase 6

- [x] Unit tests for analytics widgets:
  - Timeframe switcher (month/semester/year)
  - Category/account legend toggle behavior
  - Year selector behavior and global filter propagation
- [x] Integration tests for expense charts:
  - Area chart aggregation and timeframe transitions
  - Pie chart category distribution and percentage recalculation
  - Rolling comparison windows (3/6/9/12)
- [x] Integration tests for table analytics:
  - 12-month past/future rendering logic
  - Income/expense category totals and monthly net correctness
- [x] Integration tests for planned future data:
  - Planned values shown only for future months in selected year
  - Visual distinction between realized vs planned
- [x] Integration tests for investment analysis:
  - Portfolio growth by account
  - Dashboard-like investment account balances section consistency
- [x] Tests for saved presets and reload behavior
- [x] Regression tests for cross-metric comparisons
- [x] MCP validation cycle

#### Phase 7

- [x] Unit tests for login form and session guards
- [x] Integration tests for route protection and auth transitions
- [ ] CSV/OFX workflow tests (upload, preview, mapping, confirm)
- [ ] Import notification tests in header
- [ ] MCP validation cycle

Validation note:

- Frontend auth lock-in tests executed successfully.
- Backend auth integration tests were added, but execution requires backend test environment tooling (`pytest`) not available in this runtime.

---

## Initial Phase Setup (Ready to Start)

Phase 0 kickoff checklist:

- [x] Create route and layout folders in `frontend/src`
- [x] Introduce `AppRouter` and `AppLayout`
- [x] Add `ThemeProvider` and persistent theme storage
- [x] Add collapsed sidebar + compact header shell
- [x] Move current `App.tsx` analytics content into `DashboardPage`
- [x] Create placeholder pages for all top-level sections
- [x] Add `MonthContextProvider` and `MonthNavigator`
- [x] Create initial tests:
  - Layout render and sidebar toggle
  - Header render (title, user, notifications)
  - Public routing to placeholders and dashboard
- [x] Run test-agent + MCP validation cycle

Notes:

- test-agent validation was executed successfully (lint + tests + coverage).
- MCP `vitest`/`eslint` runners returned local project path/config issues in this environment; equivalent local validations were executed directly in `frontend` binaries.

Definition of done for Phase 0:

- All top-level routes are reachable and protected as needed.
- Layout is responsive and supports light/dark theme.
- Dashboard route renders from the new page structure.
- CI/local checks (tests + lint) pass for touched frontend files.

---

## Dashboard Layout Suggestions (Image-driven)

Dashboard references were provided. Recommended direction is a hybrid that combines:

- Left navigation style from `Staradmin` and `Mantis` (compact + clear grouping)
- Card spacing and visual hierarchy from `Horizon`
- Financial chart density and multi-device behavior from the investment/tablet mockup

### Selected Direction: Hybrid A+

### Hybrid A+ structure

- Left collapsed sidebar with icon-first navigation and text labels on desktop
- Top compact header (title + notification + user avatar; optional search)
- Main content:
  - Row 1: core KPIs (balance, income, expenses, invested %, spent %)
  - Row 2: monthly balance trend (large panel, chart-in-background card style)
  - Row 3: budgets consumed vs configured + account/card balance split
  - Row 4: cross-metric charts (income vs expenses, investment evolution)

Mobile behavior:

- Sidebar becomes drawer
- KPI row becomes horizontal swipe
- Charts stack vertically with reduced non-essential legends

---

## Color System Suggestions (From Provided References)

Mapped palette for initial tokenization:

- Primary: cobalt/indigo (`#3b5bff`) for selected navigation and primary actions
- Secondary: cyan (`#59cbe8`) for trend support and secondary chart series
- Positive: green (`#22c55e`) for income/gains
- Negative: red (`#ef4444`) for expenses/losses
- Warning: orange (`#f59e0b`) for pending items/threshold alerts
- Neutral backgrounds:
  - Light: `#f4f7fb` / `#ffffff`
  - Dark: `#0f172a` / `#111827`
- Chart palette sequence:
  - `#3b5bff`, `#59cbe8`, `#22c55e`, `#f59e0b`, `#ef4444`, `#8b5cf6`

Status colors:

- Success (`#22c55e`)
- Info (`#3b82f6`)
- Warning (`#f59e0b`)
- Critical (`#ef4444`)

Accessibility target:

- [ ] Minimum WCAG AA contrast for text and critical indicators
- [ ] Avoid relying only on color for status meaning

---

## Docker External Upload Mounts (Planned Infrastructure)

Goal: keep uploaded files outside container layers and make frontend able to visualize updated uploaded assets reliably.

Planned compose mount policy:

- Use host bind mount for upload storage (external destination), example:
  - Host: `/opt/organizador/uploads`
  - Container backend path: `/app/storage/uploads`
- Use explicit environment variable for public URL base:
  - `UPLOADS_PUBLIC_BASE_URL`
- Frontend file/image visualization should resolve URLs from `UPLOADS_PUBLIC_BASE_URL`, never from hardcoded container-local paths.
- When backend updates/replaces files, frontend should show the new version by adding cache-busting query params (`?v=<updated_at_or_hash>`).

