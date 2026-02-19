"""Bank account model"""
from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from app.db import Base


class AccountType(str, enum.Enum):
    """Bank account types"""
    CHECKING = "checking"
    SAVINGS = "savings"
    MONEY_MARKET = "money_market"
    OTHER = "other"


class BankAccount(Base):
    """Bank account model"""
    __tablename__ = "bank_accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    account_type = Column(Enum(AccountType), nullable=False, default=AccountType.CHECKING)
    bank_name = Column(String, nullable=True)
    account_number_last4 = Column(String(4), nullable=True)  # Last 4 digits for display
    balance = Column(Numeric(15, 2), default=0.00, nullable=False)
    currency = Column(String(3), default="USD", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", backref="bank_accounts")

    def __repr__(self):
        return f"<BankAccount(id={self.id}, name={self.name}, balance={self.balance})>"
