"""Reporting schemas for analytics endpoints."""
from datetime import date
from decimal import Decimal
from typing import List

from pydantic import BaseModel


class ExpenseBreakdownItem(BaseModel):
    label: str
    total: Decimal


class ExpenseBreakdownResponse(BaseModel):
    user_id: int
    start_date: date
    end_date: date
    breakdown_by: str
    items: List[ExpenseBreakdownItem]
    total_expenses: Decimal


class IncomeExpensePoint(BaseModel):
    period: str
    income: Decimal
    expenses: Decimal
    net: Decimal


class IncomeVsExpensesResponse(BaseModel):
    user_id: int
    start_date: date
    end_date: date
    total_income: Decimal
    total_expenses: Decimal
    net: Decimal
    series: List[IncomeExpensePoint]
