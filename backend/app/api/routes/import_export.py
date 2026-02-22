"""Backup import/export routes."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select, text
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.bank_account import BankAccount
from app.models.credit_card import CreditCard
from app.models.payment import Payment, PaymentOccurrence, RecurringPaymentOverride
from app.models.transaction_metadata import TransactionCategory, TransactionTag, payment_tags
from app.schemas.import_export import (
    BACKUP_VERSION,
    BackupData,
    BackupExportResponse,
    BackupImportRequest,
    BackupImportResponse,
)

router = APIRouter(prefix="/import-export", tags=["import-export"])


def _reset_sequences_if_needed(db: Session) -> None:
    bind = db.get_bind()
    if bind is None or bind.dialect.name != "postgresql":
        return

    tables = [
        "bank_accounts",
        "credit_cards",
        "transaction_categories",
        "transaction_tags",
        "payments",
        "payment_occurrences",
        "recurring_payment_overrides",
    ]
    for table_name in tables:
        db.execute(
            text(
                f"SELECT setval(pg_get_serial_sequence('{table_name}', 'id'), "
                f"COALESCE((SELECT MAX(id) + 1 FROM {table_name}), 1), false)"
            )
        )


def _validate_backup_data(data: BackupData) -> None:
    payment_ids = {item.id for item in data.payments}
    tag_ids = {item.id for item in data.tags}
    category_ids = {item.id for item in data.categories}

    for payment in data.payments:
        if payment.category_id is not None and payment.category_id not in category_ids:
            raise HTTPException(
                status_code=400,
                detail=f"Payment {payment.id} references unknown category_id={payment.category_id}",
            )

    for payment_tag in data.payment_tags:
        if payment_tag.payment_id not in payment_ids:
            raise HTTPException(
                status_code=400,
                detail=f"payment_tags references unknown payment_id={payment_tag.payment_id}",
            )
        if payment_tag.tag_id not in tag_ids:
            raise HTTPException(
                status_code=400,
                detail=f"payment_tags references unknown tag_id={payment_tag.tag_id}",
            )

    for occurrence in data.payment_occurrences:
        if occurrence.payment_id not in payment_ids:
            raise HTTPException(
                status_code=400,
                detail=f"payment_occurrences references unknown payment_id={occurrence.payment_id}",
            )

    for override in data.recurring_payment_overrides:
        if override.payment_id not in payment_ids:
            raise HTTPException(
                status_code=400,
                detail=f"recurring_payment_overrides references unknown payment_id={override.payment_id}",
            )


@router.get("/export", response_model=BackupExportResponse)
def export_backup(user_id: int, db: Session = Depends(get_db)):
    bank_accounts = db.scalars(
        select(BankAccount).where(BankAccount.user_id == user_id).order_by(BankAccount.id)
    ).all()
    credit_cards = db.scalars(
        select(CreditCard).where(CreditCard.user_id == user_id).order_by(CreditCard.id)
    ).all()
    categories = db.scalars(
        select(TransactionCategory).where(TransactionCategory.user_id == user_id).order_by(TransactionCategory.id)
    ).all()
    tags = db.scalars(select(TransactionTag).where(TransactionTag.user_id == user_id).order_by(TransactionTag.id)).all()
    payments = db.scalars(select(Payment).where(Payment.user_id == user_id).order_by(Payment.id)).all()

    payment_ids_query = select(Payment.id).where(Payment.user_id == user_id)
    payment_occurrences = db.scalars(
        select(PaymentOccurrence)
        .where(PaymentOccurrence.payment_id.in_(payment_ids_query))
        .order_by(PaymentOccurrence.id)
    ).all()
    recurring_overrides = db.scalars(
        select(RecurringPaymentOverride)
        .where(RecurringPaymentOverride.payment_id.in_(payment_ids_query))
        .order_by(RecurringPaymentOverride.id)
    ).all()
    payment_tag_rows = db.execute(
        select(payment_tags.c.payment_id, payment_tags.c.tag_id).where(
            payment_tags.c.payment_id.in_(payment_ids_query)
        )
    ).all()

    return {
        "version": BACKUP_VERSION,
        "exported_at": datetime.now(timezone.utc),
        "data": {
            "bank_accounts": bank_accounts,
            "credit_cards": credit_cards,
            "categories": categories,
            "tags": tags,
            "payments": payments,
            "payment_occurrences": payment_occurrences,
            "recurring_payment_overrides": recurring_overrides,
            "payment_tags": [
                {"payment_id": row.payment_id, "tag_id": row.tag_id} for row in payment_tag_rows
            ],
        },
    }


@router.post("/import", response_model=BackupImportResponse)
def import_backup(user_id: int, payload: BackupImportRequest, db: Session = Depends(get_db)):
    if payload.version != BACKUP_VERSION:
        raise HTTPException(status_code=400, detail=f"Unsupported backup version: {payload.version}")

    _validate_backup_data(payload.data)

    try:
        user_payment_ids = select(Payment.id).where(Payment.user_id == user_id)

        db.execute(delete(payment_tags).where(payment_tags.c.payment_id.in_(user_payment_ids)))
        db.execute(delete(PaymentOccurrence).where(PaymentOccurrence.payment_id.in_(user_payment_ids)))
        db.execute(delete(RecurringPaymentOverride).where(RecurringPaymentOverride.payment_id.in_(user_payment_ids)))
        db.execute(delete(Payment).where(Payment.user_id == user_id))
        db.execute(delete(CreditCard).where(CreditCard.user_id == user_id))
        db.execute(delete(BankAccount).where(BankAccount.user_id == user_id))
        db.execute(delete(TransactionCategory).where(TransactionCategory.user_id == user_id))
        db.execute(delete(TransactionTag).where(TransactionTag.user_id == user_id))

        for item in payload.data.bank_accounts:
            db.add(
                BankAccount(
                    id=item.id,
                    user_id=user_id,
                    name=item.name,
                    account_type=item.account_type,
                    bank_name=item.bank_name,
                    account_number_last4=item.account_number_last4,
                    balance=item.balance,
                    currency=item.currency,
                    color=item.color,
                    is_active=item.is_active,
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                )
            )

        for item in payload.data.credit_cards:
            db.add(
                CreditCard(
                    id=item.id,
                    user_id=user_id,
                    name=item.name,
                    issuer=item.issuer,
                    card_network=item.card_network,
                    card_number_last4=item.card_number_last4,
                    credit_limit=item.credit_limit,
                    current_balance=item.current_balance,
                    default_payment_account_id=item.default_payment_account_id,
                    invoice_close_day=item.invoice_close_day,
                    payment_due_day=item.payment_due_day,
                    currency=item.currency,
                    is_active=item.is_active,
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                )
            )

        for item in payload.data.categories:
            db.add(
                TransactionCategory(
                    id=item.id,
                    user_id=user_id,
                    transaction_type=item.transaction_type,
                    name=item.name,
                    color=item.color,
                    icon=item.icon,
                    budget=item.budget,
                    budget_scope=item.budget_scope,
                    budget_month=item.budget_month,
                    is_active=item.is_active,
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                )
            )

        for item in payload.data.tags:
            db.add(
                TransactionTag(
                    id=item.id,
                    user_id=user_id,
                    name=item.name,
                    color=item.color,
                    is_active=item.is_active,
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                )
            )

        for item in payload.data.payments:
            db.add(
                Payment(
                    id=item.id,
                    user_id=user_id,
                    payment_type=item.payment_type,
                    description=item.description,
                    amount=item.amount,
                    currency=item.currency,
                    category=item.category,
                    category_id=item.category_id,
                    from_account_type=item.from_account_type,
                    from_account_id=item.from_account_id,
                    to_account_type=item.to_account_type,
                    to_account_id=item.to_account_id,
                    due_date=item.due_date,
                    frequency=item.frequency,
                    start_date=item.start_date,
                    end_date=item.end_date,
                    next_due_date=item.next_due_date,
                    status=item.status,
                    processed_date=item.processed_date,
                    reconciled_date=item.reconciled_date,
                    notes=item.notes,
                    is_active=item.is_active,
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                )
            )

        for item in payload.data.payment_occurrences:
            db.add(
                PaymentOccurrence(
                    id=item.id,
                    payment_id=item.payment_id,
                    scheduled_date=item.scheduled_date,
                    due_date=item.due_date,
                    amount=item.amount,
                    status=item.status,
                    processed_date=item.processed_date,
                    reconciled_date=item.reconciled_date,
                    notes=item.notes,
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                )
            )

        for item in payload.data.recurring_payment_overrides:
            db.add(
                RecurringPaymentOverride(
                    id=item.id,
                    payment_id=item.payment_id,
                    override_type=item.override_type,
                    target_date=item.target_date,
                    effective_date=item.effective_date,
                    end_date=item.end_date,
                    occurrence_count=item.occurrence_count,
                    new_amount=item.new_amount,
                    new_due_date=item.new_due_date,
                    is_active=item.is_active,
                    notes=item.notes,
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                )
            )

        if payload.data.payment_tags:
            db.execute(
                payment_tags.insert(),
                [
                    {"payment_id": item.payment_id, "tag_id": item.tag_id}
                    for item in payload.data.payment_tags
                ],
            )

        _reset_sequences_if_needed(db)
        db.commit()
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to import backup: {exc}") from exc

    return {
        "status": "ok",
        "imported_at": datetime.now(timezone.utc),
    }
