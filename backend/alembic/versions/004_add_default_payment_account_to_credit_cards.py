"""Add default payment account to credit cards.

Revision ID: 004
Revises: 003
Create Date: 2026-02-19
"""
from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("credit_cards", sa.Column("default_payment_account_id", sa.Integer(), nullable=True))
    op.create_index(
        op.f("ix_credit_cards_default_payment_account_id"),
        "credit_cards",
        ["default_payment_account_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_credit_cards_default_payment_account_id",
        "credit_cards",
        "bank_accounts",
        ["default_payment_account_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_credit_cards_default_payment_account_id", "credit_cards", type_="foreignkey")
    op.drop_index(op.f("ix_credit_cards_default_payment_account_id"), table_name="credit_cards")
    op.drop_column("credit_cards", "default_payment_account_id")
