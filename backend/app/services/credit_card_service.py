"""Credit card service"""
import calendar
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional, List, Dict, Any

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models.credit_card import CreditCard
from app.models.bank_account import BankAccount, AccountType
from app.models.payment import Payment, PaymentOccurrence, PaymentStatus, PaymentType, PaymentCategory
from app.schemas.credit_card import CreditCardCreate, CreditCardUpdate


class CreditCardService:
    """Service for credit card operations"""
    PLANNED_PAYMENT_NOTE_PREFIX = "planned_credit_card_payment:card_id="
    PLANNED_PAYMENT_MONTHS_AHEAD = 12

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
        data = card_data.model_dump()
        data["default_payment_account_id"] = CreditCardService._resolve_default_payment_account_id(
            db, user_id, data.get("default_payment_account_id")
        )
        db_card = CreditCard(user_id=user_id, **data)
        db.add(db_card)
        db.flush()
        CreditCardService._sync_planned_payments(db, db_card)
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
        if "default_payment_account_id" in update_data:
            update_data["default_payment_account_id"] = CreditCardService._resolve_default_payment_account_id(
                db, user_id, update_data.get("default_payment_account_id")
            )
        for field, value in update_data.items():
            setattr(db_card, field, value)
        if not db_card.default_payment_account_id:
            db_card.default_payment_account_id = CreditCardService._resolve_default_payment_account_id(
                db, user_id, None
            )
        CreditCardService._sync_planned_payments(db, db_card)
        
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
        if not db_card.default_payment_account_id:
            db_card.default_payment_account_id = CreditCardService._resolve_default_payment_account_id(
                db, user_id, None
            )
        CreditCardService._sync_planned_payments(db, db_card)
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

        db.query(Payment).filter(
            Payment.user_id == user_id,
            Payment.to_account_type == "credit_card",
            Payment.to_account_id == db_card.id,
            Payment.notes.like(f"{CreditCardService.PLANNED_PAYMENT_NOTE_PREFIX}{db_card.id}%"),
            Payment.status.in_([PaymentStatus.PENDING, PaymentStatus.SCHEDULED]),
        ).delete(synchronize_session=False)
        
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
    def get_invoice_history(
        db: Session, card_id: int, user_id: int, months: int = 12
    ) -> Optional[List[Dict[str, Any]]]:
        """Return invoice totals for the last N months (one entry per billing cycle)."""
        card = CreditCardService.get_card(db, card_id, user_id)
        if not card:
            return None
        today = date.today()
        entries: List[Dict[str, Any]] = []
        seen_cycles = set()
        for i in range(months * 2):
            ref = today - timedelta(days=15 * i)
            ref = ref.replace(day=15)
            cycle = CreditCardService.get_invoice_cycle(db, card_id, user_id, ref)
            if not cycle:
                continue
            key = (cycle["cycle_start_date"], cycle["cycle_end_date"])
            if key in seen_cycles:
                continue
            seen_cycles.add(key)
            summary = CreditCardService.get_statement_summary(db, card_id, user_id, ref)
            if not summary:
                continue
            period_label = ref.strftime("%b %Y")
            entries.append({
                "period_label": period_label,
                "cycle_start_date": cycle["cycle_start_date"],
                "cycle_end_date": cycle["cycle_end_date"],
                "charges_total": summary["charges_total"],
                "statement_balance": summary["statement_balance"],
            })
            if len(entries) >= months:
                break
        entries.reverse()
        return entries

    @staticmethod
    def sync_planned_payments(db: Session, card_id: int, user_id: int) -> bool:
        card = CreditCardService.get_card(db, card_id, user_id)
        if not card:
            return False
        if not card.default_payment_account_id:
            card.default_payment_account_id = CreditCardService._resolve_default_payment_account_id(db, user_id, None)
        CreditCardService._sync_planned_payments(db, card)
        db.commit()
        return True

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

    @staticmethod
    def _resolve_default_payment_account_id(
        db: Session, user_id: int, preferred_account_id: Optional[int]
    ) -> Optional[int]:
        if preferred_account_id is not None:
            preferred = db.query(BankAccount).filter(
                BankAccount.id == preferred_account_id,
                BankAccount.user_id == user_id,
                BankAccount.is_active == True,
            ).first()
            if preferred:
                return preferred.id

        checking = db.query(BankAccount).filter(
            BankAccount.user_id == user_id,
            BankAccount.is_active == True,
            BankAccount.account_type == AccountType.CHECKING,
        ).order_by(BankAccount.id).first()
        if checking:
            return checking.id

        fallback = db.query(BankAccount).filter(
            BankAccount.user_id == user_id,
            BankAccount.is_active == True,
        ).order_by(BankAccount.id).first()
        return fallback.id if fallback else None

    @staticmethod
    def _planned_note(card_id: int) -> str:
        return f"{CreditCardService.PLANNED_PAYMENT_NOTE_PREFIX}{card_id}"

    @staticmethod
    def _sync_planned_payments(db: Session, card: CreditCard) -> None:
        if not card.default_payment_account_id:
            return

        today = date.today()
        plan_entries: List[Dict[str, Any]] = []
        for offset in range(CreditCardService.PLANNED_PAYMENT_MONTHS_AHEAD):
            year, month = CreditCardService._shift_month(today.year, today.month, offset)
            reference = date(year, month, min(15, calendar.monthrange(year, month)[1]))
            cycle = CreditCardService.get_invoice_cycle(db, card.id, card.user_id, reference)
            if cycle:
                summary = CreditCardService.get_statement_summary(db, card.id, card.user_id, reference)
                desired_amount = Decimal("0.00")
                if summary:
                    desired_amount = summary["statement_balance"]
                if desired_amount < Decimal("0.00"):
                    desired_amount = Decimal("0.00")
                plan_entries.append(
                    {
                        "due_date": cycle["due_date"],
                        "amount": desired_amount,
                    }
                )

        if not plan_entries:
            return

        due_dates = [entry["due_date"] for entry in plan_entries]
        desired_by_due = {entry["due_date"]: entry["amount"] for entry in plan_entries}

        existing = db.query(Payment).filter(
            Payment.user_id == card.user_id,
            Payment.payment_type == PaymentType.ONE_TIME,
            Payment.to_account_type == "credit_card",
            Payment.to_account_id == card.id,
            Payment.due_date.in_(due_dates),
            Payment.status.notin_([PaymentStatus.CANCELLED, PaymentStatus.FAILED]),
        ).all()

        planned_by_due: Dict[date, Payment] = {}
        blocked_due_dates = set()
        for payment in existing:
            if payment.notes == CreditCardService._planned_note(card.id):
                planned_by_due[payment.due_date] = payment
            else:
                blocked_due_dates.add(payment.due_date)

        for due_date in due_dates:
            if due_date in blocked_due_dates:
                if due_date in planned_by_due:
                    db.delete(planned_by_due[due_date])
                continue

            desired_amount = desired_by_due[due_date]

            planned = planned_by_due.get(due_date)
            if desired_amount <= Decimal("0.00"):
                if planned:
                    db.delete(planned)
                continue

            if planned:
                planned.description = f"Planned payment - {card.name}"
                planned.amount = desired_amount
                planned.currency = card.currency
                planned.category = PaymentCategory.TRANSFER
                planned.from_account_type = "bank_account"
                planned.from_account_id = card.default_payment_account_id
                planned.to_account_type = "credit_card"
                planned.to_account_id = card.id
                planned.status = PaymentStatus.PENDING
                planned.notes = CreditCardService._planned_note(card.id)
            else:
                db.add(
                    Payment(
                        user_id=card.user_id,
                        payment_type=PaymentType.ONE_TIME,
                        description=f"Planned payment - {card.name}",
                        amount=desired_amount,
                        currency=card.currency,
                        category=PaymentCategory.TRANSFER,
                        from_account_type="bank_account",
                        from_account_id=card.default_payment_account_id,
                        to_account_type="credit_card",
                        to_account_id=card.id,
                        due_date=due_date,
                        status=PaymentStatus.PENDING,
                        notes=CreditCardService._planned_note(card.id),
                    )
                )
