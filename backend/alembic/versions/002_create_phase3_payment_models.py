"""Create Phase 3 payment models: Payment, PaymentOccurrence, RecurringPaymentOverride

Revision ID: 002
Revises: 001
Create Date: 2026-02-19

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create payments table
    op.create_table(
        'payments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('payment_type', sa.Enum('ONE_TIME', 'RECURRING', name='paymenttype'), nullable=False),
        sa.Column('description', sa.String(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=False, server_default='USD'),
        sa.Column('category', sa.Enum('BILL', 'SUBSCRIPTION', 'LOAN', 'TRANSFER', 'EXPENSE', 'INCOME', 'OTHER', name='paymentcategory'), nullable=True),
        sa.Column('from_account_type', sa.String(), nullable=True),
        sa.Column('from_account_id', sa.Integer(), nullable=True),
        sa.Column('to_account_type', sa.String(), nullable=True),
        sa.Column('to_account_id', sa.Integer(), nullable=True),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('frequency', sa.Enum('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', name='paymentfrequency'), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('next_due_date', sa.Date(), nullable=True),
        sa.Column('status', sa.Enum('PENDING', 'SCHEDULED', 'PROCESSED', 'FAILED', 'CANCELLED', 'RECONCILED', name='paymentstatus'), nullable=False, server_default='PENDING'),
        sa.Column('processed_date', sa.Date(), nullable=True),
        sa.Column('reconciled_date', sa.Date(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_payments_id'), 'payments', ['id'], unique=False)
    op.create_index(op.f('ix_payments_user_id'), 'payments', ['user_id'], unique=False)

    # Create payment_occurrences table
    op.create_table(
        'payment_occurrences',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('payment_id', sa.Integer(), nullable=False),
        sa.Column('scheduled_date', sa.Date(), nullable=False),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('amount', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('status', sa.Enum('PENDING', 'SCHEDULED', 'PROCESSED', 'FAILED', 'CANCELLED', 'RECONCILED', name='paymentstatus'), nullable=False, server_default='SCHEDULED'),
        sa.Column('processed_date', sa.Date(), nullable=True),
        sa.Column('reconciled_date', sa.Date(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['payment_id'], ['payments.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_payment_occurrences_id'), 'payment_occurrences', ['id'], unique=False)
    op.create_index(op.f('ix_payment_occurrences_payment_id'), 'payment_occurrences', ['payment_id'], unique=False)
    op.create_index(op.f('ix_payment_occurrences_scheduled_date'), 'payment_occurrences', ['scheduled_date'], unique=False)

    # Create recurring_payment_overrides table
    op.create_table(
        'recurring_payment_overrides',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('payment_id', sa.Integer(), nullable=False),
        sa.Column('override_type', sa.String(), nullable=False),
        sa.Column('target_date', sa.Date(), nullable=True),
        sa.Column('effective_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('occurrence_count', sa.Integer(), nullable=True),
        sa.Column('new_amount', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('new_due_date', sa.Date(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['payment_id'], ['payments.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_recurring_payment_overrides_id'), 'recurring_payment_overrides', ['id'], unique=False)
    op.create_index(op.f('ix_recurring_payment_overrides_payment_id'), 'recurring_payment_overrides', ['payment_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_recurring_payment_overrides_payment_id'), table_name='recurring_payment_overrides')
    op.drop_index(op.f('ix_recurring_payment_overrides_id'), table_name='recurring_payment_overrides')
    op.drop_table('recurring_payment_overrides')
    op.drop_index(op.f('ix_payment_occurrences_scheduled_date'), table_name='payment_occurrences')
    op.drop_index(op.f('ix_payment_occurrences_payment_id'), table_name='payment_occurrences')
    op.drop_index(op.f('ix_payment_occurrences_id'), table_name='payment_occurrences')
    op.drop_table('payment_occurrences')
    op.drop_index(op.f('ix_payments_user_id'), table_name='payments')
    op.drop_index(op.f('ix_payments_id'), table_name='payments')
    op.drop_table('payments')
    # Drop enums
    op.execute("DROP TYPE IF EXISTS paymentstatus")
    op.execute("DROP TYPE IF EXISTS paymentfrequency")
    op.execute("DROP TYPE IF EXISTS paymenttype")
    op.execute("DROP TYPE IF EXISTS paymentcategory")
