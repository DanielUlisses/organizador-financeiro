"""Bank account schemas"""
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from decimal import Decimal
from app.models.bank_account import AccountType


class BankAccountBase(BaseModel):
    name: str
    account_type: AccountType
    bank_name: Optional[str] = None
    account_number_last4: Optional[str] = None
    color: Optional[str] = None
    currency: str = "USD"


class BankAccountCreate(BankAccountBase):
    balance: Decimal = Decimal("0.00")


class BankAccountUpdate(BaseModel):
    name: Optional[str] = None
    account_type: Optional[AccountType] = None
    bank_name: Optional[str] = None
    account_number_last4: Optional[str] = None
    color: Optional[str] = None
    balance: Optional[Decimal] = None
    currency: Optional[str] = None
    is_active: Optional[bool] = None


class BankAccountResponse(BankAccountBase):
    id: int
    user_id: int
    balance: Decimal
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
