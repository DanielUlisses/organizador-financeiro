"""Unit tests for services"""
import pytest
import uuid
from decimal import Decimal
from app.models.user import User
from app.models.bank_account import BankAccount, AccountType
from app.models.credit_card import CreditCard
from app.models.investment_account import InvestmentAccount, InvestmentAccountType, InvestmentHolding, InvestmentHistory
from app.schemas.user import UserCreate, UserUpdate
from app.schemas.bank_account import BankAccountCreate, BankAccountUpdate
from app.schemas.credit_card import CreditCardCreate, CreditCardUpdate
from app.schemas.investment_account import (
    InvestmentAccountCreate,
    InvestmentAccountUpdate,
    InvestmentHoldingCreate,
    InvestmentHistoryCreate,
)
from app.services.user_service import UserService
from app.services.bank_account_service import BankAccountService
from app.services.credit_card_service import CreditCardService
from app.services.investment_account_service import (
    InvestmentAccountService,
    InvestmentHoldingService,
    InvestmentHistoryService,
)


@pytest.mark.unit
class TestUserService:
    """Test UserService"""

    def test_create_user(self, db):
        """Test creating a user"""
        unique_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        user_data = UserCreate(email=unique_email, name="Test User")
        user = UserService.create_user(db, user_data)

        assert user.id is not None
        assert user.email == unique_email
        assert user.name == "Test User"

    def test_get_user(self, db):
        """Test getting a user"""
        unique_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        user = User(email=unique_email, name="Test User")
        db.add(user)
        db.commit()

        retrieved = UserService.get_user(db, user.id)
        assert retrieved is not None
        assert retrieved.email == unique_email

    def test_get_user_by_email(self, db):
        """Test getting a user by email"""
        unique_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        user = User(email=unique_email)
        db.add(user)
        db.commit()

        retrieved = UserService.get_user_by_email(db, unique_email)
        assert retrieved is not None
        assert retrieved.email == unique_email

    def test_update_user(self, db):
        """Test updating a user"""
        unique_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        user = User(email=unique_email, name="Old Name")
        db.add(user)
        db.commit()

        update_data = UserUpdate(name="New Name")
        updated = UserService.update_user(db, user.id, update_data)

        assert updated.name == "New Name"
        assert updated.email == unique_email

    def test_delete_user(self, db):
        """Test deleting a user"""
        user = User(email=f"test_{uuid.uuid4().hex[:8]}@example.com")
        db.add(user)
        db.commit()
        user_id = user.id

        success = UserService.delete_user(db, user_id)
        assert success is True

        deleted = UserService.get_user(db, user_id)
        assert deleted is None


@pytest.mark.unit
class TestBankAccountService:
    """Test BankAccountService"""

    def test_create_account(self, db):
        """Test creating a bank account"""
        user = User(email=f"test_{uuid.uuid4().hex[:8]}@example.com")
        db.add(user)
        db.commit()

        account_data = BankAccountCreate(
            name="Checking",
            account_type=AccountType.CHECKING,
            balance=Decimal("1000.00")
        )
        account = BankAccountService.create_account(db, user.id, account_data)

        assert account.id is not None
        assert account.user_id == user.id
        assert account.balance == Decimal("1000.00")

    def test_get_account(self, db):
        """Test getting a bank account"""
        user = User(email=f"test_{uuid.uuid4().hex[:8]}@example.com")
        db.add(user)
        db.commit()

        account = BankAccount(user_id=user.id, name="Test", balance=Decimal("500.00"))
        db.add(account)
        db.commit()

        retrieved = BankAccountService.get_account(db, account.id, user.id)
        assert retrieved is not None
        assert retrieved.name == "Test"

    def test_update_balance(self, db):
        """Test updating account balance"""
        user = User(email=f"test_{uuid.uuid4().hex[:8]}@example.com")
        db.add(user)
        db.commit()

        account = BankAccount(user_id=user.id, name="Test", balance=Decimal("500.00"))
        db.add(account)
        db.commit()

        updated = BankAccountService.update_balance(db, account.id, user.id, Decimal("1000.00"))
        assert updated.balance == Decimal("1000.00")

    def test_get_total_balance(self, db):
        """Test getting total balance"""
        user = User(email=f"test_{uuid.uuid4().hex[:8]}@example.com")
        db.add(user)
        db.commit()

        account1 = BankAccount(user_id=user.id, name="Account 1", balance=Decimal("1000.00"))
        account2 = BankAccount(user_id=user.id, name="Account 2", balance=Decimal("500.00"))
        db.add_all([account1, account2])
        db.commit()

        total = BankAccountService.get_total_balance(db, user.id)
        assert total == Decimal("1500.00")


@pytest.mark.unit
class TestCreditCardService:
    """Test CreditCardService"""

    def test_create_card(self, db):
        """Test creating a credit card"""
        user = User(email=f"test_{uuid.uuid4().hex[:8]}@example.com")
        db.add(user)
        db.commit()

        card_data = CreditCardCreate(
            name="Visa",
            credit_limit=Decimal("5000.00"),
            invoice_close_day=15,
            payment_due_day=20
        )
        card = CreditCardService.create_card(db, user.id, card_data)

        assert card.id is not None
        assert card.user_id == user.id
        assert card.credit_limit == Decimal("5000.00")

    def test_get_total_balance(self, db):
        """Test getting total balance"""
        user = User(email=f"test_{uuid.uuid4().hex[:8]}@example.com")
        db.add(user)
        db.commit()

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
        db.add_all([card1, card2])
        db.commit()

        total = CreditCardService.get_total_balance(db, user.id)
        assert total == Decimal("1500.00")

    def test_get_total_credit_limit(self, db):
        """Test getting total credit limit"""
        user = User(email=f"test_{uuid.uuid4().hex[:8]}@example.com")
        db.add(user)
        db.commit()

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
        db.add_all([card1, card2])
        db.commit()

        total = CreditCardService.get_total_credit_limit(db, user.id)
        assert total == Decimal("8000.00")


@pytest.mark.unit
class TestInvestmentAccountService:
    """Test InvestmentAccountService"""

    def test_create_account(self, db):
        """Test creating an investment account"""
        user = User(email=f"test_{uuid.uuid4().hex[:8]}@example.com")
        db.add(user)
        db.commit()

        account_data = InvestmentAccountCreate(
            name="Brokerage",
            account_type=InvestmentAccountType.BROKERAGE,
            current_value=Decimal("10000.00")
        )
        account = InvestmentAccountService.create_account(db, user.id, account_data)

        assert account.id is not None
        assert account.user_id == user.id
        assert account.current_value == Decimal("10000.00")

    def test_create_holding(self, db):
        """Test creating an investment holding"""
        user = User(email=f"test_{uuid.uuid4().hex[:8]}@example.com")
        db.add(user)
        db.commit()

        account = InvestmentAccount(
            user_id=user.id,
            name="Test Account",
            account_type=InvestmentAccountType.BROKERAGE
        )
        db.add(account)
        db.commit()

        holding_data = InvestmentHoldingCreate(
            symbol="AAPL",
            quantity=Decimal("10.0"),
            average_cost=Decimal("150.00"),
            current_price=Decimal("175.00"),
            current_value=Decimal("1750.00")
        )
        holding = InvestmentHoldingService.create_holding(db, account.id, holding_data)

        assert holding.id is not None
        assert holding.account_id == account.id
        assert holding.symbol == "AAPL"

    def test_get_total_value(self, db):
        """Test getting total value"""
        user = User(email=f"test_{uuid.uuid4().hex[:8]}@example.com")
        db.add(user)
        db.commit()

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

        total = InvestmentAccountService.get_total_value(db, user.id)
        assert total == Decimal("15000.00")
