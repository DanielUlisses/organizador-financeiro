"""Integration tests for bank accounts API"""
import pytest
import uuid
from decimal import Decimal
from app.models.user import User
from app.models.bank_account import BankAccount, AccountType


@pytest.mark.integration
class TestBankAccountsAPI:
    """Test bank accounts API endpoints"""

    @pytest.fixture
    def user(self, db_session):
        """Create a test user"""
        user = User(email=f"test_{uuid.uuid4().hex[:8]}@example.com", name="Test User")
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    def test_create_bank_account(self, client, user, db_session):
        """Test creating a bank account"""
        response = client.post(
            f"/bank-accounts/?user_id={user.id}",
            json={
                "name": "Checking Account",
                "account_type": "checking",
                "balance": "1000.00",
                "bank_name": "Test Bank"
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Checking Account"
        assert data["account_type"] == "checking"
        assert float(data["balance"]) == 1000.00
        assert data["user_id"] == user.id

    def test_get_bank_account(self, client, user, db_session):
        """Test getting a bank account"""
        account = BankAccount(
            user_id=user.id,
            name="Test Account",
            account_type=AccountType.CHECKING,
            balance=Decimal("500.00")
        )
        db_session.add(account)
        db_session.commit()
        db_session.refresh(account)

        response = client.get(f"/bank-accounts/{account.id}?user_id={user.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test Account"
        assert float(data["balance"]) == 500.00

    def test_get_all_bank_accounts(self, client, user, db_session):
        """Test getting all bank accounts for a user"""
        account1 = BankAccount(user_id=user.id, name="Account 1", balance=Decimal("1000.00"))
        account2 = BankAccount(user_id=user.id, name="Account 2", balance=Decimal("500.00"))
        db_session.add_all([account1, account2])
        db_session.commit()

        response = client.get(f"/bank-accounts/?user_id={user.id}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_update_bank_account(self, client, user, db_session):
        """Test updating a bank account"""
        account = BankAccount(user_id=user.id, name="Old Name", balance=Decimal("500.00"))
        db_session.add(account)
        db_session.commit()
        db_session.refresh(account)

        response = client.put(
            f"/bank-accounts/{account.id}?user_id={user.id}",
            json={"name": "New Name", "balance": "1000.00"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "New Name"
        assert float(data["balance"]) == 1000.00

    def test_update_balance(self, client, user, db_session):
        """Test updating account balance"""
        account = BankAccount(user_id=user.id, name="Test Account", balance=Decimal("500.00"))
        db_session.add(account)
        db_session.commit()
        db_session.refresh(account)

        response = client.patch(
            f"/bank-accounts/{account.id}/balance?user_id={user.id}&balance=1500.00"
        )
        assert response.status_code == 200
        data = response.json()
        assert float(data["balance"]) == 1500.00

    def test_get_total_balance(self, client, user, db_session):
        """Test getting total balance"""
        account1 = BankAccount(user_id=user.id, name="Account 1", balance=Decimal("1000.00"))
        account2 = BankAccount(user_id=user.id, name="Account 2", balance=Decimal("500.00"))
        db_session.add_all([account1, account2])
        db_session.commit()

        response = client.get(f"/bank-accounts/{user.id}/total-balance")
        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == user.id
        assert data["total_balance"] == 1500.00

    def test_delete_bank_account(self, client, user, db_session):
        """Test deleting a bank account"""
        account = BankAccount(user_id=user.id, name="Test Account", balance=Decimal("500.00"))
        db_session.add(account)
        db_session.commit()
        account_id = account.id

        response = client.delete(f"/bank-accounts/{account_id}?user_id={user.id}")
        assert response.status_code == 204

        # Verify deletion
        response = client.get(f"/bank-accounts/{account_id}?user_id={user.id}")
        assert response.status_code == 404
