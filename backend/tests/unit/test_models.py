"""Unit tests for models"""
import pytest
import uuid
from decimal import Decimal
from datetime import datetime, date, timedelta
from app.models.user import User
from app.models.bank_account import BankAccount, AccountType
from app.models.credit_card import CreditCard
from app.models.investment_account import InvestmentAccount, InvestmentAccountType, InvestmentHolding, InvestmentHistory
from app.models.payment import (
    Payment,
    PaymentType,
    PaymentFrequency,
    PaymentStatus,
    PaymentCategory,
    PaymentOccurrence,
    RecurringPaymentOverride,
)


@pytest.mark.unit
class TestUserModel:
    """Test User model"""

    def test_create_user(self, db):
        """Test creating a user"""
        unique_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        user = User(email=unique_email, name="Test User")
        db.add(user)
        db.commit()
        db.refresh(user)

        assert user.id is not None
        assert user.email == unique_email
        assert user.name == "Test User"
        assert user.is_active is True
        assert user.created_at is not None
        assert user.updated_at is not None

    def test_user_repr(self, db):
        """Test user string representation"""
        unique_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        user = User(email=unique_email)
        db.add(user)
        db.commit()
        db.refresh(user)

        assert "User" in repr(user)
        assert str(user.id) in repr(user)
        assert unique_email in repr(user)


@pytest.mark.unit
class TestBankAccountModel:
    """Test BankAccount model"""

    def test_create_bank_account(self, db):
        """Test creating a bank account"""
        unique_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        user = User(email=unique_email)
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
        user = User(email=f"test_{uuid.uuid4().hex[:8]}@example.com")
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
        user = User(email=f"test_{uuid.uuid4().hex[:8]}@example.com")
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
        user = User(email=f"test_{uuid.uuid4().hex[:8]}@example.com")
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
        user = User(email=f"test_{uuid.uuid4().hex[:8]}@example.com")
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
        user = User(email=f"test_{uuid.uuid4().hex[:8]}@example.com")
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
        # Allow for small rounding differences in percentage calculation
        assert abs(float(holding.unrealized_gain_loss_percentage) - 16.67) < 0.01

    def test_investment_history(self, db):
        """Test creating investment history"""
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


@pytest.mark.unit
class TestPaymentModel:
    """Test Payment model"""

    def test_create_one_time_payment(self, db):
        """Test creating a one-time payment"""
        user = User(email=f"test_{uuid.uuid4().hex[:8]}@example.com")
        db.add(user)
        db.commit()

        payment = Payment(
            user_id=user.id,
            payment_type=PaymentType.ONE_TIME,
            description="Test Payment",
            amount=Decimal("100.00"),
            due_date=date.today(),
            status=PaymentStatus.PENDING
        )
        db.add(payment)
        db.commit()
        db.refresh(payment)

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

        payment = Payment(
            user_id=user.id,
            payment_type=PaymentType.RECURRING,
            description="Monthly Subscription",
            amount=Decimal("29.99"),
            frequency=PaymentFrequency.MONTHLY,
            start_date=date.today(),
            status=PaymentStatus.PENDING
        )
        db.add(payment)
        db.commit()
        db.refresh(payment)

        assert payment.id is not None
        assert payment.payment_type == PaymentType.RECURRING
        assert payment.frequency == PaymentFrequency.MONTHLY
        assert payment.start_date == date.today()

    def test_payment_repr(self, db):
        """Test payment string representation"""
        user = User(email=f"test_{uuid.uuid4().hex[:8]}@example.com")
        db.add(user)
        db.commit()

        payment = Payment(
            user_id=user.id,
            payment_type=PaymentType.ONE_TIME,
            description="Test",
            amount=Decimal("50.00"),
            status=PaymentStatus.PENDING
        )
        db.add(payment)
        db.commit()
        db.refresh(payment)

        assert "Payment" in repr(payment)
        assert str(payment.id) in repr(payment)


@pytest.mark.unit
class TestPaymentOccurrenceModel:
    """Test PaymentOccurrence model"""

    def test_create_payment_occurrence(self, db):
        """Test creating a payment occurrence"""
        user = User(email=f"test_{uuid.uuid4().hex[:8]}@example.com")
        db.add(user)
        db.commit()

        payment = Payment(
            user_id=user.id,
            payment_type=PaymentType.RECURRING,
            description="Test",
            amount=Decimal("100.00"),
            frequency=PaymentFrequency.MONTHLY,
            start_date=date.today(),
            status=PaymentStatus.PENDING
        )
        db.add(payment)
        db.commit()

        occurrence = PaymentOccurrence(
            payment_id=payment.id,
            scheduled_date=date.today(),
            due_date=date.today(),
            amount=Decimal("100.00"),
            status=PaymentStatus.SCHEDULED
        )
        db.add(occurrence)
        db.commit()
        db.refresh(occurrence)

        assert occurrence.id is not None
        assert occurrence.payment_id == payment.id
        assert occurrence.scheduled_date == date.today()
        assert occurrence.amount == Decimal("100.00")
        assert occurrence.status == PaymentStatus.SCHEDULED

    def test_payment_occurrence_repr(self, db):
        """Test payment occurrence string representation"""
        user = User(email=f"test_{uuid.uuid4().hex[:8]}@example.com")
        db.add(user)
        db.commit()

        payment = Payment(
            user_id=user.id,
            payment_type=PaymentType.RECURRING,
            description="Test",
            amount=Decimal("50.00"),
            frequency=PaymentFrequency.MONTHLY,
            start_date=date.today(),
            status=PaymentStatus.PENDING
        )
        db.add(payment)
        db.commit()

        occurrence = PaymentOccurrence(
            payment_id=payment.id,
            scheduled_date=date.today(),
            amount=Decimal("50.00"),
            status=PaymentStatus.SCHEDULED
        )
        db.add(occurrence)
        db.commit()
        db.refresh(occurrence)

        assert "PaymentOccurrence" in repr(occurrence)
        assert str(occurrence.id) in repr(occurrence)


@pytest.mark.unit
class TestRecurringPaymentOverrideModel:
    """Test RecurringPaymentOverride model"""

    def test_create_recurring_override(self, db):
        """Test creating a recurring payment override"""
        user = User(email=f"test_{uuid.uuid4().hex[:8]}@example.com")
        db.add(user)
        db.commit()

        payment = Payment(
            user_id=user.id,
            payment_type=PaymentType.RECURRING,
            description="Test",
            amount=Decimal("100.00"),
            frequency=PaymentFrequency.MONTHLY,
            start_date=date.today(),
            status=PaymentStatus.PENDING
        )
        db.add(payment)
        db.commit()

        override = RecurringPaymentOverride(
            payment_id=payment.id,
            override_type="skip",
            effective_date=date.today(),
            target_date=date.today() + timedelta(days=30)
        )
        db.add(override)
        db.commit()
        db.refresh(override)

        assert override.id is not None
        assert override.payment_id == payment.id
        assert override.override_type == "skip"
        assert override.is_active is True

    def test_recurring_override_repr(self, db):
        """Test recurring override string representation"""
        user = User(email=f"test_{uuid.uuid4().hex[:8]}@example.com")
        db.add(user)
        db.commit()

        payment = Payment(
            user_id=user.id,
            payment_type=PaymentType.RECURRING,
            description="Test",
            amount=Decimal("50.00"),
            frequency=PaymentFrequency.MONTHLY,
            start_date=date.today(),
            status=PaymentStatus.PENDING
        )
        db.add(payment)
        db.commit()

        override = RecurringPaymentOverride(
            payment_id=payment.id,
            override_type="change_amount",
            effective_date=date.today(),
            new_amount=Decimal("75.00")
        )
        db.add(override)
        db.commit()
        db.refresh(override)

        assert "RecurringPaymentOverride" in repr(override)
        assert str(override.id) in repr(override)
