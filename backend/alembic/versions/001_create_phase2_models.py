"""Create Phase 2 domain models: User, BankAccount, CreditCard, InvestmentAccount

Revision ID: 001
Revises: 
Create Date: 2026-02-19

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # Create bank_accounts table
    op.create_table(
        'bank_accounts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('account_type', sa.Enum('CHECKING', 'SAVINGS', 'MONEY_MARKET', 'OTHER', name='accounttype'), nullable=False),
        sa.Column('bank_name', sa.String(), nullable=True),
        sa.Column('account_number_last4', sa.String(length=4), nullable=True),
        sa.Column('balance', sa.Numeric(precision=15, scale=2), nullable=False, server_default='0.00'),
        sa.Column('currency', sa.String(length=3), nullable=False, server_default='USD'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_bank_accounts_id'), 'bank_accounts', ['id'], unique=False)
    op.create_index(op.f('ix_bank_accounts_user_id'), 'bank_accounts', ['user_id'], unique=False)

    # Create credit_cards table
    op.create_table(
        'credit_cards',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('issuer', sa.String(), nullable=True),
        sa.Column('card_number_last4', sa.String(length=4), nullable=True),
        sa.Column('credit_limit', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('current_balance', sa.Numeric(precision=15, scale=2), nullable=False, server_default='0.00'),
        sa.Column('invoice_close_day', sa.Integer(), nullable=False),
        sa.Column('payment_due_day', sa.Integer(), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=False, server_default='USD'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_credit_cards_id'), 'credit_cards', ['id'], unique=False)
    op.create_index(op.f('ix_credit_cards_user_id'), 'credit_cards', ['user_id'], unique=False)

    # Create investment_accounts table
    op.create_table(
        'investment_accounts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('account_type', sa.Enum('BROKERAGE', 'IRA', 'ROTH_IRA', 'TRADITIONAL_401K', 'ROTH_401K', 'OTHER', name='investmentaccounttype'), nullable=False),
        sa.Column('broker_name', sa.String(), nullable=True),
        sa.Column('account_number_last4', sa.String(length=4), nullable=True),
        sa.Column('current_value', sa.Numeric(precision=15, scale=2), nullable=False, server_default='0.00'),
        sa.Column('currency', sa.String(length=3), nullable=False, server_default='USD'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_investment_accounts_id'), 'investment_accounts', ['id'], unique=False)
    op.create_index(op.f('ix_investment_accounts_user_id'), 'investment_accounts', ['user_id'], unique=False)

    # Create investment_holdings table
    op.create_table(
        'investment_holdings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('account_id', sa.Integer(), nullable=False),
        sa.Column('symbol', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('quantity', sa.Numeric(precision=15, scale=6), nullable=False),
        sa.Column('average_cost', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('current_price', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('current_value', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=False, server_default='USD'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['account_id'], ['investment_accounts.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_investment_holdings_id'), 'investment_holdings', ['id'], unique=False)
    op.create_index(op.f('ix_investment_holdings_account_id'), 'investment_holdings', ['account_id'], unique=False)

    # Create investment_history table
    op.create_table(
        'investment_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('account_id', sa.Integer(), nullable=False),
        sa.Column('snapshot_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('total_value', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('total_cost_basis', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('total_gain_loss', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('total_gain_loss_percentage', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['account_id'], ['investment_accounts.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_investment_history_id'), 'investment_history', ['id'], unique=False)
    op.create_index(op.f('ix_investment_history_account_id'), 'investment_history', ['account_id'], unique=False)
    op.create_index(op.f('ix_investment_history_snapshot_date'), 'investment_history', ['snapshot_date'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_investment_history_snapshot_date'), table_name='investment_history')
    op.drop_index(op.f('ix_investment_history_account_id'), table_name='investment_history')
    op.drop_index(op.f('ix_investment_history_id'), table_name='investment_history')
    op.drop_table('investment_history')
    op.drop_index(op.f('ix_investment_holdings_account_id'), table_name='investment_holdings')
    op.drop_index(op.f('ix_investment_holdings_id'), table_name='investment_holdings')
    op.drop_table('investment_holdings')
    op.drop_index(op.f('ix_investment_accounts_user_id'), table_name='investment_accounts')
    op.drop_index(op.f('ix_investment_accounts_id'), table_name='investment_accounts')
    op.drop_table('investment_accounts')
    op.drop_index(op.f('ix_credit_cards_user_id'), table_name='credit_cards')
    op.drop_index(op.f('ix_credit_cards_id'), table_name='credit_cards')
    op.drop_table('credit_cards')
    op.drop_index(op.f('ix_bank_accounts_user_id'), table_name='bank_accounts')
    op.drop_index(op.f('ix_bank_accounts_id'), table_name='bank_accounts')
    op.drop_table('bank_accounts')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_table('users')
