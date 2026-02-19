"""Add investment asset type and fund CNPJ fields.

Revision ID: 005
Revises: 004
Create Date: 2026-02-19
"""
from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "investment_holdings",
        sa.Column(
            "asset_type",
            sa.Enum(
                "NATIONAL_TREASURY",
                "CDB_RDB",
                "STOCK",
                "FII",
                "FUND",
                "OTHER",
                name="investmentassettype",
            ),
            nullable=False,
            server_default="OTHER",
        ),
    )
    op.add_column("investment_holdings", sa.Column("fund_cnpj", sa.String(length=18), nullable=True))


def downgrade() -> None:
    op.drop_column("investment_holdings", "fund_cnpj")
    op.drop_column("investment_holdings", "asset_type")
    op.execute("DROP TYPE IF EXISTS investmentassettype")
