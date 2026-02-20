"""
Recalcula bank_accounts.balance a partir das transações efetivadas.

- Considera apenas pagamentos com status RECONCILED ou PROCESSED
- Soma entradas (to_account_type='bank_account') e subtrai saídas (from_account_type='bank_account')
"""
import sys
from decimal import Decimal
from pathlib import Path

from sqlalchemy import func

# Garantir backend e pasta do script no path
_backend = Path(__file__).resolve().parents[2]
_script_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(_backend))
sys.path.insert(0, str(_script_dir))

from app.db import SessionLocal
from app.models.bank_account import BankAccount
from app.models.payment import Payment, PaymentStatus


EFFECTIVE_STATUSES = [PaymentStatus.RECONCILED, PaymentStatus.PROCESSED]


def recalculate_bank_balances(user_id: int | None = None, dry_run: bool = False) -> int:
    db = SessionLocal()
    try:
        query = db.query(BankAccount)
        if user_id is not None:
            query = query.filter(BankAccount.user_id == user_id)
        accounts = query.all()

        updated = 0
        for acc in accounts:
            incoming_query = db.query(
                func.coalesce(func.sum(Payment.amount), 0)
            ).filter(
                Payment.status.in_(EFFECTIVE_STATUSES),
                Payment.to_account_type == "bank_account",
                Payment.to_account_id == acc.id,
            )
            incoming = incoming_query.scalar() or Decimal("0")

            outgoing_query = db.query(
                func.coalesce(func.sum(Payment.amount), 0)
            ).filter(
                Payment.status.in_(EFFECTIVE_STATUSES),
                Payment.from_account_type == "bank_account",
                Payment.from_account_id == acc.id,
            )
            outgoing = outgoing_query.scalar() or Decimal("0")

            new_balance = Decimal(incoming) - Decimal(outgoing)
            if Decimal(acc.balance) != new_balance:
                updated += 1
                if dry_run:
                    print(f"[DRY-RUN] {acc.name}: {acc.balance} -> {new_balance}")
                else:
                    acc.balance = new_balance
                    print(f"{acc.name}: {new_balance}")

        if not dry_run:
            db.commit()
        return updated
    finally:
        db.close()


def main() -> int:
    import argparse
    p = argparse.ArgumentParser(description="Recalcula bank_accounts.balance com base em payments efetivados")
    p.add_argument("--user-id", type=int, default=None, help="Filtrar usuário (opcional)")
    p.add_argument("--dry-run", action="store_true", help="Apenas mostrar mudanças")
    args = p.parse_args()

    updated = recalculate_bank_balances(user_id=args.user_id, dry_run=args.dry_run)
    print(f"Contas atualizadas: {updated}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
