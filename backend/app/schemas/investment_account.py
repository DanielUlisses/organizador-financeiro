"""Investment account schemas"""
import re
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from decimal import Decimal
from pydantic import model_validator
from app.models.investment_account import InvestmentAccountType, InvestmentAssetType


class InvestmentHoldingBase(BaseModel):
    symbol: str
    name: Optional[str] = None
    asset_type: InvestmentAssetType = InvestmentAssetType.OTHER
    fund_cnpj: Optional[str] = None
    quantity: Decimal
    average_cost: Decimal
    current_price: Optional[Decimal] = None
    currency: str = "USD"

    @model_validator(mode="after")
    def validate_fund_cnpj(self):
        if self.asset_type != InvestmentAssetType.FUND:
            return self
        if not self.fund_cnpj:
            raise ValueError("fund_cnpj is required when asset_type is fund")
        normalized = re.sub(r"\D", "", self.fund_cnpj)
        if len(normalized) != 14:
            raise ValueError("fund_cnpj must have 14 digits")
        return self


class InvestmentHoldingCreate(InvestmentHoldingBase):
    current_value: Decimal


class InvestmentHoldingUpdate(BaseModel):
    symbol: Optional[str] = None
    name: Optional[str] = None
    asset_type: Optional[InvestmentAssetType] = None
    fund_cnpj: Optional[str] = None
    quantity: Optional[Decimal] = None
    average_cost: Optional[Decimal] = None
    current_price: Optional[Decimal] = None
    current_value: Optional[Decimal] = None
    currency: Optional[str] = None


class InvestmentHoldingResponse(InvestmentHoldingBase):
    id: int
    account_id: int
    current_value: Decimal
    created_at: datetime
    updated_at: datetime
    unrealized_gain_loss: Optional[Decimal] = None
    unrealized_gain_loss_percentage: Optional[Decimal] = None

    class Config:
        from_attributes = True


class InvestmentHistoryBase(BaseModel):
    snapshot_date: datetime
    total_value: Decimal
    total_cost_basis: Decimal
    total_gain_loss: Decimal
    total_gain_loss_percentage: Decimal
    notes: Optional[str] = None


class InvestmentHistoryCreate(InvestmentHistoryBase):
    pass


class InvestmentHistoryResponse(InvestmentHistoryBase):
    id: int
    account_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class InvestmentAccountBase(BaseModel):
    name: str
    account_type: InvestmentAccountType
    broker_name: Optional[str] = None
    account_number_last4: Optional[str] = None
    currency: str = "USD"


class InvestmentAccountCreate(InvestmentAccountBase):
    current_value: Decimal = Decimal("0.00")


class InvestmentAccountUpdate(BaseModel):
    name: Optional[str] = None
    account_type: Optional[InvestmentAccountType] = None
    broker_name: Optional[str] = None
    account_number_last4: Optional[str] = None
    current_value: Optional[Decimal] = None
    currency: Optional[str] = None
    is_active: Optional[bool] = None


class InvestmentAccountResponse(InvestmentAccountBase):
    id: int
    user_id: int
    current_value: Decimal
    is_active: bool
    created_at: datetime
    updated_at: datetime
    holdings: List[InvestmentHoldingResponse] = []
    history: List[InvestmentHistoryResponse] = []

    class Config:
        from_attributes = True
