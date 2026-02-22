"""Payment routes"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from app.db import get_db
from app.schemas.payment import (
    OneTimePaymentCreate,
    RecurringPaymentCreate,
    PaymentUpdate,
    PaymentResponse,
    PaymentOccurrenceCreate,
    PaymentOccurrenceUpdate,
    PaymentOccurrenceResponse,
    RecurringPaymentOverrideCreate,
    RecurringPaymentOverrideUpdate,
    RecurringPaymentOverrideResponse,
)
from app.services.payment_service import PaymentService
from app.models.payment import PaymentType, PaymentStatus

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/", response_model=List[PaymentResponse])
def get_payments(
    user_id: int,
    payment_type: Optional[PaymentType] = None,
    status: Optional[PaymentStatus] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all payments for a user. date_from/date_to filter one-time by due_date; recurring are always included."""
    payments = PaymentService.get_payments_by_user(
        db,
        user_id,
        payment_type=payment_type,
        status=status,
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=limit,
    )
    return payments


@router.get("/{payment_id}", response_model=PaymentResponse)
def get_payment(payment_id: int, user_id: int, db: Session = Depends(get_db)):
    """Get payment by ID"""
    payment = PaymentService.get_payment(db, payment_id, user_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment


@router.post("/one-time", response_model=PaymentResponse, status_code=201)
def create_one_time_payment(
    user_id: int, payment_data: OneTimePaymentCreate, db: Session = Depends(get_db)
):
    """Create a one-time payment"""
    return PaymentService.create_one_time_payment(db, user_id, payment_data)


@router.post("/recurring", response_model=PaymentResponse, status_code=201)
def create_recurring_payment(
    user_id: int, payment_data: RecurringPaymentCreate, db: Session = Depends(get_db)
):
    """Create a recurring payment"""
    return PaymentService.create_recurring_payment(db, user_id, payment_data)


@router.put("/{payment_id}", response_model=PaymentResponse)
def update_payment(
    payment_id: int, user_id: int, payment_data: PaymentUpdate, db: Session = Depends(get_db)
):
    """Update payment"""
    payment = PaymentService.update_payment(db, payment_id, user_id, payment_data)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment


@router.delete("/{payment_id}", status_code=204)
def delete_payment(payment_id: int, user_id: int, db: Session = Depends(get_db)):
    """Delete payment"""
    success = PaymentService.delete_payment(db, payment_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Payment not found")
    return None


# Payment Occurrences

@router.get("/occurrences-in-range", response_model=List[PaymentOccurrenceResponse])
def get_occurrences_in_range(
    user_id: int,
    date_from: date,
    date_to: date,
    status: Optional[PaymentStatus] = None,
    db: Session = Depends(get_db)
):
    """Get all payment occurrences for the user in the given date range (single query, avoids N+1)."""
    occurrences = PaymentService.get_occurrences_in_range(
        db, user_id, date_from=date_from, date_to=date_to, status=status
    )
    return occurrences


@router.get("/{payment_id}/occurrences", response_model=List[PaymentOccurrenceResponse])
def get_payment_occurrences(
    payment_id: int,
    user_id: int,
    status: Optional[PaymentStatus] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all occurrences for a payment, optionally filtered by scheduled_date range."""
    occurrences = PaymentService.get_payment_occurrences(
        db,
        payment_id,
        user_id,
        status=status,
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=limit,
    )
    return occurrences


@router.post("/{payment_id}/occurrences", response_model=PaymentOccurrenceResponse, status_code=201)
def create_payment_occurrence(
    payment_id: int,
    user_id: int,
    occurrence_data: PaymentOccurrenceCreate,
    db: Session = Depends(get_db)
):
    """Create a payment occurrence"""
    occurrence = PaymentService.create_payment_occurrence(
        db, payment_id, user_id, occurrence_data
    )
    if not occurrence:
        raise HTTPException(status_code=404, detail="Payment not found")
    return occurrence


@router.put("/occurrences/{occurrence_id}", response_model=PaymentOccurrenceResponse)
def update_payment_occurrence(
    occurrence_id: int,
    user_id: int,
    occurrence_data: PaymentOccurrenceUpdate,
    db: Session = Depends(get_db)
):
    """Update a payment occurrence"""
    occurrence = PaymentService.update_payment_occurrence(
        db, occurrence_id, user_id, occurrence_data
    )
    if not occurrence:
        raise HTTPException(status_code=404, detail="Payment occurrence not found")
    return occurrence


@router.delete("/occurrences/{occurrence_id}", status_code=204)
def delete_payment_occurrence(occurrence_id: int, user_id: int, db: Session = Depends(get_db)):
    """Delete a payment occurrence"""
    success = PaymentService.delete_payment_occurrence(db, occurrence_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Payment occurrence not found")
    return None


# Recurring Payment Overrides

@router.get("/{payment_id}/overrides", response_model=List[RecurringPaymentOverrideResponse])
def get_recurring_overrides(payment_id: int, user_id: int, db: Session = Depends(get_db)):
    """Get all overrides for a recurring payment"""
    overrides = PaymentService.get_recurring_overrides(db, payment_id, user_id)
    return overrides


@router.post("/{payment_id}/overrides", response_model=RecurringPaymentOverrideResponse, status_code=201)
def create_recurring_override(
    payment_id: int,
    user_id: int,
    override_data: RecurringPaymentOverrideCreate,
    db: Session = Depends(get_db)
):
    """Create a recurring payment override"""
    override = PaymentService.create_recurring_override(
        db, payment_id, user_id, override_data
    )
    if not override:
        raise HTTPException(
            status_code=404,
            detail="Payment not found or is not a recurring payment"
        )
    return override


@router.put("/overrides/{override_id}", response_model=RecurringPaymentOverrideResponse)
def update_recurring_override(
    override_id: int,
    user_id: int,
    override_data: RecurringPaymentOverrideUpdate,
    db: Session = Depends(get_db)
):
    """Update a recurring payment override"""
    override = PaymentService.update_recurring_override(
        db, override_id, user_id, override_data
    )
    if not override:
        raise HTTPException(status_code=404, detail="Recurring payment override not found")
    return override


@router.delete("/overrides/{override_id}", status_code=204)
def delete_recurring_override(override_id: int, user_id: int, db: Session = Depends(get_db)):
    """Delete a recurring payment override"""
    success = PaymentService.delete_recurring_override(db, override_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Recurring payment override not found")
    return None


# Special endpoints

@router.post("/{payment_id}/generate-occurrences", response_model=List[PaymentOccurrenceResponse])
def generate_recurring_occurrences(
    payment_id: int,
    user_id: int,
    up_to_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """Generate future occurrences for a recurring payment"""
    occurrences = PaymentService.generate_recurring_occurrences(
        db, payment_id, user_id, up_to_date=up_to_date
    )
    return occurrences
