"""Credit card service"""
from sqlalchemy.orm import Session
from app.models.credit_card import CreditCard
from app.schemas.credit_card import CreditCardCreate, CreditCardUpdate
from typing import Optional, List
from decimal import Decimal


class CreditCardService:
    """Service for credit card operations"""

    @staticmethod
    def get_card(db: Session, card_id: int, user_id: int) -> Optional[CreditCard]:
        """Get credit card by ID for a specific user"""
        return db.query(CreditCard).filter(
            CreditCard.id == card_id,
            CreditCard.user_id == user_id
        ).first()

    @staticmethod
    def get_cards_by_user(db: Session, user_id: int, skip: int = 0, limit: int = 100) -> List[CreditCard]:
        """Get all credit cards for a user"""
        return db.query(CreditCard).filter(
            CreditCard.user_id == user_id
        ).offset(skip).limit(limit).all()

    @staticmethod
    def create_card(db: Session, user_id: int, card_data: CreditCardCreate) -> CreditCard:
        """Create a new credit card"""
        db_card = CreditCard(user_id=user_id, **card_data.model_dump())
        db.add(db_card)
        db.commit()
        db.refresh(db_card)
        return db_card

    @staticmethod
    def update_card(
        db: Session, card_id: int, user_id: int, card_data: CreditCardUpdate
    ) -> Optional[CreditCard]:
        """Update credit card"""
        db_card = db.query(CreditCard).filter(
            CreditCard.id == card_id,
            CreditCard.user_id == user_id
        ).first()
        
        if not db_card:
            return None
        
        update_data = card_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_card, field, value)
        
        db.commit()
        db.refresh(db_card)
        return db_card

    @staticmethod
    def update_balance(db: Session, card_id: int, user_id: int, new_balance: Decimal) -> Optional[CreditCard]:
        """Update card balance"""
        db_card = db.query(CreditCard).filter(
            CreditCard.id == card_id,
            CreditCard.user_id == user_id
        ).first()
        
        if not db_card:
            return None
        
        db_card.current_balance = new_balance
        db.commit()
        db.refresh(db_card)
        return db_card

    @staticmethod
    def delete_card(db: Session, card_id: int, user_id: int) -> bool:
        """Delete credit card"""
        db_card = db.query(CreditCard).filter(
            CreditCard.id == card_id,
            CreditCard.user_id == user_id
        ).first()
        
        if not db_card:
            return False
        
        db.delete(db_card)
        db.commit()
        return True

    @staticmethod
    def get_total_balance(db: Session, user_id: int) -> Decimal:
        """Get total balance across all active cards for a user"""
        result = db.query(CreditCard).filter(
            CreditCard.user_id == user_id,
            CreditCard.is_active == True
        ).with_entities(CreditCard.current_balance).all()
        
        return sum(row[0] for row in result) if result else Decimal("0.00")

    @staticmethod
    def get_total_credit_limit(db: Session, user_id: int) -> Decimal:
        """Get total credit limit across all active cards for a user"""
        result = db.query(CreditCard).filter(
            CreditCard.user_id == user_id,
            CreditCard.is_active == True
        ).with_entities(CreditCard.credit_limit).all()
        
        return sum(row[0] for row in result) if result else Decimal("0.00")
