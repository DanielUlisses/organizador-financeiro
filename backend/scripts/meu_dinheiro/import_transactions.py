"""
Importa transações do CSV Meu Dinheiro como pagamentos únicos (one-time).
Usa data efetiva como data da transação e valor efetivo como valor.
Status: Conciliado -> reconciled, Pendente -> pending, Nconciliado/Confirmado -> processed.
Todas importadas como ONE_TIME (repetição do CSV ignorada para transações passadas).

- Saldo inicial: importado como receita na conta na data efetiva (conta criada com 0; a receita reflete o saldo de abertura).
- Transferência/Pagamento: direção inferida pelo sinal de Valor efetivo na conta da linha.
  Ex.: valor positivo em "3 Inter" significa entrada em "3 Inter" (origem = conta_transferencia).
- Deduplicação por ID Único (quando disponível).
- Vincula category_id quando a categoria (nome + tipo) já existe em transaction_categories.

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
from app.models.transaction_metadata import TransactionCategory, TransactionType

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


def _tx_type_from_payment_category(payment_category: PaymentCategory) -> TransactionType:
    if payment_category == PaymentCategory.INCOME:
        return TransactionType.INCOME
    if payment_category == PaymentCategory.EXPENSE:
        return TransactionType.EXPENSE
    return TransactionType.TRANSFER


def _nome_categoria_csv(tipo: str, categoria_csv: str, payment_category: PaymentCategory) -> str:
    categoria_csv = (categoria_csv or "").strip()
    if categoria_csv:
        return categoria_csv
    if tipo == "Saldo inicial":
        return "Saldo inicial"
    if payment_category == PaymentCategory.TRANSFER:
        return "Transferência"
    if payment_category == PaymentCategory.INCOME:
        return "Sem categoria (Receita)"
    return "Sem categoria (Despesa)"


def importar_transacoes(
    caminho_csv: str | Path,
    user_id: int,
    currency: str = CURRENCY,
    ignorar_sem_data_efetiva: bool = True,
    ignorar_sem_valor_efetivo: bool = True,
    usar_previsto_quando_sem_efetivo: bool = True,
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
        categorias = (
            db.query(TransactionCategory)
            .filter(TransactionCategory.user_id == user_id)
            .all()
        )
        categoria_map = {
            (c.transaction_type.value, c.name.casefold()): c.id for c in categorias
        }

        criados = 0
        ignorados = 0
        ids_vistos: set[str] = set()

        for row in iterar_linhas(caminho_csv):
            tipo = row["tipo"].strip()
            id_unico = row.get("id_unico", "").strip()
            if id_unico:
                if id_unico in ids_vistos:
                    ignorados += 1
                    continue
                ids_vistos.add(id_unico)
            data_efetiva = row["data_efetiva"]
            valor_efetivo = row["valor_efetivo"]
            data_prevista = row["data_prevista"]
            valor_previsto = row["valor_previsto"]

            data_lancamento = data_efetiva or (data_prevista if usar_previsto_quando_sem_efetivo else None)
            valor_lancamento = valor_efetivo if valor_efetivo is not None else (
                valor_previsto if usar_previsto_quando_sem_efetivo else None
            )

            if ignorar_sem_data_efetiva and not data_lancamento:
                ignorados += 1
                continue
            if ignorar_sem_valor_efetivo and (valor_lancamento is None or valor_lancamento == 0):
                ignorados += 1
                continue

            conta = row["conta"]
            conta_transf = row["conta_transferencia"]
            status_app = _status_meu_dinheiro_para_app(row["status"])
            # Sem efetivação no CSV = transação planejada/pendente
            if (row["data_efetiva"] is None or row["valor_efetivo"] is None) and usar_previsto_quando_sem_efetivo:
                status_app = PaymentStatus.PENDING
            descricao = row["descricao"] or "(sem descrição)"
            signed_amount = Decimal(str(valor_lancamento)) if valor_lancamento is not None else Decimal("0")
            amount = abs(signed_amount)
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
            # Transferência/Pagamento: direção depende do sinal em relação à conta da linha.
            # Ex.: em "3 Inter", Resgate com valor positivo significa entrada em 3 Inter (origem = conta_transferencia).
            elif conta_transf and conta_transf in conta_para_id:
                category = PaymentCategory.TRANSFER
                conta_type, conta_id = conta_para_id.get(conta, (None, None))
                transf_type, transf_id = conta_para_id.get(conta_transf, (None, None))
                if signed_amount >= 0:
                    from_type, from_id = transf_type, transf_id
                    to_type, to_id = conta_type, conta_id
                else:
                    from_type, from_id = conta_type, conta_id
                    to_type, to_id = transf_type, transf_id
                if not from_type or not from_id or not to_type or not to_id:
                    ignorados += 1
                    continue
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

            tx_type = _tx_type_from_payment_category(category)
            nome_categoria = _nome_categoria_csv(tipo, row["categoria"], category)
            category_id = categoria_map.get((tx_type.value, nome_categoria.casefold()))

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
                category_id=category_id,
                from_account_type=from_type,
                from_account_id=from_id,
                to_account_type=to_type,
                to_account_id=to_id,
                due_date=data_lancamento,
                status=status_app,
                processed_date=data_lancamento
                if status_app in (PaymentStatus.RECONCILED, PaymentStatus.PROCESSED)
                else None,
                reconciled_date=data_lancamento if status_app == PaymentStatus.RECONCILED else None,
            )
            db.add(payment)
            db.flush()

            occ = PaymentOccurrence(
                payment_id=payment.id,
                scheduled_date=data_lancamento,
                due_date=data_lancamento,
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
    p.add_argument("--importar-sem-data", action="store_true", help="Mantido por compatibilidade. Com fallback previsto ativo, usa Data prevista quando Data efetiva estiver vazia.")
    p.add_argument(
        "--somente-efetivo",
        action="store_true",
        help="Importa apenas linhas com Data efetiva e Valor efetivo (desliga fallback para previsto).",
    )
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
        usar_previsto_quando_sem_efetivo=not args.somente_efetivo,
        dry_run=args.dry_run,
    )
    print(f"Transações criadas: {criados} | Ignoradas: {ignorados}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
