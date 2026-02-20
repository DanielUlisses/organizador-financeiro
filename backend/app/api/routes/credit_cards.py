"""Credit card routes"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from decimal import Decimal
from datetime import date
from app.db import get_db
from app.schemas.credit_card import (
    CreditCardCreate,
    CreditCardUpdate,
    CreditCardResponse,
    CreditCardInvoiceCycleResponse,
    CreditCardStatementResponse,
    CreditCardInvoiceHistoryResponse,
)
from app.services.credit_card_service import CreditCardService

router = APIRouter(prefix="/credit-cards", tags=["credit-cards"])


@router.get("/", response_model=List[CreditCardResponse])
def get_credit_cards(user_id: int, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get all credit cards for a user"""
    cards = CreditCardService.get_cards_by_user(db, user_id, skip=skip, limit=limit)
    return cards


@router.get("/{card_id}", response_model=CreditCardResponse)
def get_credit_card(card_id: int, user_id: int, db: Session = Depends(get_db)):
    """Get credit card by ID"""
    card = CreditCardService.get_card(db, card_id, user_id)
    if not card:
        raise HTTPException(status_code=404, detail="Credit card not found")
    return card


@router.post("/", response_model=CreditCardResponse, status_code=201)
def create_credit_card(user_id: int, card_data: CreditCardCreate, db: Session = Depends(get_db)):
    """Create a new credit card"""
    return CreditCardService.create_card(db, user_id, card_data)


@router.put("/{card_id}", response_model=CreditCardResponse)
def update_credit_card(
    card_id: int, user_id: int, card_data: CreditCardUpdate, db: Session = Depends(get_db)
):
    """Update credit card"""
    card = CreditCardService.update_card(db, card_id, user_id, card_data)
    if not card:
        raise HTTPException(status_code=404, detail="Credit card not found")
    return card


@router.patch("/{card_id}/balance", response_model=CreditCardResponse)
def update_balance(card_id: int, user_id: int, balance: Decimal, db: Session = Depends(get_db)):
    """Update card balance"""
    card = CreditCardService.update_balance(db, card_id, user_id, balance)
    if not card:
        raise HTTPException(status_code=404, detail="Credit card not found")
    return card


@router.get("/{user_id}/total-balance")
def get_total_balance(user_id: int, db: Session = Depends(get_db)):
    """Get total balance across all active cards"""
    total = CreditCardService.get_total_balance(db, user_id)
    return {"user_id": user_id, "total_balance": float(total)}


@router.get("/{user_id}/total-credit-limit")
def get_total_credit_limit(user_id: int, db: Session = Depends(get_db)):
    """Get total credit limit across all active cards"""
    total = CreditCardService.get_total_credit_limit(db, user_id)
    return {"user_id": user_id, "total_credit_limit": float(total)}


@router.delete("/{card_id}", status_code=204)
def delete_credit_card(card_id: int, user_id: int, db: Session = Depends(get_db)):
    """Delete credit card"""
    success = CreditCardService.delete_card(db, card_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Credit card not found")
    return None


@router.get("/{card_id}/invoice-cycle", response_model=CreditCardInvoiceCycleResponse)
def get_invoice_cycle(
    card_id: int, user_id: int, reference_date: date = date.today(), db: Session = Depends(get_db)
):
    """Get invoice cycle dates and due date for a card."""
    cycle = CreditCardService.get_invoice_cycle(db, card_id, user_id, reference_date)
    if not cycle:
        raise HTTPException(status_code=404, detail="Credit card not found")
    return {
        "card_id": card_id,
        "reference_date": reference_date,
        **cycle,
    }


@router.get("/{card_id}/statement-summary", response_model=CreditCardStatementResponse)
def get_statement_summary(
    card_id: int, user_id: int, reference_date: date = date.today(), db: Session = Depends(get_db)
):
    """Get statement summary for the invoice cycle containing reference_date."""
    summary = CreditCardService.get_statement_summary(db, card_id, user_id, reference_date)
    if not summary:
        raise HTTPException(status_code=404, detail="Credit card not found")
    return summary


@router.get("/{card_id}/invoice-history", response_model=CreditCardInvoiceHistoryResponse)
def get_invoice_history(
    card_id: int,
    user_id: int,
    months: int = 12,
    db: Session = Depends(get_db),
):
    """Get invoice totals for the last N billing cycles (for charts)."""
    entries = CreditCardService.get_invoice_history(db, card_id, user_id, months=months)
    if entries is None:
        raise HTTPException(status_code=404, detail="Credit card not found")
    return {
        "card_id": card_id,
        "months": months,
        "entries": entries,
    }


@router.post("/{card_id}/sync-planned-payments", status_code=204)
def sync_planned_payments(card_id: int, user_id: int, db: Session = Depends(get_db)):
    """Sync future planned card-payment transactions for account planning."""
    success = CreditCardService.sync_planned_payments(db, card_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Credit card not found")
    return None
