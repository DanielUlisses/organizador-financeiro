"""Add bank account color and credit card network.

Revision ID: 006
Revises: 005
Create Date: 2026-02-19

"""
from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def _column_exists(insp: sa.Inspector, table_name: str, column_name: str) -> bool:
    return column_name in {col["name"] for col in insp.get_columns(table_name, schema="public")}


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    if not _column_exists(insp, "bank_accounts", "color"):
        op.add_column("bank_accounts", sa.Column("color", sa.String(length=7), nullable=True))
    if not _column_exists(insp, "credit_cards", "card_network"):
        op.add_column("credit_cards", sa.Column("card_network", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("credit_cards", "card_network")
    op.drop_column("bank_accounts", "color")
