"""
Importa transações do CSV Meu Dinheiro como pagamentos únicos (one-time).
Usa data efetiva como data da transação e valor efetivo como valor.
Status: Conciliado -> reconciled, Pendente -> pending, Nconciliado/Confirmado -> processed.
Todas importadas como ONE_TIME (repetição do CSV ignorada para transações passadas).

- Saldo inicial: importado como receita na conta na data efetiva (conta criada com 0; a receita reflete o saldo de abertura).
- Transferência/Pagamento: direção inferida pelo sinal de Valor efetivo na conta da linha.
  Ex.: valor positivo em "3 Inter" significa entrada em "3 Inter" (origem = conta_transferencia).
- Deduplicação por ID Único (quando disponível).
- Deduplicação semântica adicional para transferências espelhadas (mesmo evento em duas linhas com IDs diferentes).
- Vincula category_id quando a categoria (nome + tipo) já existe em transaction_categories.

Rodar após create_accounts.py (contas e cartões já criados).
"""
import os
import sys
from pathlib import Path
from decimal import Decimal
from datetime import date as Date

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

from parse_csv import (
    iterar_linhas,
    is_usd_transfer_account,
)

CURRENCY = "BRL"
NOMAD_TARGET_BALANCE_JAN_2026 = Decimal("1012.93")
NOMAD_TARGET_DATE = Date(2026, 1, 31)
DEFAULT_BRL_USD_RATE = Decimal("5.70")
NOMAD_BASELINE_BRL_USD_RATE = Decimal("5.00")
NOMAD_MIN_BRL_USD_RATE = Decimal("4.00")
NOMAD_MAX_BRL_USD_RATE = Decimal("6.00")


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


def _carregar_mapa_conta_para_moeda(db, user_id: int) -> dict[str, str]:
    """
    Retorna mapa nome_conta -> moeda da conta/cartão.
    """
    mapa: dict[str, str] = {}
    for acc in db.query(BankAccount).filter(BankAccount.user_id == user_id).all():
        mapa[acc.name] = (acc.currency or CURRENCY).upper()
    for card in db.query(CreditCard).filter(CreditCard.user_id == user_id).all():
        mapa[card.name] = (card.currency or CURRENCY).upper()
    return mapa


def _tx_type_from_payment_category(payment_category: PaymentCategory) -> TransactionType:
    if payment_category == PaymentCategory.INCOME:
        return TransactionType.INCOME
    if payment_category == PaymentCategory.EXPENSE:
        return TransactionType.EXPENSE
    return TransactionType.TRANSFER


def _nome_categoria_csv(
    tipo: str,
    categoria_csv: str,
    subcategoria_csv: str,
    payment_category: PaymentCategory,
    categoria_override: str | None = None,
) -> str:
    if categoria_override:
        return categoria_override
    subcategoria_csv = (subcategoria_csv or "").strip()
    categoria_csv = (categoria_csv or "").strip()
    # Regra do import: quando há subcategoria, ela vira a categoria no app.
    if subcategoria_csv:
        return subcategoria_csv
    if categoria_csv:
        return categoria_csv
    if tipo == "Saldo inicial":
        return "Saldo inicial"
    if payment_category == PaymentCategory.TRANSFER:
        return "Transferência"
    if payment_category == PaymentCategory.INCOME:
        return "Sem categoria (Receita)"
    return "Sem categoria (Despesa)"


def _valor_data_lancamento(
    row: dict,
    usar_previsto_quando_sem_efetivo: bool,
) -> tuple[object | None, Decimal | None]:
    data_efetiva = row["data_efetiva"]
    valor_efetivo = row["valor_efetivo"]
    data_prevista = row["data_prevista"]
    valor_previsto = row["valor_previsto"]
    data_lancamento = data_efetiva or (data_prevista if usar_previsto_quando_sem_efetivo else None)
    valor_lancamento = valor_efetivo if valor_efetivo is not None else (
        valor_previsto if usar_previsto_quando_sem_efetivo else None
    )
    if valor_lancamento is None:
        return data_lancamento, None
    return data_lancamento, Decimal(str(valor_lancamento))


def _direcao_transferencia(
    conta: str,
    conta_transf: str,
    signed_amount: Decimal,
) -> tuple[str, str]:
    if signed_amount >= 0:
        return conta_transf, conta
    return conta, conta_transf


def _calcular_taxa_brl_usd_nomad(
    rows: list[dict],
    usar_previsto_quando_sem_efetivo: bool,
) -> Decimal:
    """
    Calcula taxa BRL->USD para transferências da Nomad com base no alvo
    de fechamento em 31/01/2026.
    """
    nomad_non_transfer = Decimal("0")
    nomad_transfer_net_brl = Decimal("0")

    for row in rows:
        conta = row["conta"]
        conta_transf = row["conta_transferencia"]
        if not (is_usd_transfer_account(conta) or is_usd_transfer_account(conta_transf)):
            continue

        data_lancamento, signed_amount = _valor_data_lancamento(row, usar_previsto_quando_sem_efetivo)
        if data_lancamento is None or signed_amount is None:
            continue
        if data_lancamento > NOMAD_TARGET_DATE:
            continue
        amount = abs(signed_amount)
        if amount == 0:
            continue

        tipo = row["tipo"].strip()
        if conta_transf:
            from_name, to_name = _direcao_transferencia(conta, conta_transf, signed_amount)
            if is_usd_transfer_account(to_name):
                nomad_transfer_net_brl += amount
            elif is_usd_transfer_account(from_name):
                nomad_transfer_net_brl -= amount
            continue

        if not is_usd_transfer_account(conta):
            continue
        if tipo in {"Receita", "Saldo inicial"}:
            nomad_non_transfer += amount
        elif tipo == "Despesa":
            nomad_non_transfer -= amount

    if nomad_transfer_net_brl == 0:
        return NOMAD_BASELINE_BRL_USD_RATE

    target_net_usd = NOMAD_TARGET_BALANCE_JAN_2026 - nomad_non_transfer
    if target_net_usd <= 0:
        return NOMAD_BASELINE_BRL_USD_RATE

    candidate_rate = nomad_transfer_net_brl / target_net_usd
    if candidate_rate <= 0:
        return NOMAD_BASELINE_BRL_USD_RATE

    # Requisito de negócio: conversões da Nomad ficam próximas de "dividir por 5".
    # Ajustamos com média simples para aproximar o saldo alvo sem distorcer por mês.
    if Decimal("3.00") <= candidate_rate <= Decimal("8.00"):
        blended = (NOMAD_BASELINE_BRL_USD_RATE + candidate_rate) / Decimal("2")
    else:
        blended = NOMAD_BASELINE_BRL_USD_RATE

    if blended < NOMAD_MIN_BRL_USD_RATE:
        return NOMAD_MIN_BRL_USD_RATE
    if blended > NOMAD_MAX_BRL_USD_RATE:
        return NOMAD_MAX_BRL_USD_RATE
    return blended


def _converter_brl_para_usd(valor_brl: Decimal, taxa_brl_usd: Decimal) -> Decimal:
    if taxa_brl_usd <= 0:
        return valor_brl
    return (valor_brl / taxa_brl_usd).quantize(Decimal("0.01"))


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
        conta_para_moeda = _carregar_mapa_conta_para_moeda(db, user_id)
        id_tipo_para_conta_nome = {v: k for k, v in conta_para_id.items()}
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
        transferencias_vistas: set[tuple] = set()
        rows = list(iterar_linhas(caminho_csv))
        taxa_brl_usd_nomad = _calcular_taxa_brl_usd_nomad(
            rows,
            usar_previsto_quando_sem_efetivo=usar_previsto_quando_sem_efetivo,
        )
        print(f"Taxa BRL->USD aplicada para Nomad: {taxa_brl_usd_nomad}")

        def _criar_payment_occurrence(
            *,
            amount_value: Decimal,
            currency_value: str,
            payment_category: PaymentCategory,
            category_id_value: int | None,
            from_type_value: str | None,
            from_id_value: int | None,
            to_type_value: str | None,
            to_id_value: int | None,
            description_value: str,
            status_value: PaymentStatus,
            data_value,
        ) -> None:
            nonlocal criados
            payment = Payment(
                user_id=user_id,
                payment_type=PaymentType.ONE_TIME,
                description=description_value[: 500] if len(description_value) > 500 else description_value,
                amount=amount_value,
                currency=currency_value,
                category=payment_category,
                category_id=category_id_value,
                from_account_type=from_type_value,
                from_account_id=from_id_value,
                to_account_type=to_type_value,
                to_account_id=to_id_value,
                due_date=data_value,
                status=status_value,
                processed_date=data_value
                if status_value in (PaymentStatus.RECONCILED, PaymentStatus.PROCESSED)
                else None,
                reconciled_date=data_value if status_value == PaymentStatus.RECONCILED else None,
            )
            db.add(payment)
            db.flush()
            occ = PaymentOccurrence(
                payment_id=payment.id,
                scheduled_date=data_value,
                due_date=data_value,
                amount=amount_value,
                status=status_value,
                processed_date=payment.processed_date,
                reconciled_date=payment.reconciled_date,
            )
            db.add(occ)
            criados += 1

        for row in rows:
            tipo = row["tipo"].strip()
            id_unico = row.get("id_unico", "").strip()
            if id_unico:
                if id_unico in ids_vistos:
                    ignorados += 1
                    continue
                ids_vistos.add(id_unico)
            data_lancamento, signed_amount = _valor_data_lancamento(
                row,
                usar_previsto_quando_sem_efetivo=usar_previsto_quando_sem_efetivo,
            )
            valor_lancamento = signed_amount

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
            elif conta_transf:
                if conta_transf not in conta_para_id:
                    ignorados += 1
                    continue
                conta_type, conta_id = conta_para_id.get(conta, (None, None))
                transf_type, transf_id = conta_para_id.get(conta_transf, (None, None))
                category = PaymentCategory.TRANSFER
                if signed_amount >= 0:
                    from_type, from_id = transf_type, transf_id
                    to_type, to_id = conta_type, conta_id
                else:
                    from_type, from_id = conta_type, conta_id
                    to_type, to_id = transf_type, transf_id
                if not from_type or not from_id or not to_type or not to_id:
                    ignorados += 1
                    continue
                # Alguns exports do Meu Dinheiro trazem a mesma transferência em duas linhas
                # (perspectiva de origem e destino, com IDs diferentes). Deduplicar semanticamente.
                transfer_key = (
                    data_lancamento,
                    amount,
                    from_type,
                    from_id,
                    to_type,
                    to_id,
                    descricao.strip().casefold(),
                )
                if transfer_key in transferencias_vistas:
                    ignorados += 1
                    continue
                transferencias_vistas.add(transfer_key)
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
            nome_categoria = _nome_categoria_csv(
                tipo,
                row["categoria"],
                row["subcategoria"],
                category,
            )
            category_id = categoria_map.get((tx_type.value, nome_categoria.casefold()))

            if dry_run:
                if (
                    category == PaymentCategory.TRANSFER
                    and from_type == "bank_account"
                    and to_type == "bank_account"
                    and from_id
                    and to_id
                ):
                    nome_from = id_tipo_para_conta_nome.get((from_type, from_id))
                    nome_to = id_tipo_para_conta_nome.get((to_type, to_id))
                    from_currency = (conta_para_moeda.get(nome_from or "", CURRENCY)).upper()
                    to_currency = (conta_para_moeda.get(nome_to or "", CURRENCY)).upper()
                    if from_currency != to_currency and (is_usd_transfer_account(nome_from or "") or is_usd_transfer_account(nome_to or "")):
                        criados += 2
                        continue
                criados += 1
                continue

            if (
                category == PaymentCategory.TRANSFER
                and from_type == "bank_account"
                and to_type == "bank_account"
                and from_id
                and to_id
            ):
                nome_from = id_tipo_para_conta_nome.get((from_type, from_id))
                nome_to = id_tipo_para_conta_nome.get((to_type, to_id))
                from_currency = (conta_para_moeda.get(nome_from or "", CURRENCY)).upper()
                to_currency = (conta_para_moeda.get(nome_to or "", CURRENCY)).upper()
                usd_on_from = is_usd_transfer_account(nome_from or "")
                usd_on_to = is_usd_transfer_account(nome_to or "")
                if from_currency != to_currency and (usd_on_from or usd_on_to):
                    usd_amount = _converter_brl_para_usd(amount, taxa_brl_usd_nomad)
                    if usd_on_to:
                        _criar_payment_occurrence(
                            amount_value=amount,
                            currency_value=from_currency,
                            payment_category=category,
                            category_id_value=category_id,
                            from_type_value=from_type,
                            from_id_value=from_id,
                            to_type_value=None,
                            to_id_value=None,
                            description_value=descricao,
                            status_value=status_app,
                            data_value=data_lancamento,
                        )
                        _criar_payment_occurrence(
                            amount_value=usd_amount,
                            currency_value=to_currency,
                            payment_category=category,
                            category_id_value=category_id,
                            from_type_value=None,
                            from_id_value=None,
                            to_type_value=to_type,
                            to_id_value=to_id,
                            description_value=descricao,
                            status_value=status_app,
                            data_value=data_lancamento,
                        )
                    elif usd_on_from:
                        _criar_payment_occurrence(
                            amount_value=usd_amount,
                            currency_value=from_currency,
                            payment_category=category,
                            category_id_value=category_id,
                            from_type_value=from_type,
                            from_id_value=from_id,
                            to_type_value=None,
                            to_id_value=None,
                            description_value=descricao,
                            status_value=status_app,
                            data_value=data_lancamento,
                        )
                        _criar_payment_occurrence(
                            amount_value=amount,
                            currency_value=to_currency,
                            payment_category=category,
                            category_id_value=category_id,
                            from_type_value=None,
                            from_id_value=None,
                            to_type_value=to_type,
                            to_id_value=to_id,
                            description_value=descricao,
                            status_value=status_app,
                            data_value=data_lancamento,
                        )
                else:
                    _criar_payment_occurrence(
                        amount_value=amount,
                        currency_value=currency,
                        payment_category=category,
                        category_id_value=category_id,
                        from_type_value=from_type,
                        from_id_value=from_id,
                        to_type_value=to_type,
                        to_id_value=to_id,
                        description_value=descricao,
                        status_value=status_app,
                        data_value=data_lancamento,
                    )
            else:
                _criar_payment_occurrence(
                    amount_value=amount,
                    currency_value=currency,
                    payment_category=category,
                    category_id_value=category_id,
                    from_type_value=from_type,
                    from_id_value=from_id,
                    to_type_value=to_type,
                    to_id_value=to_id,
                    description_value=descricao,
                    status_value=status_app,
                    data_value=data_lancamento,
                )

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
