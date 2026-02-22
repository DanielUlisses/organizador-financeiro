"""Schemas for user backup import/export."""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.bank_account import AccountType
from app.models.payment import PaymentCategory, PaymentFrequency, PaymentStatus, PaymentType
from app.models.transaction_metadata import BudgetScope, TransactionType


BACKUP_VERSION = "1.0"


class BackupBankAccount(BaseModel):
    id: int
    name: str
    account_type: AccountType
    bank_name: Optional[str] = None
    account_number_last4: Optional[str] = None
    balance: Decimal
    currency: str = "USD"
    color: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class BackupCreditCard(BaseModel):
    id: int
    name: str
    issuer: Optional[str] = None
    card_network: Optional[str] = None
    card_number_last4: Optional[str] = None
    credit_limit: Decimal
    current_balance: Decimal
    default_payment_account_id: Optional[int] = None
    invoice_close_day: int
    payment_due_day: int
    currency: str = "USD"
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class BackupTransactionCategory(BaseModel):
    id: int
    transaction_type: TransactionType
    name: str
    color: str
    icon: str
    budget: Optional[Decimal] = None
    budget_scope: BudgetScope = BudgetScope.ALL_MONTHS
    budget_month: Optional[date] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class BackupTransactionTag(BaseModel):
    id: int
    name: str
    color: str
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class BackupPayment(BaseModel):
    id: int
    payment_type: PaymentType
    description: str
    amount: Decimal
    currency: str = "USD"
    category: Optional[PaymentCategory] = None
    category_id: Optional[int] = None
    from_account_type: Optional[str] = None
    from_account_id: Optional[int] = None
    to_account_type: Optional[str] = None
    to_account_id: Optional[int] = None
    due_date: Optional[date] = None
    frequency: Optional[PaymentFrequency] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    next_due_date: Optional[date] = None
    status: PaymentStatus
    processed_date: Optional[date] = None
    reconciled_date: Optional[date] = None
    notes: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class BackupPaymentTag(BaseModel):
    payment_id: int
    tag_id: int


class BackupPaymentOccurrence(BaseModel):
    id: int
    payment_id: int
    scheduled_date: date
    due_date: Optional[date] = None
    amount: Decimal
    status: PaymentStatus
    processed_date: Optional[date] = None
    reconciled_date: Optional[date] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class BackupRecurringPaymentOverride(BaseModel):
    id: int
    payment_id: int
    override_type: str
    target_date: Optional[date] = None
    effective_date: date
    end_date: Optional[date] = None
    occurrence_count: Optional[int] = None
    new_amount: Optional[Decimal] = None
    new_due_date: Optional[date] = None
    is_active: bool = True
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class BackupData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    bank_accounts: list[BackupBankAccount] = []
    credit_cards: list[BackupCreditCard] = []
    categories: list[BackupTransactionCategory] = []
    tags: list[BackupTransactionTag] = []
    payments: list[BackupPayment] = []
    payment_tags: list[BackupPaymentTag] = []
    payment_occurrences: list[BackupPaymentOccurrence] = []
    recurring_payment_overrides: list[BackupRecurringPaymentOverride] = []


class BackupExportResponse(BaseModel):
    version: str = BACKUP_VERSION
    exported_at: datetime
    data: BackupData


class BackupImportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    version: str
    exported_at: Optional[datetime] = None
    data: BackupData


class BackupImportResponse(BaseModel):
    status: str = "ok"
    imported_at: datetime
