"""
Cria contas bancárias e cartões de crédito a partir do CSV Meu Dinheiro.
Uso: apenas na primeira carga. Rodar após ter um user no banco.

Regras:
- Conta contendo "TPC" -> cartão Amex (American Express)
- "Mastercard Black" -> cartão Mastercard
- "Visa Infinity" -> cartão Visa
- "Carteira de investimentos" -> conta poupança (savings)
- Demais contas -> conta corrente (checking)

Cartões adicionais (mesmo nome de conta, outro Cartão no CSV): não criamos cartão
separado; usamos um cartão por nome de conta e opcionalmente guardamos os 4 dígitos
do primeiro Cartão visto como referência (card_number_last4).
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
from app.models.user import User
from app.models.bank_account import BankAccount, AccountType
from app.models.credit_card import CreditCard

from parse_csv import (
    iterar_linhas,
    contas_todas_unicas,
    is_usd_transfer_account,
)


# Defaults para cartões (não temos no CSV)
INVOICE_CLOSE_DAY = 10
PAYMENT_DUE_DAY = 15
CREDIT_LIMIT_DEFAULT = 0
CURRENCY = "BRL"


def _classificar_conta(nome: str) -> tuple[str, str | None]:
    """
    Retorna (tipo, bandeira).
    tipo: "bank_checking" | "bank_savings" | "credit_card"
    bandeira: None | "amex" | "mastercard" | "visa"
    """
    nome_lower = nome.lower()
    if "tpc" in nome_lower:
        return "credit_card", "amex"
    if "mastercard black" in nome_lower:
        return "credit_card", "mastercard"
    if "visa infinity" in nome_lower:
        return "credit_card", "visa"
    if "carteira de investimentos" in nome_lower:
        return "bank_savings", None
    return "bank_checking", None


def _primeiro_last4_por_conta(caminho_csv: str | Path) -> dict[str, str]:
    """Para cada nome de conta que é cartão, retorna o primeiro last4 visto no campo Cartão."""
    resultado: dict[str, str] = {}
    for row in iterar_linhas(caminho_csv):
        nome = row["conta"]
        if not nome:
            continue
        tipo, _ = _classificar_conta(nome)
        if tipo != "credit_card":
            continue
        last4 = row.get("cartao_last4")
        if last4 and nome not in resultado:
            resultado[nome] = last4
    return resultado


def criar_contas(
    caminho_csv: str | Path,
    user_id: int,
    currency: str = CURRENCY,
    dry_run: bool = False,
) -> dict[str, int]:
    """
    Cria bank_accounts e credit_cards para todas as contas únicas do CSV.
    Retorna um mapeamento nome_conta -> id (bank_account ou credit_card, conforme o tipo).
    """
    contas = sorted(contas_todas_unicas(caminho_csv))
    if not contas:
        return {}

    # last4 só para contas que são cartão (iterar usa Conta, não Conta transferência)
    last4_por_conta = _primeiro_last4_por_conta(caminho_csv)

    db = SessionLocal()
    try:
        # Verificar user
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise RuntimeError(f"User id={user_id} não encontrado.")

        nome_to_id: dict[str, int] = {}

        for nome in contas:
            tipo, bandeira = _classificar_conta(nome)
            account_currency = "USD" if is_usd_transfer_account(nome) else currency

            if tipo == "bank_checking":
                existing = db.query(BankAccount).filter(
                    BankAccount.user_id == user_id,
                    BankAccount.name == nome,
                ).first()
                if existing:
                    if existing.currency != account_currency and not dry_run:
                        existing.currency = account_currency
                        print(f"  Atualizada moeda da conta: {nome} -> {account_currency}")
                    nome_to_id[nome] = existing.id
                    if not dry_run:
                        print(f"  Conta corrente já existe: {nome} (id={existing.id})")
                    continue
                if dry_run:
                    print(f"  [DRY-RUN] Criaria conta corrente: {nome}")
                    continue
                acc = BankAccount(
                    user_id=user_id,
                    name=nome,
                    account_type=AccountType.CHECKING,
                    bank_name=None,
                    balance=0,
                    currency=account_currency,
                )
                db.add(acc)
                db.flush()
                nome_to_id[nome] = acc.id
                print(f"  Criada conta corrente: {nome} (id={acc.id})")

            elif tipo == "bank_savings":
                existing = db.query(BankAccount).filter(
                    BankAccount.user_id == user_id,
                    BankAccount.name == nome,
                ).first()
                if existing:
                    if existing.currency != account_currency and not dry_run:
                        existing.currency = account_currency
                        print(f"  Atualizada moeda da conta: {nome} -> {account_currency}")
                    nome_to_id[nome] = existing.id
                    if not dry_run:
                        print(f"  Poupança já existe: {nome} (id={existing.id})")
                    continue
                if dry_run:
                    print(f"  [DRY-RUN] Criaria poupança: {nome}")
                    continue
                acc = BankAccount(
                    user_id=user_id,
                    name=nome,
                    account_type=AccountType.SAVINGS,
                    bank_name=None,
                    balance=0,
                    currency=account_currency,
                )
                db.add(acc)
                db.flush()
                nome_to_id[nome] = acc.id
                print(f"  Criada poupança: {nome} (id={acc.id})")

            else:
                # credit_card
                existing = db.query(CreditCard).filter(
                    CreditCard.user_id == user_id,
                    CreditCard.name == nome,
                ).first()
                if existing:
                    nome_to_id[nome] = existing.id
                    if not dry_run:
                        print(f"  Cartão já existe: {nome} (id={existing.id})")
                    continue
                if dry_run:
                    print(f"  [DRY-RUN] Criaria cartão: {nome} ({bandeira})")
                    continue
                issuer = {"amex": "American Express", "mastercard": "Mastercard", "visa": "Visa"}.get(
                    bandeira, None
                )
                last4 = last4_por_conta.get(nome)
                card = CreditCard(
                    user_id=user_id,
                    name=nome,
                    issuer=issuer,
                    card_network=bandeira,
                    card_number_last4=last4,
                    credit_limit=CREDIT_LIMIT_DEFAULT,
                    current_balance=0,
                    invoice_close_day=INVOICE_CLOSE_DAY,
                    payment_due_day=PAYMENT_DUE_DAY,
                    currency=currency,
                )
                db.add(card)
                db.flush()
                nome_to_id[nome] = card.id
                print(f"  Criado cartão: {nome} ({bandeira}) id={card.id}")

        if not dry_run:
            db.commit()
        return nome_to_id
    finally:
        db.close()


def main() -> int:
    import argparse
    p = argparse.ArgumentParser(description="Cria contas e cartões a partir do CSV Meu Dinheiro")
    p.add_argument("csv", nargs="?", default="", help="Caminho do CSV (ou use MEU_DINHEIRO_CSV)")
    p.add_argument("--user-id", type=int, default=1, help="ID do usuário (default: 1)")
    p.add_argument("--dry-run", action="store_true", help="Apenas listar o que seria criado")
    args = p.parse_args()

    csv_path = args.csv or os.environ.get("MEU_DINHEIRO_CSV")
    if not csv_path or not Path(csv_path).exists():
        print("Erro: informe o caminho do CSV (argumento ou MEU_DINHEIRO_CSV).", file=sys.stderr)
        return 1

    print(f"CSV: {csv_path} | user_id={args.user_id} | dry_run={args.dry_run}")
    criar_contas(csv_path, args.user_id, dry_run=args.dry_run)
    return 0


if __name__ == "__main__":
    sys.exit(main())
