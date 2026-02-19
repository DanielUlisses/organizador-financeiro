"""Investment account routes"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db import get_db
from app.schemas.investment_account import (
    InvestmentAccountCreate,
    InvestmentAccountUpdate,
    InvestmentAccountResponse,
    InvestmentHoldingCreate,
    InvestmentHoldingUpdate,
    InvestmentHoldingResponse,
    InvestmentHistoryCreate,
    InvestmentHistoryResponse,
)
from app.services.investment_account_service import (
    InvestmentAccountService,
    InvestmentHoldingService,
    InvestmentHistoryService,
)

router = APIRouter(prefix="/investment-accounts", tags=["investment-accounts"])


# Investment Account Routes
@router.get("/", response_model=List[InvestmentAccountResponse])
def get_investment_accounts(user_id: int, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get all investment accounts for a user"""
    accounts = InvestmentAccountService.get_accounts_by_user(db, user_id, skip=skip, limit=limit)
    return accounts


@router.get("/{account_id}", response_model=InvestmentAccountResponse)
def get_investment_account(account_id: int, user_id: int, db: Session = Depends(get_db)):
    """Get investment account by ID"""
    account = InvestmentAccountService.get_account(db, account_id, user_id)
    if not account:
        raise HTTPException(status_code=404, detail="Investment account not found")
    return account


@router.post("/", response_model=InvestmentAccountResponse, status_code=201)
def create_investment_account(user_id: int, account_data: InvestmentAccountCreate, db: Session = Depends(get_db)):
    """Create a new investment account"""
    return InvestmentAccountService.create_account(db, user_id, account_data)


@router.put("/{account_id}", response_model=InvestmentAccountResponse)
def update_investment_account(
    account_id: int, user_id: int, account_data: InvestmentAccountUpdate, db: Session = Depends(get_db)
):
    """Update investment account"""
    account = InvestmentAccountService.update_account(db, account_id, user_id, account_data)
    if not account:
        raise HTTPException(status_code=404, detail="Investment account not found")
    return account


@router.get("/{user_id}/total-value")
def get_total_value(user_id: int, db: Session = Depends(get_db)):
    """Get total value across all active accounts"""
    total = InvestmentAccountService.get_total_value(db, user_id)
    return {"user_id": user_id, "total_value": float(total)}


@router.delete("/{account_id}", status_code=204)
def delete_investment_account(account_id: int, user_id: int, db: Session = Depends(get_db)):
    """Delete investment account"""
    success = InvestmentAccountService.delete_account(db, account_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Investment account not found")
    return None


# Investment Holding Routes
@router.get("/{account_id}/holdings", response_model=List[InvestmentHoldingResponse])
def get_holdings(account_id: int, db: Session = Depends(get_db)):
    """Get all holdings for an account"""
    holdings = InvestmentHoldingService.get_holdings_by_account(db, account_id)
    return holdings


@router.post("/{account_id}/holdings", response_model=InvestmentHoldingResponse, status_code=201)
def create_holding(account_id: int, holding_data: InvestmentHoldingCreate, db: Session = Depends(get_db)):
    """Create a new holding"""
    return InvestmentHoldingService.create_holding(db, account_id, holding_data)


@router.put("/{account_id}/holdings/{holding_id}", response_model=InvestmentHoldingResponse)
def update_holding(
    account_id: int, holding_id: int, holding_data: InvestmentHoldingUpdate, db: Session = Depends(get_db)
):
    """Update holding"""
    holding = InvestmentHoldingService.update_holding(db, holding_id, account_id, holding_data)
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    return holding


@router.delete("/{account_id}/holdings/{holding_id}", status_code=204)
def delete_holding(account_id: int, holding_id: int, db: Session = Depends(get_db)):
    """Delete holding"""
    success = InvestmentHoldingService.delete_holding(db, holding_id, account_id)
    if not success:
        raise HTTPException(status_code=404, detail="Holding not found")
    return None


# Investment History Routes
@router.get("/{account_id}/history", response_model=List[InvestmentHistoryResponse])
def get_history(account_id: int, limit: int = 100, db: Session = Depends(get_db)):
    """Get history for an account"""
    history = InvestmentHistoryService.get_history_by_account(db, account_id, limit=limit)
    return history


@router.post("/{account_id}/history", response_model=InvestmentHistoryResponse, status_code=201)
def create_history(account_id: int, history_data: InvestmentHistoryCreate, db: Session = Depends(get_db)):
    """Create a new history entry"""
    return InvestmentHistoryService.create_history(db, account_id, history_data)
