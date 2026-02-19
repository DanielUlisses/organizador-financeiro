"""Payment models for one-time and recurring payments"""
from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Enum, Boolean, Date, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from datetime import date
from app.db import Base


class PaymentType(str, enum.Enum):
    """Payment type"""
    ONE_TIME = "one_time"
    RECURRING = "recurring"


class PaymentFrequency(str, enum.Enum):
    """Recurring payment frequency"""
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"


class PaymentStatus(str, enum.Enum):
    """Payment status"""
    PENDING = "pending"
    SCHEDULED = "scheduled"
    PROCESSED = "processed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RECONCILED = "reconciled"


class PaymentCategory(str, enum.Enum):
    """Payment category"""
    BILL = "bill"
    SUBSCRIPTION = "subscription"
    LOAN = "loan"
    TRANSFER = "transfer"
    EXPENSE = "expense"
    INCOME = "income"
    OTHER = "other"


class Payment(Base):
    """Payment model for one-time and recurring payments"""
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    payment_type = Column(Enum(PaymentType), nullable=False)
    
    # Payment details
    description = Column(String, nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(3), default="USD", nullable=False)
    category = Column(Enum(PaymentCategory), nullable=True)
    category_id = Column(Integer, ForeignKey("transaction_categories.id"), nullable=True, index=True)
    
    # Account references (can be bank account or credit card)
    from_account_type = Column(String, nullable=True)  # "bank_account" or "credit_card"
    from_account_id = Column(Integer, nullable=True)  # ID of bank account or credit card
    to_account_type = Column(String, nullable=True)  # "bank_account" or "credit_card" or external
    to_account_id = Column(Integer, nullable=True)  # ID of bank account or credit card, or None for external
    
    # For one-time payments
    due_date = Column(Date, nullable=True)  # When payment is due
    
    # For recurring payments
    frequency = Column(Enum(PaymentFrequency), nullable=True)  # Only for recurring
    start_date = Column(Date, nullable=True)  # When recurring payments start
    end_date = Column(Date, nullable=True)  # When recurring payments end (None = no end)
    next_due_date = Column(Date, nullable=True)  # Next occurrence date
    
    # Status and reconciliation
    status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING, nullable=False)
    processed_date = Column(Date, nullable=True)  # When payment was actually processed
    reconciled_date = Column(Date, nullable=True)  # When payment was reconciled
    
    # Metadata
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", backref="payments")
    occurrences = relationship("PaymentOccurrence", back_populates="payment", cascade="all, delete-orphan")
    overrides = relationship("RecurringPaymentOverride", back_populates="payment", cascade="all, delete-orphan")
    transaction_category = relationship("TransactionCategory", back_populates="payments")
    tags = relationship("TransactionTag", secondary="payment_tags", back_populates="payments")

    def __repr__(self):
        return f"<Payment(id={self.id}, type={self.payment_type}, amount={self.amount}, status={self.status})>"


class PaymentOccurrence(Base):
    """Individual payment occurrence (for tracking instances of recurring payments or one-time payments)"""
    __tablename__ = "payment_occurrences"

    id = Column(Integer, primary_key=True, index=True)
    payment_id = Column(Integer, ForeignKey("payments.id"), nullable=False, index=True)
    
    # Occurrence details
    scheduled_date = Column(Date, nullable=False, index=True)  # When this occurrence is scheduled
    due_date = Column(Date, nullable=True)  # When this occurrence is due
    amount = Column(Numeric(15, 2), nullable=False)  # Amount for this occurrence (may differ from base payment)
    
    # Status
    status = Column(Enum(PaymentStatus), default=PaymentStatus.SCHEDULED, nullable=False)
    processed_date = Column(Date, nullable=True)
    reconciled_date = Column(Date, nullable=True)
    
    # Notes specific to this occurrence
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    payment = relationship("Payment", back_populates="occurrences")

    def __repr__(self):
        return f"<PaymentOccurrence(id={self.id}, payment_id={self.payment_id}, scheduled_date={self.scheduled_date}, status={self.status})>"


class RecurringPaymentOverride(Base):
    """Override rules for recurring payments (skip, change amount, etc.)"""
    __tablename__ = "recurring_payment_overrides"

    id = Column(Integer, primary_key=True, index=True)
    payment_id = Column(Integer, ForeignKey("payments.id"), nullable=False, index=True)
    
    # Override type
    override_type = Column(String, nullable=False)  # "skip", "change_amount", "change_date", "cancel"
    
    # Target occurrence(s)
    target_date = Column(Date, nullable=True)  # Specific date to override (single occurrence)
    effective_date = Column(Date, nullable=False)  # When override takes effect
    end_date = Column(Date, nullable=True)  # When override ends (None = all future occurrences)
    occurrence_count = Column(Integer, nullable=True)  # Number of occurrences to affect (None = all future)
    
    # Override values
    new_amount = Column(Numeric(15, 2), nullable=True)  # New amount if changing
    new_due_date = Column(Date, nullable=True)  # New due date if changing
    
    # Status
    is_active = Column(Boolean, default=True, nullable=False)
    
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    payment = relationship("Payment", back_populates="overrides")

    def __repr__(self):
        return f"<RecurringPaymentOverride(id={self.id}, payment_id={self.payment_id}, type={self.override_type})>"
