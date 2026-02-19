"""Integration tests for payments API"""
import pytest
import uuid
from decimal import Decimal
from datetime import date, timedelta
from app.models.user import User
from app.models.payment import Payment, PaymentType, PaymentFrequency, PaymentStatus


@pytest.mark.integration
class TestPaymentsAPI:
    """Test payments API endpoints"""

    @pytest.fixture
    def user(self, db_session):
        """Create a test user"""
        user = User(email=f"test_{uuid.uuid4().hex[:8]}@example.com", name="Test User")
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    def test_create_one_time_payment(self, client, user, db_session):
        """Test creating a one-time payment"""
        response = client.post(
            f"/payments/one-time?user_id={user.id}",
            json={
                "description": "Test Payment",
                "amount": "100.00",
                "due_date": str(date.today())
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["description"] == "Test Payment"
        assert float(data["amount"]) == 100.00
        assert data["payment_type"] == "one_time"
        assert data["user_id"] == user.id
        assert data["status"] == "pending"

    def test_create_recurring_payment(self, client, user, db_session):
        """Test creating a recurring payment"""
        response = client.post(
            f"/payments/recurring?user_id={user.id}",
            json={
                "description": "Monthly Subscription",
                "amount": "29.99",
                "frequency": "monthly",
                "start_date": str(date.today())
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["description"] == "Monthly Subscription"
        assert float(data["amount"]) == 29.99
        assert data["payment_type"] == "recurring"
        assert data["frequency"] == "monthly"
        assert data["user_id"] == user.id

    def test_get_payment(self, client, user, db_session):
        """Test getting a payment"""
        payment = Payment(
            user_id=user.id,
            payment_type=PaymentType.ONE_TIME,
            description="Test Payment",
            amount=Decimal("100.00"),
            status=PaymentStatus.PENDING
        )
        db_session.add(payment)
        db_session.commit()
        db_session.refresh(payment)

        response = client.get(f"/payments/{payment.id}?user_id={user.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == payment.id
        assert data["description"] == "Test Payment"

    def test_get_all_payments(self, client, user, db_session):
        """Test getting all payments for a user"""
        payment1 = Payment(
            user_id=user.id,
            payment_type=PaymentType.ONE_TIME,
            description="Payment 1",
            amount=Decimal("100.00"),
            status=PaymentStatus.PENDING
        )
        payment2 = Payment(
            user_id=user.id,
            payment_type=PaymentType.RECURRING,
            description="Payment 2",
            amount=Decimal("50.00"),
            frequency=PaymentFrequency.MONTHLY,
            start_date=date.today(),
            status=PaymentStatus.PENDING
        )
        db_session.add_all([payment1, payment2])
        db_session.commit()

        response = client.get(f"/payments/?user_id={user.id}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_get_payments_filtered_by_type(self, client, user, db_session):
        """Test getting payments filtered by type"""
        payment1 = Payment(
            user_id=user.id,
            payment_type=PaymentType.ONE_TIME,
            description="One-time",
            amount=Decimal("100.00"),
            status=PaymentStatus.PENDING
        )
        payment2 = Payment(
            user_id=user.id,
            payment_type=PaymentType.RECURRING,
            description="Recurring",
            amount=Decimal("50.00"),
            frequency=PaymentFrequency.MONTHLY,
            start_date=date.today(),
            status=PaymentStatus.PENDING
        )
        db_session.add_all([payment1, payment2])
        db_session.commit()

        response = client.get(f"/payments/?user_id={user.id}&payment_type=one_time")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["payment_type"] == "one_time"

    def test_update_payment(self, client, user, db_session):
        """Test updating a payment"""
        payment = Payment(
            user_id=user.id,
            payment_type=PaymentType.ONE_TIME,
            description="Old Description",
            amount=Decimal("50.00"),
            status=PaymentStatus.PENDING
        )
        db_session.add(payment)
        db_session.commit()
        db_session.refresh(payment)

        response = client.put(
            f"/payments/{payment.id}?user_id={user.id}",
            json={
                "description": "New Description",
                "amount": "75.00"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["description"] == "New Description"
        assert float(data["amount"]) == 75.00

    def test_delete_payment(self, client, user, db_session):
        """Test deleting a payment"""
        payment = Payment(
            user_id=user.id,
            payment_type=PaymentType.ONE_TIME,
            description="Test",
            amount=Decimal("50.00"),
            status=PaymentStatus.PENDING
        )
        db_session.add(payment)
        db_session.commit()
        payment_id = payment.id

        response = client.delete(f"/payments/{payment_id}?user_id={user.id}")
        assert response.status_code == 204

        # Verify deletion
        get_response = client.get(f"/payments/{payment_id}?user_id={user.id}")
        assert get_response.status_code == 404

    def test_get_payment_occurrences(self, client, user, db_session):
        """Test getting payment occurrences"""
        payment = Payment(
            user_id=user.id,
            payment_type=PaymentType.RECURRING,
            description="Test",
            amount=Decimal("100.00"),
            frequency=PaymentFrequency.MONTHLY,
            start_date=date.today(),
            status=PaymentStatus.PENDING
        )
        db_session.add(payment)
        db_session.commit()
        db_session.refresh(payment)

        # Create an occurrence manually for testing
        from app.models.payment import PaymentOccurrence
        occurrence = PaymentOccurrence(
            payment_id=payment.id,
            scheduled_date=date.today(),
            due_date=date.today(),
            amount=Decimal("100.00"),
            status=PaymentStatus.SCHEDULED
        )
        db_session.add(occurrence)
        db_session.commit()

        response = client.get(f"/payments/{payment.id}/occurrences?user_id={user.id}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert float(data[0]["amount"]) == 100.00

    def test_create_payment_occurrence(self, client, user, db_session):
        """Test creating a payment occurrence"""
        payment = Payment(
            user_id=user.id,
            payment_type=PaymentType.RECURRING,
            description="Test",
            amount=Decimal("100.00"),
            frequency=PaymentFrequency.MONTHLY,
            start_date=date.today(),
            status=PaymentStatus.PENDING
        )
        db_session.add(payment)
        db_session.commit()
        db_session.refresh(payment)

        response = client.post(
            f"/payments/{payment.id}/occurrences?user_id={user.id}",
            json={
                "scheduled_date": str(date.today() + timedelta(days=30)),
                "due_date": str(date.today() + timedelta(days=30)),
                "amount": "100.00"
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert float(data["amount"]) == 100.00
        assert data["payment_id"] == payment.id

    def test_create_recurring_override(self, client, user, db_session):
        """Test creating a recurring payment override"""
        payment = Payment(
            user_id=user.id,
            payment_type=PaymentType.RECURRING,
            description="Test",
            amount=Decimal("100.00"),
            frequency=PaymentFrequency.MONTHLY,
            start_date=date.today(),
            status=PaymentStatus.PENDING
        )
        db_session.add(payment)
        db_session.commit()
        db_session.refresh(payment)

        response = client.post(
            f"/payments/{payment.id}/overrides?user_id={user.id}",
            json={
                "override_type": "skip",
                "effective_date": str(date.today()),
                "target_date": str(date.today() + timedelta(days=30))
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["override_type"] == "skip"
        assert data["payment_id"] == payment.id

    def test_get_recurring_overrides(self, client, user, db_session):
        """Test getting recurring payment overrides"""
        payment = Payment(
            user_id=user.id,
            payment_type=PaymentType.RECURRING,
            description="Test",
            amount=Decimal("100.00"),
            frequency=PaymentFrequency.MONTHLY,
            start_date=date.today(),
            status=PaymentStatus.PENDING
        )
        db_session.add(payment)
        db_session.commit()
        db_session.refresh(payment)

        # Create override manually
        from app.models.payment import RecurringPaymentOverride
        override = RecurringPaymentOverride(
            payment_id=payment.id,
            override_type="skip",
            effective_date=date.today(),
            target_date=date.today() + timedelta(days=30)
        )
        db_session.add(override)
        db_session.commit()

        response = client.get(f"/payments/{payment.id}/overrides?user_id={user.id}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["override_type"] == "skip"
