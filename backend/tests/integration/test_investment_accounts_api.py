"""Integration tests for investment accounts API"""
import pytest
from decimal import Decimal
from datetime import datetime
from app.models.user import User
from app.models.investment_account import InvestmentAccount, InvestmentAccountType, InvestmentHolding


@pytest.mark.integration
class TestInvestmentAccountsAPI:
    """Test investment accounts API endpoints"""

    @pytest.fixture
    def user(self, db):
        """Create a test user"""
        user = User(email="test@example.com", name="Test User")
        db.add(user)
        db.commit()
        return user

    def test_create_investment_account(self, client, user):
        """Test creating an investment account"""
        response = client.post(
            f"/investment-accounts/?user_id={user.id}",
            json={
                "name": "Brokerage Account",
                "account_type": "brokerage",
                "current_value": "10000.00",
                "broker_name": "Test Broker"
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Brokerage Account"
        assert data["account_type"] == "brokerage"
        assert float(data["current_value"]) == 10000.00
        assert data["user_id"] == user.id

    def test_get_investment_account(self, client, user, db):
        """Test getting an investment account"""
        account = InvestmentAccount(
            user_id=user.id,
            name="Test Account",
            account_type=InvestmentAccountType.BROKERAGE,
            current_value=Decimal("10000.00")
        )
        db.add(account)
        db.commit()

        response = client.get(f"/investment-accounts/{account.id}?user_id={user.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test Account"
        assert float(data["current_value"]) == 10000.00

    def test_get_all_investment_accounts(self, client, user, db):
        """Test getting all investment accounts for a user"""
        account1 = InvestmentAccount(
            user_id=user.id,
            name="Account 1",
            account_type=InvestmentAccountType.BROKERAGE,
            current_value=Decimal("10000.00")
        )
        account2 = InvestmentAccount(
            user_id=user.id,
            name="Account 2",
            account_type=InvestmentAccountType.IRA,
            current_value=Decimal("5000.00")
        )
        db.add_all([account1, account2])
        db.commit()

        response = client.get(f"/investment-accounts/?user_id={user.id}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_create_holding(self, client, user, db):
        """Test creating an investment holding"""
        account = InvestmentAccount(
            user_id=user.id,
            name="Test Account",
            account_type=InvestmentAccountType.BROKERAGE
        )
        db.add(account)
        db.commit()

        response = client.post(
            f"/investment-accounts/{account.id}/holdings",
            json={
                "symbol": "AAPL",
                "name": "Apple Inc.",
                "quantity": "10.0",
                "average_cost": "150.00",
                "current_price": "175.00",
                "current_value": "1750.00"
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["symbol"] == "AAPL"
        assert float(data["quantity"]) == 10.0
        assert float(data["current_value"]) == 1750.00

    def test_get_holdings(self, client, user, db):
        """Test getting holdings for an account"""
        account = InvestmentAccount(
            user_id=user.id,
            name="Test Account",
            account_type=InvestmentAccountType.BROKERAGE
        )
        db.add(account)
        db.commit()

        holding1 = InvestmentHolding(
            account_id=account.id,
            symbol="AAPL",
            quantity=Decimal("10.0"),
            average_cost=Decimal("150.00"),
            current_price=Decimal("175.00"),
            current_value=Decimal("1750.00")
        )
        holding2 = InvestmentHolding(
            account_id=account.id,
            symbol="GOOGL",
            quantity=Decimal("5.0"),
            average_cost=Decimal("200.00"),
            current_price=Decimal("220.00"),
            current_value=Decimal("1100.00")
        )
        db.add_all([holding1, holding2])
        db.commit()

        response = client.get(f"/investment-accounts/{account.id}/holdings")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_get_total_value(self, client, user, db):
        """Test getting total value"""
        account1 = InvestmentAccount(
            user_id=user.id,
            name="Account 1",
            account_type=InvestmentAccountType.BROKERAGE,
            current_value=Decimal("10000.00")
        )
        account2 = InvestmentAccount(
            user_id=user.id,
            name="Account 2",
            account_type=InvestmentAccountType.IRA,
            current_value=Decimal("5000.00")
        )
        db.add_all([account1, account2])
        db.commit()

        response = client.get(f"/investment-accounts/{user.id}/total-value")
        assert response.status_code == 200
        data = response.json()
        assert data["total_value"] == 15000.00

    def test_create_history(self, client, user, db):
        """Test creating investment history"""
        account = InvestmentAccount(
            user_id=user.id,
            name="Test Account",
            account_type=InvestmentAccountType.BROKERAGE
        )
        db.add(account)
        db.commit()

        response = client.post(
            f"/investment-accounts/{account.id}/history",
            json={
                "snapshot_date": datetime.now().isoformat(),
                "total_value": "10000.00",
                "total_cost_basis": "9000.00",
                "total_gain_loss": "1000.00",
                "total_gain_loss_percentage": "11.11",
                "notes": "Monthly snapshot"
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert float(data["total_value"]) == 10000.00
        assert float(data["total_gain_loss"]) == 1000.00
