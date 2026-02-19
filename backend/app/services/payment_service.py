"""Payment service"""
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from app.models.payment import (
    Payment,
    PaymentType,
    PaymentFrequency,
    PaymentStatus,
    PaymentOccurrence,
    RecurringPaymentOverride,
)
from app.schemas.payment import (
    OneTimePaymentCreate,
    RecurringPaymentCreate,
    PaymentUpdate,
    PaymentOccurrenceCreate,
    PaymentOccurrenceUpdate,
    RecurringPaymentOverrideCreate,
    RecurringPaymentOverrideUpdate,
)
from typing import Optional, List
from decimal import Decimal
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta


class PaymentService:
    """Service for payment operations"""

    @staticmethod
    def get_payment(db: Session, payment_id: int, user_id: int) -> Optional[Payment]:
        """Get payment by ID for a specific user"""
        return db.query(Payment).filter(
            Payment.id == payment_id,
            Payment.user_id == user_id
        ).first()

    @staticmethod
    def get_payments_by_user(
        db: Session,
        user_id: int,
        payment_type: Optional[PaymentType] = None,
        status: Optional[PaymentStatus] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Payment]:
        """Get all payments for a user with optional filters"""
        query = db.query(Payment).filter(Payment.user_id == user_id)
        
        if payment_type:
            query = query.filter(Payment.payment_type == payment_type)
        if status:
            query = query.filter(Payment.status == status)
        
        return query.order_by(Payment.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def create_one_time_payment(
        db: Session, user_id: int, payment_data: OneTimePaymentCreate
    ) -> Payment:
        """Create a one-time payment"""
        payment_dict = payment_data.model_dump()
        payment_dict['payment_type'] = PaymentType.ONE_TIME
        payment_dict['status'] = PaymentStatus.PENDING
        
        db_payment = Payment(user_id=user_id, **payment_dict)
        db.add(db_payment)
        db.flush()  # Get the payment ID before creating occurrence
        
        # Create initial occurrence for one-time payment
        if payment_data.due_date:
            occurrence = PaymentOccurrence(
                payment_id=db_payment.id,
                scheduled_date=payment_data.due_date,
                due_date=payment_data.due_date,
                amount=payment_data.amount,
                status=PaymentStatus.SCHEDULED
            )
            db.add(occurrence)
        
        db.commit()
        db.refresh(db_payment)
        return db_payment

    @staticmethod
    def create_recurring_payment(
        db: Session, user_id: int, payment_data: RecurringPaymentCreate
    ) -> Payment:
        """Create a recurring payment"""
        payment_dict = payment_data.model_dump()
        payment_dict['payment_type'] = PaymentType.RECURRING
        payment_dict['status'] = PaymentStatus.PENDING
        
        # Calculate next due date
        next_due = PaymentService._calculate_next_due_date(
            payment_data.start_date,
            payment_data.frequency
        )
        payment_dict['next_due_date'] = next_due
        
        db_payment = Payment(user_id=user_id, **payment_dict)
        db.add(db_payment)
        db.flush()  # Get the payment ID
        
        # Create initial occurrence
        occurrence = PaymentOccurrence(
            payment_id=db_payment.id,
            scheduled_date=payment_data.start_date,
            due_date=payment_data.start_date,
            amount=payment_data.amount,
            status=PaymentStatus.SCHEDULED
        )
        db.add(occurrence)
        
        db.commit()
        db.refresh(db_payment)
        return db_payment

    @staticmethod
    def update_payment(
        db: Session, payment_id: int, user_id: int, payment_data: PaymentUpdate
    ) -> Optional[Payment]:
        """Update payment"""
        db_payment = db.query(Payment).filter(
            Payment.id == payment_id,
            Payment.user_id == user_id
        ).first()
        
        if not db_payment:
            return None
        
        update_data = payment_data.model_dump(exclude_unset=True)
        
        # Handle next_due_date recalculation for recurring payments
        if db_payment.payment_type == PaymentType.RECURRING:
            if 'frequency' in update_data or 'start_date' in update_data:
                start = update_data.get('start_date', db_payment.start_date)
                freq = update_data.get('frequency', db_payment.frequency)
                if start and freq:
                    update_data['next_due_date'] = PaymentService._calculate_next_due_date(start, freq)
        
        for field, value in update_data.items():
            setattr(db_payment, field, value)
        
        db.commit()
        db.refresh(db_payment)
        return db_payment

    @staticmethod
    def delete_payment(db: Session, payment_id: int, user_id: int) -> bool:
        """Delete payment"""
        db_payment = db.query(Payment).filter(
            Payment.id == payment_id,
            Payment.user_id == user_id
        ).first()
        
        if not db_payment:
            return False
        
        db.delete(db_payment)
        db.commit()
        return True

    @staticmethod
    def get_payment_occurrences(
        db: Session,
        payment_id: int,
        user_id: int,
        status: Optional[PaymentStatus] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[PaymentOccurrence]:
        """Get all occurrences for a payment"""
        # Verify payment belongs to user
        payment = db.query(Payment).filter(
            Payment.id == payment_id,
            Payment.user_id == user_id
        ).first()
        
        if not payment:
            return []
        
        query = db.query(PaymentOccurrence).filter(
            PaymentOccurrence.payment_id == payment_id
        )
        
        if status:
            query = query.filter(PaymentOccurrence.status == status)
        
        return query.order_by(PaymentOccurrence.scheduled_date).offset(skip).limit(limit).all()

    @staticmethod
    def create_payment_occurrence(
        db: Session, payment_id: int, user_id: int, occurrence_data: PaymentOccurrenceCreate
    ) -> Optional[PaymentOccurrence]:
        """Create a payment occurrence"""
        # Verify payment belongs to user
        payment = db.query(Payment).filter(
            Payment.id == payment_id,
            Payment.user_id == user_id
        ).first()
        
        if not payment:
            return None
        
        occurrence = PaymentOccurrence(
            payment_id=payment_id,
            **occurrence_data.model_dump()
        )
        db.add(occurrence)
        db.commit()
        db.refresh(occurrence)
        return occurrence

    @staticmethod
    def update_payment_occurrence(
        db: Session,
        occurrence_id: int,
        user_id: int,
        occurrence_data: PaymentOccurrenceUpdate
    ) -> Optional[PaymentOccurrence]:
        """Update a payment occurrence"""
        # Verify occurrence belongs to user's payment
        occurrence = db.query(PaymentOccurrence).join(Payment).filter(
            PaymentOccurrence.id == occurrence_id,
            Payment.user_id == user_id
        ).first()
        
        if not occurrence:
            return None
        
        update_data = occurrence_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(occurrence, field, value)
        
        db.commit()
        db.refresh(occurrence)
        return occurrence

    @staticmethod
    def delete_payment_occurrence(db: Session, occurrence_id: int, user_id: int) -> bool:
        """Delete a payment occurrence"""
        occurrence = db.query(PaymentOccurrence).join(Payment).filter(
            PaymentOccurrence.id == occurrence_id,
            Payment.user_id == user_id
        ).first()
        
        if not occurrence:
            return False
        
        db.delete(occurrence)
        db.commit()
        return True

    @staticmethod
    def create_recurring_override(
        db: Session, payment_id: int, user_id: int, override_data: RecurringPaymentOverrideCreate
    ) -> Optional[RecurringPaymentOverride]:
        """Create a recurring payment override"""
        # Verify payment belongs to user and is recurring
        payment = db.query(Payment).filter(
            Payment.id == payment_id,
            Payment.user_id == user_id,
            Payment.payment_type == PaymentType.RECURRING
        ).first()
        
        if not payment:
            return None
        
        override = RecurringPaymentOverride(
            payment_id=payment_id,
            **override_data.model_dump()
        )
        db.add(override)
        db.commit()
        db.refresh(override)
        return override

    @staticmethod
    def get_recurring_overrides(
        db: Session, payment_id: int, user_id: int
    ) -> List[RecurringPaymentOverride]:
        """Get all overrides for a recurring payment"""
        # Verify payment belongs to user
        payment = db.query(Payment).filter(
            Payment.id == payment_id,
            Payment.user_id == user_id
        ).first()
        
        if not payment:
            return []
        
        return db.query(RecurringPaymentOverride).filter(
            RecurringPaymentOverride.payment_id == payment_id,
            RecurringPaymentOverride.is_active == True
        ).order_by(RecurringPaymentOverride.effective_date).all()

    @staticmethod
    def update_recurring_override(
        db: Session,
        override_id: int,
        user_id: int,
        override_data: RecurringPaymentOverrideUpdate
    ) -> Optional[RecurringPaymentOverride]:
        """Update a recurring payment override"""
        override = db.query(RecurringPaymentOverride).join(Payment).filter(
            RecurringPaymentOverride.id == override_id,
            Payment.user_id == user_id
        ).first()
        
        if not override:
            return None
        
        update_data = override_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(override, field, value)
        
        db.commit()
        db.refresh(override)
        return override

    @staticmethod
    def delete_recurring_override(db: Session, override_id: int, user_id: int) -> bool:
        """Delete a recurring payment override"""
        override = db.query(RecurringPaymentOverride).join(Payment).filter(
            RecurringPaymentOverride.id == override_id,
            Payment.user_id == user_id
        ).first()
        
        if not override:
            return False
        
        db.delete(override)
        db.commit()
        return True

    @staticmethod
    def generate_recurring_occurrences(
        db: Session, payment_id: int, user_id: int, up_to_date: Optional[date] = None
    ) -> List[PaymentOccurrence]:
        """Generate future occurrences for a recurring payment up to a certain date"""
        payment = db.query(Payment).filter(
            Payment.id == payment_id,
            Payment.user_id == user_id,
            Payment.payment_type == PaymentType.RECURRING
        ).first()
        
        if not payment or not payment.is_active:
            return []
        
        if up_to_date is None:
            up_to_date = date.today() + timedelta(days=365)  # Default: 1 year ahead
        
        # Get existing occurrences
        existing_dates = {
            occ.scheduled_date
            for occ in db.query(PaymentOccurrence).filter(
                PaymentOccurrence.payment_id == payment_id
            ).all()
        }
        
        # Get active overrides
        overrides = db.query(RecurringPaymentOverride).filter(
            RecurringPaymentOverride.payment_id == payment_id,
            RecurringPaymentOverride.is_active == True
        ).all()
        
        generated = []
        current_date = payment.start_date
        end_date = payment.end_date if payment.end_date else up_to_date
        
        while current_date <= min(up_to_date, end_date):
            if current_date not in existing_dates:
                # Check if this date is affected by any override
                amount = payment.amount
                should_skip = False
                
                for override in overrides:
                    if PaymentService._is_date_affected(current_date, override):
                        if override.override_type == 'skip':
                            should_skip = True
                            break
                        elif override.override_type == 'change_amount' and override.new_amount:
                            amount = override.new_amount
                        elif override.override_type == 'change_date' and override.new_due_date:
                            # This would change the due_date, not skip
                            pass
                
                if not should_skip:
                    occurrence = PaymentOccurrence(
                        payment_id=payment_id,
                        scheduled_date=current_date,
                        due_date=current_date,
                        amount=amount,
                        status=PaymentStatus.SCHEDULED
                    )
                    db.add(occurrence)
                    generated.append(occurrence)
            
            # Move to next occurrence
            current_date = PaymentService._calculate_next_due_date(current_date, payment.frequency)
        
        db.commit()
        return generated

    @staticmethod
    def _calculate_next_due_date(start_date: date, frequency: PaymentFrequency) -> date:
        """Calculate next due date based on frequency"""
        if frequency == PaymentFrequency.DAILY:
            return start_date + timedelta(days=1)
        elif frequency == PaymentFrequency.WEEKLY:
            return start_date + timedelta(weeks=1)
        elif frequency == PaymentFrequency.MONTHLY:
            return start_date + relativedelta(months=1)
        elif frequency == PaymentFrequency.QUARTERLY:
            return start_date + relativedelta(months=3)
        elif frequency == PaymentFrequency.YEARLY:
            return start_date + relativedelta(years=1)
        return start_date

    @staticmethod
    def _is_date_affected(target_date: date, override: RecurringPaymentOverride) -> bool:
        """Check if a date is affected by an override"""
        if target_date < override.effective_date:
            return False
        
        if override.end_date and target_date > override.end_date:
            return False
        
        if override.target_date:
            return target_date == override.target_date
        
        return True
