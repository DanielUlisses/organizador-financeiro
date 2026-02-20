"""Add user profile_image_path.

Revision ID: 007
Revises: 006
Create Date: 2026-02-19

"""
from alembic import op
import sqlalchemy as sa

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def _column_exists(insp: sa.Inspector, table_name: str, column_name: str) -> bool:
    return column_name in {col["name"] for col in insp.get_columns(table_name, schema="public")}


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    if not _column_exists(insp, "users", "profile_image_path"):
        op.add_column("users", sa.Column("profile_image_path", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "profile_image_path")
