"""
Importa transações do CSV Meu Dinheiro como pagamentos únicos (one-time).
Usa data efetiva como data da transação e valor efetivo como valor.
Status: Conciliado -> reconciled, Pendente -> pending, Nconciliado/Confirmado -> processed.
Todas importadas como ONE_TIME (repetição do CSV ignorada para transações passadas).

- Saldo inicial: importado como receita na conta na data efetiva (conta criada com 0; a receita reflete o saldo de abertura).
- Transferência/Pagamento: uma única transação por par origem/destino (deduplicação por data, valor e contas).

Rodar após create_accounts.py (contas e cartões já criados).
"""
import os
import sys
from pathlib import Path
from decimal import Decimal

# Garantir backend e pasta do script no path
_backend = Path(__file__).resolve().parents[2]
_script_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(_backend))
sys.path.insert(0, str(_script_dir))

from app.db import SessionLocal
from app.models.user import User
from app.models.bank_account import BankAccount
from app.models.credit_card import CreditCard
from app.models.payment import (
    Payment,
    PaymentOccurrence,
    PaymentType,
    PaymentStatus,
    PaymentCategory,
)

from parse_csv import iterar_linhas

CURRENCY = "BRL"


def _status_meu_dinheiro_para_app(status: str) -> PaymentStatus:
    """Mapeia status do CSV para PaymentStatus do app."""
    m = {
        "Conciliado": PaymentStatus.RECONCILED,
        "Pendente": PaymentStatus.PENDING,
        "Nconciliado": PaymentStatus.PROCESSED,
        "Confirmado": PaymentStatus.PROCESSED,
    }
    return m.get(status.strip(), PaymentStatus.PROCESSED)


def _carregar_mapa_conta_para_id(db, user_id: int) -> dict[str, tuple[str, int]]:
    """
    Retorna mapa nome_conta -> (account_type, account_id).
    account_type é "bank_account" ou "credit_card".
    """
    mapa: dict[str, tuple[str, int]] = {}
    for acc in db.query(BankAccount).filter(BankAccount.user_id == user_id).all():
        mapa[acc.name] = ("bank_account", acc.id)
    for card in db.query(CreditCard).filter(CreditCard.user_id == user_id).all():
        mapa[card.name] = ("credit_card", card.id)
    return mapa


def importar_transacoes(
    caminho_csv: str | Path,
    user_id: int,
    currency: str = CURRENCY,
    ignorar_sem_data_efetiva: bool = True,
    ignorar_sem_valor_efetivo: bool = True,
    dry_run: bool = False,
    batch_size: int = 500,
) -> tuple[int, int]:
    """
    Importa todas as linhas do CSV como Payment (ONE_TIME) + PaymentOccurrence.
    Retorna (criados, ignorados).
    """
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise RuntimeError(f"User id={user_id} não encontrado.")

        conta_para_id = _carregar_mapa_conta_para_id(db, user_id)
        if not conta_para_id:
            raise RuntimeError(
                "Nenhuma conta/cartão encontrada para o usuário. Rode create_accounts.py antes."
            )

        criados = 0
        ignorados = 0
        # Evitar duplicar transferências: uma única transação por (data, valor, conta_origem, conta_destino)
        transfer_keys: set[tuple] = set()

        for row in iterar_linhas(caminho_csv):
            tipo = row["tipo"].strip()
            data_efetiva = row["data_efetiva"]
            valor_efetivo = row["valor_efetivo"]
            if ignorar_sem_data_efetiva and not data_efetiva:
                ignorados += 1
                continue
            if ignorar_sem_valor_efetivo and (valor_efetivo is None or valor_efetivo == 0):
                ignorados += 1
                continue

            conta = row["conta"]
            conta_transf = row["conta_transferencia"]
            status_app = _status_meu_dinheiro_para_app(row["status"])
            descricao = row["descricao"] or "(sem descrição)"
            amount = abs(Decimal(str(valor_efetivo))) if valor_efetivo is not None else Decimal("0")
            if amount == 0:
                ignorados += 1
                continue

            # Saldo inicial = receita na conta na data efetiva (abertura de conta fora de jan/2024)
            if tipo == "Saldo inicial":
                category = PaymentCategory.INCOME
                from_type, from_id = None, None
                to_type, to_id = conta_para_id.get(conta, (None, None))
                if not to_type or not to_id:
                    ignorados += 1
                    continue
                descricao = "Saldo inicial"
            # Transferência e Pagamento: uma única transação por par origem/destino (evitar duplicata em origem e destino)
            elif conta_transf and conta_transf in conta_para_id:
                category = PaymentCategory.TRANSFER
                from_type, from_id = conta_para_id.get(conta, (None, None))
                to_type, to_id = conta_para_id.get(conta_transf, (None, None))
                if not from_type or not from_id or not to_type or not to_id:
                    ignorados += 1
                    continue
                # Chave canônica para deduplicar: (data, valor, id_menor, id_maior) — mesma transferência em A→B e B→A
                key = (data_efetiva, amount, min(from_id, to_id), max(from_id, to_id))
                if key in transfer_keys:
                    ignorados += 1
                    continue
                transfer_keys.add(key)
            elif tipo == "Receita":
                category = PaymentCategory.INCOME
                from_type, from_id = None, None
                to_type, to_id = conta_para_id.get(conta, (None, None))
                if not to_type or not to_id:
                    ignorados += 1
                    continue
            elif tipo == "Despesa":
                category = PaymentCategory.EXPENSE
                from_type, from_id = conta_para_id.get(conta, (None, None))
                to_type, to_id = None, None
                if not from_type or not from_id:
                    ignorados += 1
                    continue
            else:
                ignorados += 1
                continue

            if dry_run:
                criados += 1
                continue

            payment = Payment(
                user_id=user_id,
                payment_type=PaymentType.ONE_TIME,
                description=descricao[: 500] if len(descricao) > 500 else descricao,
                amount=amount,
                currency=currency,
                category=category,
                from_account_type=from_type,
                from_account_id=from_id,
                to_account_type=to_type,
                to_account_id=to_id,
                due_date=data_efetiva,
                status=status_app,
                processed_date=data_efetiva
                if status_app in (PaymentStatus.RECONCILED, PaymentStatus.PROCESSED)
                else None,
                reconciled_date=data_efetiva if status_app == PaymentStatus.RECONCILED else None,
            )
            db.add(payment)
            db.flush()

            occ = PaymentOccurrence(
                payment_id=payment.id,
                scheduled_date=data_efetiva,
                due_date=data_efetiva,
                amount=amount,
                status=status_app,
                processed_date=payment.processed_date,
                reconciled_date=payment.reconciled_date,
            )
            db.add(occ)
            criados += 1

            if criados % batch_size == 0:
                db.commit()
                print(f"  Commit batch: {criados} transações...")

        if not dry_run and criados % batch_size != 0:
            db.commit()
        return criados, ignorados
    finally:
        db.close()


def main() -> int:
    import argparse
    p = argparse.ArgumentParser(description="Importa transações do CSV Meu Dinheiro")
    p.add_argument("csv", nargs="?", default="", help="Caminho do CSV (ou MEU_DINHEIRO_CSV)")
    p.add_argument("--user-id", type=int, default=1, help="ID do usuário (default: 1)")
    p.add_argument("--dry-run", action="store_true", help="Só contar, não inserir")
    p.add_argument("--importar-sem-data", action="store_true", help="Incluir linhas sem data efetiva (usa data prevista ou hoje)")
    args = p.parse_args()

    csv_path = args.csv or os.environ.get("MEU_DINHEIRO_CSV")
    if not csv_path or not Path(csv_path).exists():
        print("Erro: informe o caminho do CSV (argumento ou MEU_DINHEIRO_CSV).", file=sys.stderr)
        return 1

    print(f"CSV: {csv_path} | user_id={args.user_id} | dry_run={args.dry_run}")
    criados, ignorados = importar_transacoes(
        csv_path,
        args.user_id,
        ignorar_sem_data_efetiva=not args.importar_sem_data,
        dry_run=args.dry_run,
    )
    print(f"Transações criadas: {criados} | Ignoradas: {ignorados}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
