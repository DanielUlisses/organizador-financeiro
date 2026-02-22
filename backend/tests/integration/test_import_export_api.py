"""Integration tests for import/export backup API."""
import uuid
from datetime import date
from decimal import Decimal

import pytest

from app.models.bank_account import AccountType, BankAccount
from app.models.credit_card import CreditCard
from app.models.payment import (
    Payment,
    PaymentFrequency,
    PaymentOccurrence,
    PaymentStatus,
    PaymentType,
    RecurringPaymentOverride,
)
from app.models.transaction_metadata import TransactionCategory, TransactionTag, TransactionType
from app.models.user import User


@pytest.mark.integration
class TestImportExportAPI:
    @pytest.fixture
    def user(self, db_session):
        user = User(email=f"test_{uuid.uuid4().hex[:8]}@example.com", name="Test User")
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    def _seed_user_data(self, db_session, user_id: int):
        bank_account = BankAccount(
            user_id=user_id,
            name="Main Account",
            account_type=AccountType.CHECKING,
            balance=Decimal("1000.00"),
            currency="USD",
        )
        db_session.add(bank_account)
        db_session.flush()

        credit_card = CreditCard(
            user_id=user_id,
            name="Main Card",
            credit_limit=Decimal("3000.00"),
            current_balance=Decimal("250.00"),
            default_payment_account_id=bank_account.id,
            invoice_close_day=20,
            payment_due_day=10,
            currency="USD",
        )
        db_session.add(credit_card)

        category = TransactionCategory(
            user_id=user_id,
            transaction_type=TransactionType.EXPENSE,
            name="Food",
            color="#5B8DEF",
            icon="wallet",
        )
        tag = TransactionTag(user_id=user_id, name="Essential", color="#8B5CF6")
        db_session.add_all([category, tag])
        db_session.flush()

        payment = Payment(
            user_id=user_id,
            payment_type=PaymentType.RECURRING,
            description="Monthly groceries",
            amount=Decimal("120.00"),
            currency="USD",
            category_id=category.id,
            status=PaymentStatus.PENDING,
            frequency=PaymentFrequency.MONTHLY,
            start_date=date(2026, 1, 1),
        )
        payment.tags = [tag]
        db_session.add(payment)
        db_session.flush()

        occurrence = PaymentOccurrence(
            payment_id=payment.id,
            scheduled_date=date(2026, 2, 1),
            due_date=date(2026, 2, 5),
            amount=Decimal("120.00"),
            status=PaymentStatus.SCHEDULED,
        )
        override = RecurringPaymentOverride(
            payment_id=payment.id,
            override_type="change_amount",
            effective_date=date(2026, 3, 1),
            new_amount=Decimal("140.00"),
            is_active=True,
        )
        db_session.add_all([occurrence, override])
        db_session.commit()

    def test_export_backup_returns_expected_data(self, client, user, db_session):
        self._seed_user_data(db_session, user.id)

        response = client.get(f"/import-export/export?user_id={user.id}")
        assert response.status_code == 200

        payload = response.json()
        assert payload["version"] == "1.0"
        assert payload["data"]["bank_accounts"]
        assert payload["data"]["credit_cards"]
        assert payload["data"]["categories"]
        assert payload["data"]["payments"]
        assert payload["data"]["payment_occurrences"]
        assert payload["data"]["recurring_payment_overrides"]
        assert payload["data"]["payment_tags"]

    def test_import_backup_overwrites_existing_user_data(self, client, user, db_session):
        self._seed_user_data(db_session, user.id)

        export_response = client.get(f"/import-export/export?user_id={user.id}")
        assert export_response.status_code == 200
        backup_payload = export_response.json()

        db_session.add(
            BankAccount(
                user_id=user.id,
                name="Temporary Account",
                account_type=AccountType.SAVINGS,
                balance=Decimal("55.00"),
            )
        )
        db_session.commit()

        pre_import_export = client.get(f"/import-export/export?user_id={user.id}")
        assert pre_import_export.status_code == 200
        assert len(pre_import_export.json()["data"]["bank_accounts"]) == 2

        import_response = client.post(f"/import-export/import?user_id={user.id}", json=backup_payload)
        assert import_response.status_code == 200

        after_import_export = client.get(f"/import-export/export?user_id={user.id}")
        assert after_import_export.status_code == 200
        restored = after_import_export.json()["data"]
        assert len(restored["bank_accounts"]) == 1
        assert restored["bank_accounts"][0]["name"] == "Main Account"
        assert len(restored["credit_cards"]) == 1
        assert len(restored["categories"]) == 1
        assert len(restored["payments"]) == 1
        assert len(restored["payment_occurrences"]) == 1
        assert len(restored["recurring_payment_overrides"]) == 1
