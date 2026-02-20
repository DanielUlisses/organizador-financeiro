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


def _column_exists(insp: sa.Inspector, table_name: str, column_name: str) -> bool:
    return column_name in {col["name"] for col in insp.get_columns(table_name, schema="public")}


def _index_exists(conn, index_name: str) -> bool:
    result = conn.execute(
        sa.text(
            """
            SELECT 1
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relkind = 'i' AND c.relname = :index_name AND n.nspname = 'public'
            """
        ),
        {"index_name": index_name},
    )
    return result.scalar() is not None


def _fk_exists(conn, table_name: str, fk_name: str) -> bool:
    result = conn.execute(
        sa.text(
            """
            SELECT 1
            FROM pg_constraint
            WHERE conname = :fk_name
              AND contype = 'f'
              AND conrelid = to_regclass(:table_name)
            """
        ),
        {"fk_name": fk_name, "table_name": f"public.{table_name}"},
    )
    return result.scalar() is not None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    if not _column_exists(insp, "credit_cards", "default_payment_account_id"):
        op.add_column("credit_cards", sa.Column("default_payment_account_id", sa.Integer(), nullable=True))

    index_name = op.f("ix_credit_cards_default_payment_account_id")
    if not _index_exists(conn, index_name):
        op.create_index(index_name, "credit_cards", ["default_payment_account_id"], unique=False)

    fk_name = "fk_credit_cards_default_payment_account_id"
    if not _fk_exists(conn, "credit_cards", fk_name):
        op.create_foreign_key(
            fk_name,
            "credit_cards",
            "bank_accounts",
            ["default_payment_account_id"],
            ["id"],
        )


def downgrade() -> None:
    op.drop_constraint("fk_credit_cards_default_payment_account_id", "credit_cards", type_="foreignkey")
    op.drop_index(op.f("ix_credit_cards_default_payment_account_id"), table_name="credit_cards")
    op.drop_column("credit_cards", "default_payment_account_id")
