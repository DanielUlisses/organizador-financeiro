"""Credit card service"""
import calendar
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional, List, Dict, Any

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models.credit_card import CreditCard
from app.models.payment import Payment, PaymentOccurrence, PaymentStatus
from app.schemas.credit_card import CreditCardCreate, CreditCardUpdate


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

    @staticmethod
    def get_invoice_cycle(db: Session, card_id: int, user_id: int, reference_date: date) -> Optional[Dict[str, date]]:
        """Return cycle dates and due date for a credit card at a reference date."""
        card = CreditCardService.get_card(db, card_id, user_id)
        if not card:
            return None

        close_date = CreditCardService._build_date_with_day(
            reference_date.year, reference_date.month, card.invoice_close_day
        )

        if reference_date <= close_date:
            prev_month_year, prev_month = CreditCardService._shift_month(reference_date.year, reference_date.month, -1)
            prev_close = CreditCardService._build_date_with_day(prev_month_year, prev_month, card.invoice_close_day)
            cycle_start = prev_close + timedelta(days=1)
            cycle_end = close_date
        else:
            next_month_year, next_month = CreditCardService._shift_month(reference_date.year, reference_date.month, 1)
            next_close = CreditCardService._build_date_with_day(next_month_year, next_month, card.invoice_close_day)
            cycle_start = close_date + timedelta(days=1)
            cycle_end = next_close
            close_date = next_close

        due_date = close_date + timedelta(days=card.payment_due_day)

        return {
            "cycle_start_date": cycle_start,
            "cycle_end_date": cycle_end,
            "close_date": close_date,
            "due_date": due_date,
        }

    @staticmethod
    def get_statement_summary(
        db: Session, card_id: int, user_id: int, reference_date: date
    ) -> Optional[Dict[str, Any]]:
        """Generate statement summary for the invoice cycle containing reference_date."""
        card = CreditCardService.get_card(db, card_id, user_id)
        if not card:
            return None

        cycle = CreditCardService.get_invoice_cycle(db, card_id, user_id, reference_date)
        if not cycle:
            return None

        cycle_start = cycle["cycle_start_date"]
        cycle_end = cycle["cycle_end_date"]

        occurrence_rows = (
            db.query(PaymentOccurrence, Payment)
            .join(Payment, PaymentOccurrence.payment_id == Payment.id)
            .filter(
                Payment.user_id == user_id,
                PaymentOccurrence.scheduled_date >= cycle_start,
                PaymentOccurrence.scheduled_date <= cycle_end,
                PaymentOccurrence.status.notin_([PaymentStatus.CANCELLED, PaymentStatus.FAILED]),
                or_(
                    and_(Payment.from_account_type == "credit_card", Payment.from_account_id == card_id),
                    and_(Payment.to_account_type == "credit_card", Payment.to_account_id == card_id),
                ),
            )
            .all()
        )

        transactions: List[Dict[str, Any]] = []
        seen_payment_ids = set()
        charges_total = Decimal("0.00")
        payments_total = Decimal("0.00")

        for occurrence, payment in occurrence_rows:
            direction = "charge"
            signed_amount = occurrence.amount
            if payment.to_account_type == "credit_card" and payment.to_account_id == card_id:
                direction = "payment"
                signed_amount = -occurrence.amount

            if direction == "charge":
                charges_total += occurrence.amount
            else:
                payments_total += occurrence.amount

            transactions.append(
                {
                    "payment_id": payment.id,
                    "occurrence_id": occurrence.id,
                    "description": payment.description,
                    "amount": occurrence.amount,
                    "signed_amount": signed_amount,
                    "transaction_date": occurrence.scheduled_date,
                    "status": occurrence.status.value,
                    "direction": direction,
                }
            )
            seen_payment_ids.add(payment.id)

        one_time_rows = (
            db.query(Payment)
            .filter(
                Payment.user_id == user_id,
                Payment.id.notin_(seen_payment_ids) if seen_payment_ids else True,
                Payment.due_date.isnot(None),
                Payment.due_date >= cycle_start,
                Payment.due_date <= cycle_end,
                Payment.status.notin_([PaymentStatus.CANCELLED, PaymentStatus.FAILED]),
                or_(
                    and_(Payment.from_account_type == "credit_card", Payment.from_account_id == card_id),
                    and_(Payment.to_account_type == "credit_card", Payment.to_account_id == card_id),
                ),
            )
            .all()
        )

        for payment in one_time_rows:
            direction = "charge"
            signed_amount = payment.amount
            if payment.to_account_type == "credit_card" and payment.to_account_id == card_id:
                direction = "payment"
                signed_amount = -payment.amount

            if direction == "charge":
                charges_total += payment.amount
            else:
                payments_total += payment.amount

            transactions.append(
                {
                    "payment_id": payment.id,
                    "occurrence_id": None,
                    "description": payment.description,
                    "amount": payment.amount,
                    "signed_amount": signed_amount,
                    "transaction_date": payment.due_date,
                    "status": payment.status.value,
                    "direction": direction,
                }
            )

        transactions.sort(key=lambda t: t["transaction_date"])
        statement_balance = charges_total - payments_total

        return {
            "card_id": card.id,
            "user_id": user_id,
            "reference_date": reference_date,
            "cycle_start_date": cycle_start,
            "cycle_end_date": cycle_end,
            "close_date": cycle["close_date"],
            "due_date": cycle["due_date"],
            "transaction_count": len(transactions),
            "charges_total": charges_total,
            "payments_total": payments_total,
            "statement_balance": statement_balance,
            "transactions": transactions,
        }

    @staticmethod
    def _shift_month(year: int, month: int, delta: int) -> tuple[int, int]:
        new_month = month + delta
        new_year = year
        while new_month < 1:
            new_month += 12
            new_year -= 1
        while new_month > 12:
            new_month -= 12
            new_year += 1
        return new_year, new_month

    @staticmethod
    def _build_date_with_day(year: int, month: int, day: int) -> date:
        last_day = calendar.monthrange(year, month)[1]
        safe_day = min(day, last_day)
        return date(year, month, safe_day)
