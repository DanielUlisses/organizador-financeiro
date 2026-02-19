"""Investment account model (extended with holdings, history, performance)"""
from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Enum, Text, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from app.db import Base


class InvestmentAccountType(str, enum.Enum):
    """Investment account types"""
    BROKERAGE = "brokerage"
    IRA = "ira"
    ROTH_IRA = "roth_ira"
    TRADITIONAL_401K = "traditional_401k"
    ROTH_401K = "roth_401k"
    OTHER = "other"


class InvestmentAssetType(str, enum.Enum):
    """Supported Brazilian-focused investment asset classes."""
    NATIONAL_TREASURY = "national_treasury"
    CDB_RDB = "cdb_rdb"
    STOCK = "stock"
    FII = "fii"
    FUND = "fund"
    OTHER = "other"


class InvestmentAccount(Base):
    """Investment account model with extended features"""
    __tablename__ = "investment_accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    account_type = Column(Enum(InvestmentAccountType), nullable=False)
    broker_name = Column(String, nullable=True)
    account_number_last4 = Column(String(4), nullable=True)
    current_value = Column(Numeric(15, 2), default=0.00, nullable=False)
    currency = Column(String(3), default="USD", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", backref="investment_accounts")
    holdings = relationship("InvestmentHolding", back_populates="account", cascade="all, delete-orphan")
    history = relationship("InvestmentHistory", back_populates="account", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<InvestmentAccount(id={self.id}, name={self.name}, value={self.current_value})>"


class InvestmentHolding(Base):
    """Individual holdings within an investment account"""
    __tablename__ = "investment_holdings"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("investment_accounts.id"), nullable=False, index=True)
    symbol = Column(String, nullable=False)  # e.g., "AAPL", "VTI"
    name = Column(String, nullable=True)
    asset_type = Column(Enum(InvestmentAssetType), nullable=False, default=InvestmentAssetType.OTHER)
    fund_cnpj = Column(String(18), nullable=True)  # Required for Brazilian funds
    quantity = Column(Numeric(15, 6), nullable=False)  # Number of shares/units
    average_cost = Column(Numeric(15, 2), nullable=False)  # Average cost per share
    current_price = Column(Numeric(15, 2), nullable=True)  # Current market price
    current_value = Column(Numeric(15, 2), nullable=False)  # quantity * current_price
    currency = Column(String(3), default="USD", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    account = relationship("InvestmentAccount", back_populates="holdings")

    def __repr__(self):
        return f"<InvestmentHolding(id={self.id}, symbol={self.symbol}, quantity={self.quantity})>"

    @property
    def unrealized_gain_loss(self):
        """Calculate unrealized gain/loss"""
        if self.current_price is None:
            return None
        total_cost = self.quantity * self.average_cost
        return self.current_value - total_cost

    @property
    def unrealized_gain_loss_percentage(self):
        """Calculate unrealized gain/loss percentage"""
        if self.current_price is None or self.average_cost == 0:
            return None
        return ((self.current_price - self.average_cost) / self.average_cost) * 100


class InvestmentHistory(Base):
    """Historical snapshots of investment account values"""
    __tablename__ = "investment_history"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("investment_accounts.id"), nullable=False, index=True)
    snapshot_date = Column(DateTime(timezone=True), nullable=False, index=True)
    total_value = Column(Numeric(15, 2), nullable=False)
    total_cost_basis = Column(Numeric(15, 2), nullable=False)  # Total cost basis
    total_gain_loss = Column(Numeric(15, 2), nullable=False)  # Total gain/loss
    total_gain_loss_percentage = Column(Numeric(5, 2), nullable=False)  # Percentage gain/loss
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    account = relationship("InvestmentAccount", back_populates="history")

    def __repr__(self):
        return f"<InvestmentHistory(id={self.id}, date={self.snapshot_date}, value={self.total_value})>"
