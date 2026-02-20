"""
Arquiva contas bancárias de investimento após o import completo.

Objetivo:
- manter o histórico/transações referenciando essas contas;
- ocultar essas contas da UI operacional (bank-accounts);
- evitar que saldos dessas contas entrem nos cards/charts operacionais.
"""
import os
import sys
from pathlib import Path

# Garantir backend e pasta do script no path
_backend = Path(__file__).resolve().parents[2]
_script_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(_backend))
sys.path.insert(0, str(_script_dir))

from app.db import SessionLocal
from app.models.bank_account import BankAccount
from parse_csv import is_investment_transfer_account


def archive_investment_accounts(user_id: int, dry_run: bool = False) -> tuple[int, int]:
    db = SessionLocal()
    try:
        accounts = db.query(BankAccount).filter(BankAccount.user_id == user_id).all()
        matched = 0
        archived = 0

        for acc in accounts:
            if not is_investment_transfer_account(acc.name):
                continue
            matched += 1
            if acc.is_active:
                archived += 1
                if dry_run:
                    print(f"[DRY-RUN] Arquivaria: {acc.name} (id={acc.id})")
                else:
                    acc.is_active = False
                    print(f"Arquivada: {acc.name} (id={acc.id})")
            else:
                print(f"Já arquivada: {acc.name} (id={acc.id})")

        if not dry_run:
            db.commit()
        return matched, archived
    finally:
        db.close()


def main() -> int:
    import argparse

    p = argparse.ArgumentParser(description="Arquiva contas de investimento importadas do Meu Dinheiro")
    p.add_argument("--user-id", type=int, default=1, help="ID do usuário (default: 1)")
    p.add_argument("--dry-run", action="store_true", help="Apenas listar sem atualizar")
    args = p.parse_args()

    matched, archived = archive_investment_accounts(user_id=args.user_id, dry_run=args.dry_run)
    print(f"Contas de investimento encontradas: {matched} | Arquivadas agora: {archived}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
