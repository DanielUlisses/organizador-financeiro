"""Transaction metadata models: categories and tags."""
import enum

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Table,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db import Base


class TransactionType(str, enum.Enum):
    EXPENSE = "expense"
    INCOME = "income"
    TRANSFER = "transfer"


class BudgetScope(str, enum.Enum):
    CURRENT_MONTH = "current_month"
    ALL_MONTHS = "all_months"


payment_tags = Table(
    "payment_tags",
    Base.metadata,
    Column("payment_id", Integer, ForeignKey("payments.id"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("transaction_tags.id"), primary_key=True),
)


class TransactionCategory(Base):
    __tablename__ = "transaction_categories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    transaction_type = Column(Enum(TransactionType), nullable=False)
    name = Column(String, nullable=False)
    color = Column(String(7), nullable=False, default="#5B8DEF")
    icon = Column(String(40), nullable=False, default="folder")
    budget = Column(Numeric(15, 2), nullable=True)
    budget_scope = Column(Enum(BudgetScope), nullable=False, default=BudgetScope.ALL_MONTHS)
    budget_month = Column(Date, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "transaction_type", "name", "budget_month", name="uq_tx_category_scope"),
    )

    payments = relationship("Payment", back_populates="transaction_category")


class TransactionTag(Base):
    __tablename__ = "transaction_tags"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    color = Column(String(7), nullable=False, default="#8B5CF6")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_tx_tag_name"),)

    payments = relationship("Payment", secondary=payment_tags, back_populates="tags")
