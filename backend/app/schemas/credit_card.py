"""Credit card schemas"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from decimal import Decimal


class CreditCardBase(BaseModel):
    name: str
    issuer: Optional[str] = None
    card_number_last4: Optional[str] = None
    credit_limit: Decimal
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
