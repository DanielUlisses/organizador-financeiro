"""Add investment asset type and fund CNPJ fields.

Revision ID: 005
Revises: 004
Create Date: 2026-02-19
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def _column_exists(insp: sa.Inspector, table_name: str, column_name: str) -> bool:
    return column_name in {col["name"] for col in insp.get_columns(table_name, schema="public")}


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'investmentassettype') THEN
                CREATE TYPE investmentassettype AS ENUM (
                    'NATIONAL_TREASURY',
                    'CDB_RDB',
                    'STOCK',
                    'FII',
                    'FUND',
                    'OTHER'
                );
            END IF;
        END $$;
        """
    )

    if not _column_exists(insp, "investment_holdings", "asset_type"):
        op.add_column(
            "investment_holdings",
            sa.Column(
                "asset_type",
                ENUM(
                    "NATIONAL_TREASURY",
                    "CDB_RDB",
                    "STOCK",
                    "FII",
                    "FUND",
                    "OTHER",
                    name="investmentassettype",
                    create_type=False,
                ),
                nullable=False,
                server_default="OTHER",
            ),
        )
    if not _column_exists(insp, "investment_holdings", "fund_cnpj"):
        op.add_column("investment_holdings", sa.Column("fund_cnpj", sa.String(length=18), nullable=True))


def downgrade() -> None:
    op.drop_column("investment_holdings", "fund_cnpj")
    op.drop_column("investment_holdings", "asset_type")
    op.execute("DROP TYPE IF EXISTS investmentassettype")
