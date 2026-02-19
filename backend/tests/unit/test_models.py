"""Unit tests for models"""
import pytest
from decimal import Decimal
from datetime import datetime
from app.models.user import User
from app.models.bank_account import BankAccount, AccountType
from app.models.credit_card import CreditCard
from app.models.investment_account import InvestmentAccount, InvestmentAccountType, InvestmentHolding, InvestmentHistory


@pytest.mark.unit
class TestUserModel:
    """Test User model"""

    def test_create_user(self, db):
        """Test creating a user"""
        user = User(email="test@example.com", name="Test User")
        db.add(user)
        db.commit()
        db.refresh(user)

        assert user.id is not None
        assert user.email == "test@example.com"
        assert user.name == "Test User"
        assert user.is_active is True
        assert user.created_at is not None
        assert user.updated_at is not None

    def test_user_repr(self, db):
        """Test user string representation"""
        user = User(email="test@example.com")
        db.add(user)
        db.commit()
        db.refresh(user)

        assert "User" in repr(user)
        assert str(user.id) in repr(user)
        assert "test@example.com" in repr(user)


@pytest.mark.unit
class TestBankAccountModel:
    """Test BankAccount model"""

    def test_create_bank_account(self, db):
        """Test creating a bank account"""
        user = User(email="test@example.com")
        db.add(user)
        db.commit()

        account = BankAccount(
            user_id=user.id,
            name="Checking Account",
            account_type=AccountType.CHECKING,
            balance=Decimal("1000.00")
        )
        db.add(account)
        db.commit()
        db.refresh(account)

        assert account.id is not None
        assert account.user_id == user.id
        assert account.name == "Checking Account"
        assert account.account_type == AccountType.CHECKING
        assert account.balance == Decimal("1000.00")
        assert account.currency == "USD"
        assert account.is_active is True

    def test_bank_account_repr(self, db):
        """Test bank account string representation"""
        user = User(email="test@example.com")
        db.add(user)
        db.commit()

        account = BankAccount(user_id=user.id, name="Test Account", balance=Decimal("500.00"))
        db.add(account)
        db.commit()
        db.refresh(account)

        assert "BankAccount" in repr(account)
        assert str(account.id) in repr(account)


@pytest.mark.unit
class TestCreditCardModel:
    """Test CreditCard model"""

    def test_create_credit_card(self, db):
        """Test creating a credit card"""
        user = User(email="test@example.com")
        db.add(user)
        db.commit()

        card = CreditCard(
            user_id=user.id,
            name="Visa Card",
            credit_limit=Decimal("5000.00"),
            current_balance=Decimal("1000.00"),
            invoice_close_day=15,
            payment_due_day=20
        )
        db.add(card)
        db.commit()
        db.refresh(card)

        assert card.id is not None
        assert card.user_id == user.id
        assert card.name == "Visa Card"
        assert card.credit_limit == Decimal("5000.00")
        assert card.current_balance == Decimal("1000.00")
        assert card.invoice_close_day == 15
        assert card.payment_due_day == 20

    def test_credit_card_properties(self, db):
        """Test credit card calculated properties"""
        user = User(email="test@example.com")
        db.add(user)
        db.commit()

        card = CreditCard(
            user_id=user.id,
            name="Test Card",
            credit_limit=Decimal("5000.00"),
            current_balance=Decimal("1000.00"),
            invoice_close_day=15,
            payment_due_day=20
        )
        db.add(card)
        db.commit()
        db.refresh(card)

        assert card.available_credit == Decimal("4000.00")
        assert card.utilization_percentage == Decimal("20.00")

    def test_credit_card_repr(self, db):
        """Test credit card string representation"""
        user = User(email="test@example.com")
        db.add(user)
        db.commit()

        card = CreditCard(
            user_id=user.id,
            name="Test Card",
            credit_limit=Decimal("5000.00"),
            invoice_close_day=15,
            payment_due_day=20
        )
        db.add(card)
        db.commit()
        db.refresh(card)

        assert "CreditCard" in repr(card)
        assert str(card.id) in repr(card)


@pytest.mark.unit
class TestInvestmentAccountModel:
    """Test InvestmentAccount model"""

    def test_create_investment_account(self, db):
        """Test creating an investment account"""
        user = User(email="test@example.com")
        db.add(user)
        db.commit()

        account = InvestmentAccount(
            user_id=user.id,
            name="Brokerage Account",
            account_type=InvestmentAccountType.BROKERAGE,
            current_value=Decimal("10000.00")
        )
        db.add(account)
        db.commit()
        db.refresh(account)

        assert account.id is not None
        assert account.user_id == user.id
        assert account.name == "Brokerage Account"
        assert account.account_type == InvestmentAccountType.BROKERAGE
        assert account.current_value == Decimal("10000.00")

    def test_investment_holding(self, db):
        """Test creating an investment holding"""
        user = User(email="test@example.com")
        db.add(user)
        db.commit()

        account = InvestmentAccount(
            user_id=user.id,
            name="Test Account",
            account_type=InvestmentAccountType.BROKERAGE
        )
        db.add(account)
        db.commit()

        holding = InvestmentHolding(
            account_id=account.id,
            symbol="AAPL",
            name="Apple Inc.",
            quantity=Decimal("10.0"),
            average_cost=Decimal("150.00"),
            current_price=Decimal("175.00"),
            current_value=Decimal("1750.00")
        )
        db.add(holding)
        db.commit()
        db.refresh(holding)

        assert holding.id is not None
        assert holding.account_id == account.id
        assert holding.symbol == "AAPL"
        assert holding.quantity == Decimal("10.0")
        assert holding.unrealized_gain_loss == Decimal("250.00")
        assert holding.unrealized_gain_loss_percentage == Decimal("16.67")

    def test_investment_history(self, db):
        """Test creating investment history"""
        user = User(email="test@example.com")
        db.add(user)
        db.commit()

        account = InvestmentAccount(
            user_id=user.id,
            name="Test Account",
            account_type=InvestmentAccountType.BROKERAGE
        )
        db.add(account)
        db.commit()

        history = InvestmentHistory(
            account_id=account.id,
            snapshot_date=datetime.now(),
            total_value=Decimal("10000.00"),
            total_cost_basis=Decimal("9000.00"),
            total_gain_loss=Decimal("1000.00"),
            total_gain_loss_percentage=Decimal("11.11")
        )
        db.add(history)
        db.commit()
        db.refresh(history)

        assert history.id is not None
        assert history.account_id == account.id
        assert history.total_value == Decimal("10000.00")
        assert history.total_gain_loss == Decimal("1000.00")
