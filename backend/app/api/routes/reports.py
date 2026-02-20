"""Reporting routes."""
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.report import CurrencyMetricsResponse, ExpenseBreakdownResponse, IncomeVsExpensesResponse
from app.services.reports_service import ReportsService

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/expense-breakdown", response_model=ExpenseBreakdownResponse)
def get_expense_breakdown(
    user_id: int,
    start_date: date,
    end_date: date,
    breakdown_by: str = Query(default="category", pattern="^(category|month)$"),
    db: Session = Depends(get_db),
):
    """Get expense breakdown by category or by month."""
    return ReportsService.get_expense_breakdown(
        db=db,
        user_id=user_id,
        start_date=start_date,
        end_date=end_date,
        breakdown_by=breakdown_by,
    )


@router.get("/income-vs-expenses", response_model=IncomeVsExpensesResponse)
def get_income_vs_expenses(
    user_id: int,
    start_date: date,
    end_date: date,
    granularity: str = Query(default="month", pattern="^(month|day)$"),
    db: Session = Depends(get_db),
):
    """Get income vs expenses totals and timeseries."""
    return ReportsService.get_income_vs_expenses(
        db=db,
        user_id=user_id,
        start_date=start_date,
        end_date=end_date,
        granularity=granularity,
    )


@router.get("/currency-metrics", response_model=CurrencyMetricsResponse)
def get_currency_metrics(
    user_id: int,
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db),
):
    """Get income/expense totals grouped by currency."""
    return ReportsService.get_currency_metrics(
        db=db,
        user_id=user_id,
        start_date=start_date,
        end_date=end_date,
    )
