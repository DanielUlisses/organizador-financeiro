"""Bank account service"""
from sqlalchemy.orm import Session
from app.models.bank_account import BankAccount
from app.schemas.bank_account import BankAccountCreate, BankAccountUpdate
from typing import Optional, List
from decimal import Decimal


class BankAccountService:
    """Service for bank account operations"""

    @staticmethod
    def get_account(db: Session, account_id: int, user_id: int) -> Optional[BankAccount]:
        """Get bank account by ID for a specific user"""
        return db.query(BankAccount).filter(
            BankAccount.id == account_id,
            BankAccount.user_id == user_id
        ).first()

    @staticmethod
    def get_accounts_by_user(db: Session, user_id: int, skip: int = 0, limit: int = 100) -> List[BankAccount]:
        """Get all bank accounts for a user"""
        return db.query(BankAccount).filter(
            BankAccount.user_id == user_id
        ).offset(skip).limit(limit).all()

    @staticmethod
    def create_account(db: Session, user_id: int, account_data: BankAccountCreate) -> BankAccount:
        """Create a new bank account"""
        db_account = BankAccount(user_id=user_id, **account_data.model_dump())
        db.add(db_account)
        db.commit()
        db.refresh(db_account)
        return db_account

    @staticmethod
    def update_account(
        db: Session, account_id: int, user_id: int, account_data: BankAccountUpdate
    ) -> Optional[BankAccount]:
        """Update bank account"""
        db_account = db.query(BankAccount).filter(
            BankAccount.id == account_id,
            BankAccount.user_id == user_id
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
    def update_balance(db: Session, account_id: int, user_id: int, new_balance: Decimal) -> Optional[BankAccount]:
        """Update account balance"""
        db_account = db.query(BankAccount).filter(
            BankAccount.id == account_id,
            BankAccount.user_id == user_id
        ).first()
        
        if not db_account:
            return None
        
        db_account.balance = new_balance
        db.commit()
        db.refresh(db_account)
        return db_account

    @staticmethod
    def delete_account(db: Session, account_id: int, user_id: int) -> bool:
        """Delete bank account"""
        db_account = db.query(BankAccount).filter(
            BankAccount.id == account_id,
            BankAccount.user_id == user_id
        ).first()
        
        if not db_account:
            return False
        
        db.delete(db_account)
        db.commit()
        return True

    @staticmethod
    def get_total_balance(db: Session, user_id: int) -> Decimal:
        """Get total balance across all active accounts for a user"""
        result = db.query(BankAccount).filter(
            BankAccount.user_id == user_id,
            BankAccount.is_active == True
        ).with_entities(BankAccount.balance).all()
        
        return sum(row[0] for row in result) if result else Decimal("0.00")
