"""Integration tests for reports API."""
import uuid
from datetime import date
from decimal import Decimal

import pytest

from app.models.payment import Payment, PaymentCategory, PaymentOccurrence, PaymentStatus, PaymentType
from app.models.user import User


@pytest.mark.integration
class TestReportsAPI:
    """Test reports endpoints."""

    @pytest.fixture
    def user(self, db_session):
        user = User(email=f"test_{uuid.uuid4().hex[:8]}@example.com", name="Reports User")
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    def test_expense_breakdown_by_category(self, client, user, db_session):
        rent = Payment(
            user_id=user.id,
            payment_type=PaymentType.ONE_TIME,
            description="Rent",
            amount=Decimal("1000.00"),
            category=PaymentCategory.EXPENSE,
            due_date=date(2026, 2, 5),
            status=PaymentStatus.PROCESSED,
        )
        salary = Payment(
            user_id=user.id,
            payment_type=PaymentType.ONE_TIME,
            description="Salary",
            amount=Decimal("3000.00"),
            category=PaymentCategory.INCOME,
            due_date=date(2026, 2, 10),
            status=PaymentStatus.PROCESSED,
        )
        db_session.add_all([rent, salary])
        db_session.commit()

        response = client.get(
            f"/reports/expense-breakdown?user_id={user.id}&start_date=2026-02-01&end_date=2026-02-28&breakdown_by=category"
        )
        assert response.status_code == 200
        data = response.json()
        assert float(data["total_expenses"]) == 1000.00
        assert len(data["items"]) == 1
        assert data["items"][0]["label"] == "expense"
        assert float(data["items"][0]["total"]) == 1000.00

    def test_income_vs_expenses(self, client, user, db_session):
        income = Payment(
            user_id=user.id,
            payment_type=PaymentType.ONE_TIME,
            description="Freelance",
            amount=Decimal("1500.00"),
            category=PaymentCategory.INCOME,
            due_date=date(2026, 2, 6),
            status=PaymentStatus.PROCESSED,
        )
        expense = Payment(
            user_id=user.id,
            payment_type=PaymentType.ONE_TIME,
            description="Groceries",
            amount=Decimal("250.00"),
            category=PaymentCategory.EXPENSE,
            due_date=date(2026, 2, 8),
            status=PaymentStatus.PROCESSED,
        )
        db_session.add_all([income, expense])
        db_session.commit()

        response = client.get(
            f"/reports/income-vs-expenses?user_id={user.id}&start_date=2026-02-01&end_date=2026-02-28&granularity=month"
        )
        assert response.status_code == 200
        data = response.json()
        assert float(data["total_income"]) == 1500.00
        assert float(data["total_expenses"]) == 250.00
        assert float(data["net"]) == 1250.00
        assert len(data["series"]) == 1
        assert data["series"][0]["period"] == "2026-02"

    def test_reports_include_occurrences(self, client, user, db_session):
        recurring = Payment(
            user_id=user.id,
            payment_type=PaymentType.RECURRING,
            description="Streaming",
            amount=Decimal("30.00"),
            category=PaymentCategory.SUBSCRIPTION,
            status=PaymentStatus.PROCESSED,
        )
        db_session.add(recurring)
        db_session.flush()
        db_session.add(
            PaymentOccurrence(
                payment_id=recurring.id,
                scheduled_date=date(2026, 2, 15),
                due_date=date(2026, 2, 15),
                amount=Decimal("30.00"),
                status=PaymentStatus.PROCESSED,
            )
        )
        db_session.commit()

        response = client.get(
            f"/reports/expense-breakdown?user_id={user.id}&start_date=2026-02-01&end_date=2026-02-28&breakdown_by=category"
        )
        assert response.status_code == 200
        data = response.json()
        assert float(data["total_expenses"]) == 30.00
        assert data["items"][0]["label"] == "subscription"
