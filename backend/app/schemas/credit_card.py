"""Credit card schemas"""
from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional, List
from decimal import Decimal


class CreditCardBase(BaseModel):
    name: str
    issuer: Optional[str] = None
    card_number_last4: Optional[str] = None
    credit_limit: Decimal
    default_payment_account_id: Optional[int] = None
    invoice_close_day: int = Field(ge=1, le=31, description="Day of month (1-31)")
    payment_due_day: int = Field(ge=1, le=31, description="Days after close date")
    currency: str = "USD"


class CreditCardCreate(CreditCardBase):
    current_balance: Decimal = Decimal("0.00")


class CreditCardUpdate(BaseModel):
    name: Optional[str] = None
    issuer: Optional[str] = None
    card_number_last4: Optional[str] = None
    credit_limit: Optional[Decimal] = None
    default_payment_account_id: Optional[int] = None
    current_balance: Optional[Decimal] = None
    invoice_close_day: Optional[int] = Field(None, ge=1, le=31)
    payment_due_day: Optional[int] = Field(None, ge=1, le=31)
    currency: Optional[str] = None
    is_active: Optional[bool] = None


class CreditCardResponse(CreditCardBase):
    id: int
    user_id: int
    current_balance: Decimal
    is_active: bool
    created_at: datetime
    updated_at: datetime
    available_credit: Decimal
    utilization_percentage: Decimal

    class Config:
        from_attributes = True


class CreditCardInvoiceCycleResponse(BaseModel):
    card_id: int
    reference_date: date
    cycle_start_date: date
    cycle_end_date: date
    close_date: date
    due_date: date


class CreditCardStatementTransactionResponse(BaseModel):
    payment_id: int
    occurrence_id: Optional[int] = None
    description: str
    amount: Decimal
    signed_amount: Decimal
    transaction_date: date
    status: str
    direction: str


class CreditCardStatementResponse(BaseModel):
    card_id: int
    user_id: int
    reference_date: date
    cycle_start_date: date
    cycle_end_date: date
    close_date: date
    due_date: date
    transaction_count: int
    charges_total: Decimal
    payments_total: Decimal
    statement_balance: Decimal
    transactions: List[CreditCardStatementTransactionResponse]
