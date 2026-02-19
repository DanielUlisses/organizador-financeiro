"""Integration tests for credit cards API"""
import pytest
import uuid
from decimal import Decimal
from app.models.user import User
from app.models.credit_card import CreditCard


@pytest.mark.integration
class TestCreditCardsAPI:
    """Test credit cards API endpoints"""

    @pytest.fixture
    def user(self, db_session):
        """Create a test user"""
        user = User(email=f"test_{uuid.uuid4().hex[:8]}@example.com", name="Test User")
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    def test_create_credit_card(self, client, user):
        """Test creating a credit card"""
        response = client.post(
            f"/credit-cards/?user_id={user.id}",
            json={
                "name": "Visa Card",
                "credit_limit": "5000.00",
                "current_balance": "1000.00",
                "invoice_close_day": 15,
                "payment_due_day": 20,
                "issuer": "Visa"
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Visa Card"
        assert float(data["credit_limit"]) == 5000.00
        assert float(data["current_balance"]) == 1000.00
        assert data["invoice_close_day"] == 15
        assert data["payment_due_day"] == 20
        assert float(data["available_credit"]) == 4000.00

    def test_get_credit_card(self, client, user, db_session):
        """Test getting a credit card"""
        card = CreditCard(
            user_id=user.id,
            name="Test Card",
            credit_limit=Decimal("5000.00"),
            current_balance=Decimal("1000.00"),
            invoice_close_day=15,
            payment_due_day=20
        )
        db_session.add(card)
        db_session.commit()

        response = client.get(f"/credit-cards/{card.id}?user_id={user.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test Card"
        assert float(data["credit_limit"]) == 5000.00

    def test_get_all_credit_cards(self, client, user, db_session):
        """Test getting all credit cards for a user"""
        card1 = CreditCard(
            user_id=user.id,
            name="Card 1",
            credit_limit=Decimal("5000.00"),
            invoice_close_day=15,
            payment_due_day=20
        )
        card2 = CreditCard(
            user_id=user.id,
            name="Card 2",
            credit_limit=Decimal("3000.00"),
            invoice_close_day=10,
            payment_due_day=15
        )
        db_session.add_all([card1, card2])
        db_session.commit()

        response = client.get(f"/credit-cards/?user_id={user.id}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_update_credit_card(self, client, user, db_session):
        """Test updating a credit card"""
        card = CreditCard(
            user_id=user.id,
            name="Old Name",
            credit_limit=Decimal("5000.00"),
            invoice_close_day=15,
            payment_due_day=20
        )
        db_session.add(card)
        db_session.commit()

        response = client.put(
            f"/credit-cards/{card.id}?user_id={user.id}",
            json={"name": "New Name", "credit_limit": "6000.00"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "New Name"
        assert float(data["credit_limit"]) == 6000.00

    def test_update_balance(self, client, user, db_session):
        """Test updating card balance"""
        card = CreditCard(
            user_id=user.id,
            name="Test Card",
            credit_limit=Decimal("5000.00"),
            current_balance=Decimal("1000.00"),
            invoice_close_day=15,
            payment_due_day=20
        )
        db_session.add(card)
        db_session.commit()

        response = client.patch(
            f"/credit-cards/{card.id}/balance?user_id={user.id}&balance=2000.00"
        )
        assert response.status_code == 200
        data = response.json()
        assert float(data["current_balance"]) == 2000.00
        assert float(data["available_credit"]) == 3000.00

    def test_get_total_balance(self, client, user, db_session):
        """Test getting total balance"""
        card1 = CreditCard(
            user_id=user.id,
            name="Card 1",
            credit_limit=Decimal("5000.00"),
            current_balance=Decimal("1000.00"),
            invoice_close_day=15,
            payment_due_day=20
        )
        card2 = CreditCard(
            user_id=user.id,
            name="Card 2",
            credit_limit=Decimal("3000.00"),
            current_balance=Decimal("500.00"),
            invoice_close_day=10,
            payment_due_day=15
        )
        db_session.add_all([card1, card2])
        db_session.commit()

        response = client.get(f"/credit-cards/{user.id}/total-balance")
        assert response.status_code == 200
        data = response.json()
        assert data["total_balance"] == 1500.00

    def test_get_total_credit_limit(self, client, user, db_session):
        """Test getting total credit limit"""
        card1 = CreditCard(
            user_id=user.id,
            name="Card 1",
            credit_limit=Decimal("5000.00"),
            invoice_close_day=15,
            payment_due_day=20
        )
        card2 = CreditCard(
            user_id=user.id,
            name="Card 2",
            credit_limit=Decimal("3000.00"),
            invoice_close_day=10,
            payment_due_day=15
        )
        db_session.add_all([card1, card2])
        db_session.commit()

        response = client.get(f"/credit-cards/{user.id}/total-credit-limit")
        assert response.status_code == 200
        data = response.json()
        assert data["total_credit_limit"] == 8000.00
