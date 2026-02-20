"""Schemas for transaction categories and tags."""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel

from app.models.transaction_metadata import BudgetScope, TransactionType


class TransactionCategoryBase(BaseModel):
    transaction_type: TransactionType
    name: str
    color: str = "#5B8DEF"
    icon: str = "folder"
    budget: Optional[Decimal] = None
    budget_scope: BudgetScope = BudgetScope.ALL_MONTHS
    budget_month: Optional[date] = None


class TransactionCategoryCreate(TransactionCategoryBase):
    pass


class TransactionCategoryUpdate(BaseModel):
    transaction_type: Optional[TransactionType] = None
    name: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    budget: Optional[Decimal] = None
    budget_scope: Optional[BudgetScope] = None
    budget_month: Optional[date] = None
    is_active: Optional[bool] = None


class TransactionCategoryResponse(TransactionCategoryBase):
    id: int
    user_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TransactionTagBase(BaseModel):
    name: str
    color: str = "#8B5CF6"


class TransactionTagCreate(TransactionTagBase):
    pass


class TransactionTagUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None


class TransactionTagResponse(TransactionTagBase):
    id: int
    user_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
