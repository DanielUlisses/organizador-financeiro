"""Reporting service for analytics endpoints."""
from collections import defaultdict
from datetime import date
from decimal import Decimal
from typing import Dict, List, Optional

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models.payment import Payment, PaymentOccurrence, PaymentStatus


class ReportsService:
    """Service with report/analytics aggregations."""

    @staticmethod
    def get_expense_breakdown(
        db: Session,
        user_id: int,
        start_date: date,
        end_date: date,
        breakdown_by: str = "category",
    ) -> Dict:
        entries = ReportsService._collect_entries(db, user_id, start_date, end_date)

        grouped: Dict[str, Decimal] = defaultdict(lambda: Decimal("0.00"))
        total_expenses = Decimal("0.00")

        for entry in entries:
            if entry["is_income"]:
                continue
            label = entry["category"] if breakdown_by == "category" else entry["txn_date"].strftime("%Y-%m")
            grouped[label] += entry["amount"]
            total_expenses += entry["amount"]

        items = [{"label": label, "total": total} for label, total in sorted(grouped.items(), key=lambda x: x[0])]

        return {
            "user_id": user_id,
            "start_date": start_date,
            "end_date": end_date,
            "breakdown_by": breakdown_by,
            "items": items,
            "total_expenses": total_expenses,
        }

    @staticmethod
    def get_income_vs_expenses(
        db: Session,
        user_id: int,
        start_date: date,
        end_date: date,
        granularity: str = "month",
    ) -> Dict:
        entries = ReportsService._collect_entries(db, user_id, start_date, end_date)

        series_map: Dict[str, Dict[str, Decimal]] = defaultdict(
            lambda: {"income": Decimal("0.00"), "expenses": Decimal("0.00")}
        )
        total_income = Decimal("0.00")
        total_expenses = Decimal("0.00")

        for entry in entries:
            if granularity == "day":
                period = entry["txn_date"].isoformat()
            else:
                period = entry["txn_date"].strftime("%Y-%m")

            if entry["is_income"]:
                series_map[period]["income"] += entry["amount"]
                total_income += entry["amount"]
            else:
                series_map[period]["expenses"] += entry["amount"]
                total_expenses += entry["amount"]

        series = []
        for period in sorted(series_map.keys()):
            income = series_map[period]["income"]
            expenses = series_map[period]["expenses"]
            series.append(
                {
                    "period": period,
                    "income": income,
                    "expenses": expenses,
                    "net": income - expenses,
                }
            )

        return {
            "user_id": user_id,
            "start_date": start_date,
            "end_date": end_date,
            "total_income": total_income,
            "total_expenses": total_expenses,
            "net": total_income - total_expenses,
            "series": series,
        }

    @staticmethod
    def _collect_entries(db: Session, user_id: int, start_date: date, end_date: date) -> List[Dict]:
        ignored_statuses = [PaymentStatus.CANCELLED, PaymentStatus.FAILED]

        occurrence_rows = (
            db.query(PaymentOccurrence, Payment)
            .join(Payment, PaymentOccurrence.payment_id == Payment.id)
            .filter(
                Payment.user_id == user_id,
                PaymentOccurrence.scheduled_date >= start_date,
                PaymentOccurrence.scheduled_date <= end_date,
                PaymentOccurrence.status.notin_(ignored_statuses),
            )
            .all()
        )

        entries: List[Dict] = []
        seen_payment_ids = set()

        for occurrence, payment in occurrence_rows:
            category = (
                payment.transaction_category.name
                if payment.transaction_category
                else (payment.category.value if payment.category else "other")
            )
            transaction_type = payment.category.value if payment.category else "expense"
            entries.append(
                {
                    "payment_id": payment.id,
                    "txn_date": occurrence.scheduled_date,
                    "amount": occurrence.amount,
                    "category": category,
                    "is_income": transaction_type == "income",
                }
            )
            seen_payment_ids.add(payment.id)

        one_time_query = db.query(Payment).filter(
            Payment.user_id == user_id,
            Payment.due_date.isnot(None),
            Payment.due_date >= start_date,
            Payment.due_date <= end_date,
            Payment.status.notin_(ignored_statuses),
        )

        if seen_payment_ids:
            one_time_query = one_time_query.filter(Payment.id.notin_(seen_payment_ids))

        one_time_rows = one_time_query.all()
        for payment in one_time_rows:
            category = (
                payment.transaction_category.name
                if payment.transaction_category
                else (payment.category.value if payment.category else "other")
            )
            transaction_type = payment.category.value if payment.category else "expense"
            entries.append(
                {
                    "payment_id": payment.id,
                    "txn_date": payment.due_date,
                    "amount": payment.amount,
                    "category": category,
                    "is_income": transaction_type == "income",
                }
            )

        return entries
