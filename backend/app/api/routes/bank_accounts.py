"""Bank account routes"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from decimal import Decimal
from app.db import get_db
from app.schemas.bank_account import BankAccountCreate, BankAccountUpdate, BankAccountResponse
from app.services.bank_account_service import BankAccountService

router = APIRouter(prefix="/bank-accounts", tags=["bank-accounts"])


@router.get("/", response_model=List[BankAccountResponse])
def get_bank_accounts(user_id: int, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get all bank accounts for a user"""
    accounts = BankAccountService.get_accounts_by_user(db, user_id, skip=skip, limit=limit)
    return accounts


@router.get("/{account_id}", response_model=BankAccountResponse)
def get_bank_account(account_id: int, user_id: int, db: Session = Depends(get_db)):
    """Get bank account by ID"""
    account = BankAccountService.get_account(db, account_id, user_id)
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    return account


@router.post("/", response_model=BankAccountResponse, status_code=201)
def create_bank_account(user_id: int, account_data: BankAccountCreate, db: Session = Depends(get_db)):
    """Create a new bank account"""
    return BankAccountService.create_account(db, user_id, account_data)


@router.put("/{account_id}", response_model=BankAccountResponse)
def update_bank_account(
    account_id: int, user_id: int, account_data: BankAccountUpdate, db: Session = Depends(get_db)
):
    """Update bank account"""
    account = BankAccountService.update_account(db, account_id, user_id, account_data)
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    return account


@router.patch("/{account_id}/balance", response_model=BankAccountResponse)
def update_balance(account_id: int, user_id: int, balance: Decimal, db: Session = Depends(get_db)):
    """Update account balance"""
    account = BankAccountService.update_balance(db, account_id, user_id, balance)
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    return account


@router.get("/{user_id}/total-balance")
def get_total_balance(user_id: int, db: Session = Depends(get_db)):
    """Get total balance across all active accounts"""
    total = BankAccountService.get_total_balance(db, user_id)
    return {"user_id": user_id, "total_balance": float(total)}


@router.delete("/{account_id}", status_code=204)
def delete_bank_account(account_id: int, user_id: int, db: Session = Depends(get_db)):
    """Delete bank account"""
    success = BankAccountService.delete_account(db, account_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Bank account not found")
    return None
