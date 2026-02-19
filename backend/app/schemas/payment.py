"""Payment schemas"""
from pydantic import BaseModel, Field, field_validator
from datetime import datetime, date
from typing import Optional, List
from decimal import Decimal
from app.models.payment import (
    PaymentType,
    PaymentFrequency,
    PaymentStatus,
    PaymentCategory,
)


class PaymentBase(BaseModel):
    description: str
    amount: Decimal
    currency: str = "USD"
    category: Optional[PaymentCategory] = None
    from_account_type: Optional[str] = None  # "bank_account" or "credit_card"
    from_account_id: Optional[int] = None
    to_account_type: Optional[str] = None
    to_account_id: Optional[int] = None
    notes: Optional[str] = None


class OneTimePaymentCreate(PaymentBase):
    """Schema for creating a one-time payment"""
    payment_type: PaymentType = PaymentType.ONE_TIME
    due_date: Optional[date] = None


class RecurringPaymentCreate(PaymentBase):
    """Schema for creating a recurring payment"""
    payment_type: PaymentType = PaymentType.RECURRING
    frequency: PaymentFrequency
    start_date: date
    end_date: Optional[date] = None  # None means no end date


class PaymentUpdate(BaseModel):
    """Schema for updating a payment"""
    description: Optional[str] = None
    amount: Optional[Decimal] = None
    currency: Optional[str] = None
    category: Optional[PaymentCategory] = None
    from_account_type: Optional[str] = None
    from_account_id: Optional[int] = None
    to_account_type: Optional[str] = None
    to_account_id: Optional[int] = None
    due_date: Optional[date] = None  # For one-time payments
    frequency: Optional[PaymentFrequency] = None  # For recurring payments
    start_date: Optional[date] = None  # For recurring payments
    end_date: Optional[date] = None  # For recurring payments
    status: Optional[PaymentStatus] = None
    processed_date: Optional[date] = None
    reconciled_date: Optional[date] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class PaymentResponse(PaymentBase):
    """Schema for payment response"""
    id: int
    user_id: int
    payment_type: PaymentType
    due_date: Optional[date] = None
    frequency: Optional[PaymentFrequency] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    next_due_date: Optional[date] = None
    status: PaymentStatus
    processed_date: Optional[date] = None
    reconciled_date: Optional[date] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PaymentOccurrenceBase(BaseModel):
    scheduled_date: date
    due_date: Optional[date] = None
    amount: Decimal
    notes: Optional[str] = None


class PaymentOccurrenceCreate(PaymentOccurrenceBase):
    """Schema for creating a payment occurrence"""
    pass


class PaymentOccurrenceUpdate(BaseModel):
    """Schema for updating a payment occurrence"""
    scheduled_date: Optional[date] = None
    due_date: Optional[date] = None
    amount: Optional[Decimal] = None
    status: Optional[PaymentStatus] = None
    processed_date: Optional[date] = None
    reconciled_date: Optional[date] = None
    notes: Optional[str] = None


class PaymentOccurrenceResponse(PaymentOccurrenceBase):
    """Schema for payment occurrence response"""
    id: int
    payment_id: int
    status: PaymentStatus
    processed_date: Optional[date] = None
    reconciled_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RecurringPaymentOverrideCreate(BaseModel):
    """Schema for creating a recurring payment override"""
    override_type: str = Field(..., description="Type: 'skip', 'change_amount', 'change_date', 'cancel'")
    target_date: Optional[date] = Field(None, description="Specific date to override (single occurrence)")
    effective_date: date
    end_date: Optional[date] = Field(None, description="When override ends (None = all future)")
    occurrence_count: Optional[int] = Field(None, description="Number of occurrences to affect")
    new_amount: Optional[Decimal] = None
    new_due_date: Optional[date] = None
    notes: Optional[str] = None

    @field_validator('override_type')
    @classmethod
    def validate_override_type(cls, v):
        allowed_types = ['skip', 'change_amount', 'change_date', 'cancel']
        if v not in allowed_types:
            raise ValueError(f"override_type must be one of {allowed_types}")
        return v


class RecurringPaymentOverrideUpdate(BaseModel):
    """Schema for updating a recurring payment override"""
    override_type: Optional[str] = None
    target_date: Optional[date] = None
    effective_date: Optional[date] = None
    end_date: Optional[date] = None
    occurrence_count: Optional[int] = None
    new_amount: Optional[Decimal] = None
    new_due_date: Optional[date] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class RecurringPaymentOverrideResponse(BaseModel):
    """Schema for recurring payment override response"""
    id: int
    payment_id: int
    override_type: str
    target_date: Optional[date] = None
    effective_date: date
    end_date: Optional[date] = None
    occurrence_count: Optional[int] = None
    new_amount: Optional[Decimal] = None
    new_due_date: Optional[date] = None
    is_active: bool
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
