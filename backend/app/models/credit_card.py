"""Credit card model"""
from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Boolean, Integer as SQLInteger
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db import Base


class CreditCard(Base):
    """Credit card model with invoice close date and payment date"""
    __tablename__ = "credit_cards"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    issuer = Column(String, nullable=True)  # e.g., "Visa", "Mastercard", "American Express"
    card_network = Column(String(20), nullable=True)  # 'visa' | 'mastercard' | 'amex' for branding/icon
    card_number_last4 = Column(String(4), nullable=True)  # Last 4 digits for display
    credit_limit = Column(Numeric(15, 2), nullable=False)
    current_balance = Column(Numeric(15, 2), default=0.00, nullable=False)
    default_payment_account_id = Column(Integer, ForeignKey("bank_accounts.id"), nullable=True, index=True)
    invoice_close_day = Column(SQLInteger, nullable=False)  # Day of month (1-31)
    payment_due_day = Column(SQLInteger, nullable=False)  # Days after close date
    currency = Column(String(3), default="USD", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", backref="credit_cards")
    default_payment_account = relationship("BankAccount", foreign_keys=[default_payment_account_id])

    def __repr__(self):
        return f"<CreditCard(id={self.id}, name={self.name}, balance={self.current_balance})>"

    @property
    def available_credit(self):
        """Calculate available credit"""
        return self.credit_limit - self.current_balance

    @property
    def utilization_percentage(self):
        """Calculate credit utilization percentage"""
        if self.credit_limit == 0:
            return 0
        return (self.current_balance / self.credit_limit) * 100
