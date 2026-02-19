"""Unit tests for services"""
import pytest
import uuid
from decimal import Decimal
from datetime import date, timedelta
from app.models.user import User
from app.models.bank_account import BankAccount, AccountType
from app.models.credit_card import CreditCard
from app.models.investment_account import InvestmentAccount, InvestmentAccountType, InvestmentHolding, InvestmentHistory
from app.models.payment import PaymentType, PaymentFrequency, PaymentStatus
from app.schemas.user import UserCreate, UserUpdate
from app.schemas.bank_account import BankAccountCreate, BankAccountUpdate
from app.schemas.credit_card import CreditCardCreate, CreditCardUpdate
from app.schemas.investment_account import (
    InvestmentAccountCreate,
    InvestmentAccountUpdate,
    InvestmentHoldingCreate,
    InvestmentHistoryCreate,
)
from app.schemas.payment import (
    OneTimePaymentCreate,
    RecurringPaymentCreate,
    PaymentUpdate,
    PaymentOccurrenceCreate,
    PaymentOccurrenceUpdate,
    RecurringPaymentOverrideCreate,
)
from app.services.user_service import UserService
from app.services.bank_account_service import BankAccountService
from app.services.credit_card_service import CreditCardService
from app.services.investment_account_service import (
    InvestmentAccountService,
    InvestmentHoldingService,
    InvestmentHistoryService,
)
from app.services.payment_service import PaymentService


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


@pytest.mark.unit
class TestPaymentService:
    """Test PaymentService"""

    def test_create_one_time_payment(self, db):
        """Test creating a one-time payment"""
        user = User(email=f"test_{uuid.uuid4().hex[:8]}@example.com")
        db.add(user)
        db.commit()

        payment_data = OneTimePaymentCreate(
            description="Test Payment",
            amount=Decimal("100.00"),
            due_date=date.today()
        )
        payment = PaymentService.create_one_time_payment(db, user.id, payment_data)

        assert payment.id is not None
        assert payment.user_id == user.id
        assert payment.payment_type == PaymentType.ONE_TIME
        assert payment.description == "Test Payment"
        assert payment.amount == Decimal("100.00")
        assert payment.status == PaymentStatus.PENDING

    def test_create_recurring_payment(self, db):
        """Test creating a recurring payment"""
        user = User(email=f"test_{uuid.uuid4().hex[:8]}@example.com")
        db.add(user)
        db.commit()

        payment_data = RecurringPaymentCreate(
            description="Monthly Subscription",
            amount=Decimal("29.99"),
            frequency=PaymentFrequency.MONTHLY,
            start_date=date.today()
        )
        payment = PaymentService.create_recurring_payment(db, user.id, payment_data)

        assert payment.id is not None
        assert payment.payment_type == PaymentType.RECURRING
        assert payment.frequency == PaymentFrequency.MONTHLY
        assert payment.start_date == date.today()
        assert payment.next_due_date is not None

    def test_get_payment(self, db):
        """Test getting a payment"""
        user = User(email=f"test_{uuid.uuid4().hex[:8]}@example.com")
        db.add(user)
        db.commit()

        payment_data = OneTimePaymentCreate(
            description="Test",
            amount=Decimal("50.00")
        )
        payment = PaymentService.create_one_time_payment(db, user.id, payment_data)

        retrieved = PaymentService.get_payment(db, payment.id, user.id)
        assert retrieved is not None
        assert retrieved.id == payment.id

    def test_update_payment(self, db):
        """Test updating a payment"""
        user = User(email=f"test_{uuid.uuid4().hex[:8]}@example.com")
        db.add(user)
        db.commit()

        payment_data = OneTimePaymentCreate(
            description="Old Description",
            amount=Decimal("50.00")
        )
        payment = PaymentService.create_one_time_payment(db, user.id, payment_data)

        update_data = PaymentUpdate(description="New Description", amount=Decimal("75.00"))
        updated = PaymentService.update_payment(db, payment.id, user.id, update_data)

        assert updated.description == "New Description"
        assert updated.amount == Decimal("75.00")

    def test_delete_payment(self, db):
        """Test deleting a payment"""
        user = User(email=f"test_{uuid.uuid4().hex[:8]}@example.com")
        db.add(user)
        db.commit()

        payment_data = OneTimePaymentCreate(
            description="Test",
            amount=Decimal("50.00")
        )
        payment = PaymentService.create_one_time_payment(db, user.id, payment_data)
        payment_id = payment.id

        success = PaymentService.delete_payment(db, payment_id, user.id)
        assert success is True

        deleted = PaymentService.get_payment(db, payment_id, user.id)
        assert deleted is None

    def test_create_payment_occurrence(self, db):
        """Test creating a payment occurrence"""
        user = User(email=f"test_{uuid.uuid4().hex[:8]}@example.com")
        db.add(user)
        db.commit()

        payment_data = RecurringPaymentCreate(
            description="Test",
            amount=Decimal("100.00"),
            frequency=PaymentFrequency.MONTHLY,
            start_date=date.today()
        )
        payment = PaymentService.create_recurring_payment(db, user.id, payment_data)

        occurrence_data = PaymentOccurrenceCreate(
            scheduled_date=date.today() + timedelta(days=30),
            due_date=date.today() + timedelta(days=30),
            amount=Decimal("100.00")
        )
        occurrence = PaymentService.create_payment_occurrence(
            db, payment.id, user.id, occurrence_data
        )

        assert occurrence is not None
        assert occurrence.payment_id == payment.id

    def test_create_recurring_override(self, db):
        """Test creating a recurring payment override"""
        user = User(email=f"test_{uuid.uuid4().hex[:8]}@example.com")
        db.add(user)
        db.commit()

        payment_data = RecurringPaymentCreate(
            description="Test",
            amount=Decimal("100.00"),
            frequency=PaymentFrequency.MONTHLY,
            start_date=date.today()
        )
        payment = PaymentService.create_recurring_payment(db, user.id, payment_data)

        override_data = RecurringPaymentOverrideCreate(
            override_type="skip",
            effective_date=date.today(),
            target_date=date.today() + timedelta(days=30)
        )
        override = PaymentService.create_recurring_override(
            db, payment.id, user.id, override_data
        )

        assert override is not None
        assert override.payment_id == payment.id
        assert override.override_type == "skip"
