"""Add icon field to transaction categories.

Revision ID: 008
Revises: 007
Create Date: 2026-02-20
"""
from alembic import op
import sqlalchemy as sa

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    columns = {c["name"] for c in insp.get_columns("transaction_categories", schema="public")}
    if "icon" not in columns:
        op.add_column(
            "transaction_categories",
            sa.Column("icon", sa.String(length=40), nullable=False, server_default="folder"),
        )
        op.execute("UPDATE transaction_categories SET icon = 'folder' WHERE icon IS NULL OR icon = ''")
        op.alter_column("transaction_categories", "icon", server_default=None)


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    columns = {c["name"] for c in insp.get_columns("transaction_categories", schema="public")}
    if "icon" in columns:
        op.drop_column("transaction_categories", "icon")

