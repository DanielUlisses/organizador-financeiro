"""Add transaction categories/tags and link to payments.

Revision ID: 003
Revises: 002
Create Date: 2026-02-19
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def _table_exists(conn, name: str) -> bool:
    result = conn.execute(sa.text("SELECT to_regclass(:name)"), {"name": f"public.{name}"})
    return result.scalar() is not None


def _index_exists(conn, name: str) -> bool:
    result = conn.execute(
        sa.text(
            """
            SELECT 1
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relkind = 'i' AND c.relname = :name AND n.nspname = 'public'
            """
        ),
        {"name": name},
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

    # Create enum types only if they do not exist (idempotent for re-runs)
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transactiontype') THEN
                CREATE TYPE transactiontype AS ENUM ('EXPENSE', 'INCOME', 'TRANSFER');
            END IF;
        END $$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'budgetscope') THEN
                CREATE TYPE budgetscope AS ENUM ('CURRENT_MONTH', 'ALL_MONTHS');
            END IF;
        END $$;
        """
    )

    if not _table_exists(conn, "transaction_categories"):
        op.create_table(
            "transaction_categories",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column(
                "transaction_type",
                ENUM("EXPENSE", "INCOME", "TRANSFER", name="transactiontype", create_type=False),
                nullable=False,
            ),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("color", sa.String(length=7), nullable=False, server_default="#5B8DEF"),
            sa.Column("budget", sa.Numeric(15, 2), nullable=True),
            sa.Column(
                "budget_scope",
                ENUM("CURRENT_MONTH", "ALL_MONTHS", name="budgetscope", create_type=False),
                nullable=False,
                server_default="ALL_MONTHS",
            ),
            sa.Column("budget_month", sa.Date(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id", "transaction_type", "name", "budget_month", name="uq_tx_category_scope"),
        )
        op.create_index(op.f("ix_transaction_categories_id"), "transaction_categories", ["id"], unique=False)
        op.create_index(op.f("ix_transaction_categories_user_id"), "transaction_categories", ["user_id"], unique=False)

    if not _table_exists(conn, "transaction_tags"):
        op.create_table(
            "transaction_tags",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("color", sa.String(length=7), nullable=False, server_default="#8B5CF6"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id", "name", name="uq_tx_tag_name"),
        )
        op.create_index(op.f("ix_transaction_tags_id"), "transaction_tags", ["id"], unique=False)
        op.create_index(op.f("ix_transaction_tags_user_id"), "transaction_tags", ["user_id"], unique=False)

    if not _table_exists(conn, "payment_tags"):
        op.create_table(
            "payment_tags",
            sa.Column("payment_id", sa.Integer(), nullable=False),
            sa.Column("tag_id", sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(["payment_id"], ["payments.id"]),
            sa.ForeignKeyConstraint(["tag_id"], ["transaction_tags.id"]),
            sa.PrimaryKeyConstraint("payment_id", "tag_id"),
        )

    # Add category_id to payments if not already present
    insp = sa.inspect(conn)
    table_names = insp.get_table_names(schema="public")
    if "payments" in table_names:
        col_names = [c["name"] for c in insp.get_columns("payments", schema="public")]
        if "category_id" not in col_names:
            op.add_column("payments", sa.Column("category_id", sa.Integer(), nullable=True))

        index_name = op.f("ix_payments_category_id")
        if not _index_exists(conn, index_name):
            op.create_index(index_name, "payments", ["category_id"], unique=False)

        fk_name = "fk_payments_category_id"
        if not _fk_exists(conn, "payments", fk_name):
            op.create_foreign_key(fk_name, "payments", "transaction_categories", ["category_id"], ["id"])


def downgrade() -> None:
    op.drop_constraint("fk_payments_category_id", "payments", type_="foreignkey")
    op.drop_index(op.f("ix_payments_category_id"), table_name="payments")
    op.drop_column("payments", "category_id")

    op.drop_table("payment_tags")

    op.drop_index(op.f("ix_transaction_tags_user_id"), table_name="transaction_tags")
    op.drop_index(op.f("ix_transaction_tags_id"), table_name="transaction_tags")
    op.drop_table("transaction_tags")

    op.drop_index(op.f("ix_transaction_categories_user_id"), table_name="transaction_categories")
    op.drop_index(op.f("ix_transaction_categories_id"), table_name="transaction_categories")
    op.drop_table("transaction_categories")

    op.execute("DROP TYPE IF EXISTS budgetscope")
    op.execute("DROP TYPE IF EXISTS transactiontype")
