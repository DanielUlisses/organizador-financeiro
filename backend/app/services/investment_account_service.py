"""Investment account service"""
from sqlalchemy.orm import Session
from app.models.investment_account import InvestmentAccount, InvestmentHolding, InvestmentHistory
from app.schemas.investment_account import (
    InvestmentAccountCreate,
    InvestmentAccountUpdate,
    InvestmentHoldingCreate,
    InvestmentHoldingUpdate,
    InvestmentHistoryCreate,
)
from typing import Optional, List
from decimal import Decimal


class InvestmentAccountService:
    """Service for investment account operations"""

    @staticmethod
    def get_account(db: Session, account_id: int, user_id: int) -> Optional[InvestmentAccount]:
        """Get investment account by ID for a specific user"""
        return db.query(InvestmentAccount).filter(
            InvestmentAccount.id == account_id,
            InvestmentAccount.user_id == user_id
        ).first()

    @staticmethod
    def get_accounts_by_user(db: Session, user_id: int, skip: int = 0, limit: int = 100) -> List[InvestmentAccount]:
        """Get all investment accounts for a user"""
        return db.query(InvestmentAccount).filter(
            InvestmentAccount.user_id == user_id
        ).offset(skip).limit(limit).all()

    @staticmethod
    def create_account(db: Session, user_id: int, account_data: InvestmentAccountCreate) -> InvestmentAccount:
        """Create a new investment account"""
        db_account = InvestmentAccount(user_id=user_id, **account_data.model_dump())
        db.add(db_account)
        db.commit()
        db.refresh(db_account)
        return db_account

    @staticmethod
    def update_account(
        db: Session, account_id: int, user_id: int, account_data: InvestmentAccountUpdate
    ) -> Optional[InvestmentAccount]:
        """Update investment account"""
        db_account = db.query(InvestmentAccount).filter(
            InvestmentAccount.id == account_id,
            InvestmentAccount.user_id == user_id
        ).first()
        
        if not db_account:
            return None
        
        update_data = account_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_account, field, value)
        
        db.commit()
        db.refresh(db_account)
        return db_account

    @staticmethod
    def delete_account(db: Session, account_id: int, user_id: int) -> bool:
        """Delete investment account"""
        db_account = db.query(InvestmentAccount).filter(
            InvestmentAccount.id == account_id,
            InvestmentAccount.user_id == user_id
        ).first()
        
        if not db_account:
            return False
        
        db.delete(db_account)
        db.commit()
        return True

    @staticmethod
    def get_total_value(db: Session, user_id: int) -> Decimal:
        """Get total value across all active accounts for a user"""
        result = db.query(InvestmentAccount).filter(
            InvestmentAccount.user_id == user_id,
            InvestmentAccount.is_active == True
        ).with_entities(InvestmentAccount.current_value).all()
        
        return sum(row[0] for row in result) if result else Decimal("0.00")


class InvestmentHoldingService:
    """Service for investment holding operations"""

    @staticmethod
    def get_holding(db: Session, holding_id: int, account_id: int) -> Optional[InvestmentHolding]:
        """Get holding by ID"""
        return db.query(InvestmentHolding).filter(
            InvestmentHolding.id == holding_id,
            InvestmentHolding.account_id == account_id
        ).first()

    @staticmethod
    def get_holdings_by_account(db: Session, account_id: int) -> List[InvestmentHolding]:
        """Get all holdings for an account"""
        return db.query(InvestmentHolding).filter(
            InvestmentHolding.account_id == account_id
        ).all()

    @staticmethod
    def create_holding(db: Session, account_id: int, holding_data: InvestmentHoldingCreate) -> InvestmentHolding:
        """Create a new holding"""
        db_holding = InvestmentHolding(account_id=account_id, **holding_data.model_dump())
        db.add(db_holding)
        db.flush()
        InvestmentHoldingService._refresh_account_current_value(db, account_id)
        db.commit()
        db.refresh(db_holding)
        return db_holding

    @staticmethod
    def update_holding(
        db: Session, holding_id: int, account_id: int, holding_data: InvestmentHoldingUpdate
    ) -> Optional[InvestmentHolding]:
        """Update holding"""
        db_holding = db.query(InvestmentHolding).filter(
            InvestmentHolding.id == holding_id,
            InvestmentHolding.account_id == account_id
        ).first()
        
        if not db_holding:
            return None
        
        update_data = holding_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_holding, field, value)
        InvestmentHoldingService._refresh_account_current_value(db, account_id)
        db.commit()
        db.refresh(db_holding)
        return db_holding

    @staticmethod
    def delete_holding(db: Session, holding_id: int, account_id: int) -> bool:
        """Delete holding"""
        db_holding = db.query(InvestmentHolding).filter(
            InvestmentHolding.id == holding_id,
            InvestmentHolding.account_id == account_id
        ).first()
        
        if not db_holding:
            return False
        
        db.delete(db_holding)
        db.flush()
        InvestmentHoldingService._refresh_account_current_value(db, account_id)
        db.commit()
        return True

    @staticmethod
    def _refresh_account_current_value(db: Session, account_id: int) -> None:
        holdings = db.query(InvestmentHolding).filter(
            InvestmentHolding.account_id == account_id
        ).with_entities(InvestmentHolding.current_value).all()
        total = sum(row[0] for row in holdings) if holdings else Decimal("0.00")
        account = db.query(InvestmentAccount).filter(InvestmentAccount.id == account_id).first()
        if account:
            account.current_value = total


class InvestmentHistoryService:
    """Service for investment history operations"""

    @staticmethod
    def create_history(db: Session, account_id: int, history_data: InvestmentHistoryCreate) -> InvestmentHistory:
        """Create a new history entry"""
        db_history = InvestmentHistory(account_id=account_id, **history_data.model_dump())
        db.add(db_history)
        db.commit()
        db.refresh(db_history)
        return db_history

    @staticmethod
    def get_history_by_account(db: Session, account_id: int, limit: int = 100) -> List[InvestmentHistory]:
        """Get history for an account"""
        return db.query(InvestmentHistory).filter(
            InvestmentHistory.account_id == account_id
        ).order_by(InvestmentHistory.snapshot_date.desc()).limit(limit).all()
