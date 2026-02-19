"""Credit card routes"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from decimal import Decimal
from app.db import get_db
from app.schemas.credit_card import CreditCardCreate, CreditCardUpdate, CreditCardResponse
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
