"""
Cria/atualiza categorias de transação (transaction_categories) a partir do CSV Meu Dinheiro.

- Uma categoria por (transaction_type, nome da categoria do CSV)
- Define cor e ícone de forma determinística
- Não remove categorias existentes; faz upsert (create/update)
"""
import hashlib
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
from app.models.transaction_metadata import TransactionCategory, TransactionType

from parse_csv import iterar_linhas


PALETTE = [
    "#5B8DEF",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#06B6D4",
    "#84CC16",
    "#F97316",
    "#14B8A6",
    "#EC4899",
]

ICON_RULES: list[tuple[tuple[str, ...], str]] = [
    (("transfer", "transf", "resgate", "aporte", "cartão", "cartao"), "repeat"),
    (("aluguel", "imovel", "imóveis", "moradia", "condominio", "condomínio"), "home"),
    (("salário", "salario", "pró-labore", "pro-labore", "invoice"), "briefcase"),
    (("invest", "dividend", "juros", "rendimento"), "trending-up"),
    (("seguro", "imposto", "taxa", "taxas"), "shield"),
    (("viagem", "lazer", "milhas"), "plane"),
    (("saúde", "saude", "odonto", "dental"), "heart"),
    (("educação", "educacao", "curso", "escola"), "graduation-cap"),
    (("mercado", "aliment", "restaurante", "ifood"), "utensils"),
    (("carro", "combust", "gasolina", "uber"), "car"),
]


def _tx_type_from_row(tipo: str, conta_transferencia: str) -> TransactionType:
    if conta_transferencia:
        return TransactionType.TRANSFER
    if tipo == "Transferência" or tipo == "Pagamento":
        return TransactionType.TRANSFER
    if tipo == "Receita" or tipo == "Saldo inicial":
        return TransactionType.INCOME
    return TransactionType.EXPENSE


def _category_name(tipo: str, categoria_csv: str, subcategoria_csv: str, tx_type: TransactionType) -> str:
    subcategoria_csv = (subcategoria_csv or "").strip()
    categoria_csv = (categoria_csv or "").strip()
    # Regra do import: quando há subcategoria, ela vira a categoria no app.
    if subcategoria_csv:
        return subcategoria_csv
    if categoria_csv:
        return categoria_csv
    if tipo == "Saldo inicial":
        return "Saldo inicial"
    if tx_type == TransactionType.TRANSFER:
        return "Transferência"
    if tx_type == TransactionType.INCOME:
        return "Sem categoria (Receita)"
    return "Sem categoria (Despesa)"


def _pick_color(name: str, tx_type: TransactionType) -> str:
    # Base por tipo para facilitar leitura visual
    if tx_type == TransactionType.INCOME:
        base = "#10B981"
    elif tx_type == TransactionType.EXPENSE:
        base = "#EF4444"
    else:
        base = "#5B8DEF"

    digest = hashlib.md5(name.casefold().encode("utf-8")).hexdigest()
    idx = int(digest[:2], 16) % len(PALETTE)
    candidate = PALETTE[idx]
    return candidate if candidate != base else base


def _pick_icon(name: str, tx_type: TransactionType) -> str:
    normalized = name.casefold()
    for keywords, icon in ICON_RULES:
        if any(k in normalized for k in keywords):
            return icon
    if tx_type == TransactionType.INCOME:
        return "trending-up"
    if tx_type == TransactionType.EXPENSE:
        return "wallet"
    return "repeat"


def criar_categorias(caminho_csv: str | Path, user_id: int, dry_run: bool = False) -> tuple[int, int]:
    """
    Faz upsert de categorias com base no CSV.
    Retorna (criadas, atualizadas).
    """
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise RuntimeError(f"User id={user_id} não encontrado.")

        desejadas: dict[tuple[str, str], tuple[TransactionType, str, str, str]] = {}
        for row in iterar_linhas(caminho_csv):
            tipo = row["tipo"].strip()
            tx_type = _tx_type_from_row(tipo, row["conta_transferencia"])
            nome = _category_name(tipo, row["categoria"], row["subcategoria"], tx_type)
            key = (tx_type.value, nome.casefold())
            color = _pick_color(nome, tx_type)
            icon = _pick_icon(nome, tx_type)
            desejadas[key] = (tx_type, nome, color, icon)

        existentes = (
            db.query(TransactionCategory)
            .filter(TransactionCategory.user_id == user_id)
            .all()
        )
        existentes_map = {
            (c.transaction_type.value, c.name.casefold()): c for c in existentes
        }

        created = 0
        updated = 0
        for key, (tx_type, nome, color, icon) in sorted(desejadas.items()):
            existing = existentes_map.get(key)
            if not existing:
                created += 1
                if dry_run:
                    print(f"[DRY-RUN] Criaria categoria: {tx_type.value} | {nome} | {color} | {icon}")
                    continue
                db.add(
                    TransactionCategory(
                        user_id=user_id,
                        transaction_type=tx_type,
                        name=nome,
                        color=color,
                        icon=icon,
                    )
                )
                continue

            changed = existing.color != color or existing.icon != icon
            if changed:
                updated += 1
                if dry_run:
                    print(f"[DRY-RUN] Atualizaria categoria: {tx_type.value} | {nome} -> {color} | {icon}")
                    continue
                existing.color = color
                existing.icon = icon

        if not dry_run:
            db.commit()
        return created, updated
    finally:
        db.close()


def main() -> int:
    import argparse

    p = argparse.ArgumentParser(description="Cria/atualiza categorias a partir do CSV Meu Dinheiro")
    p.add_argument("csv", nargs="?", default="", help="Caminho do CSV (ou MEU_DINHEIRO_CSV)")
    p.add_argument("--user-id", type=int, default=1, help="ID do usuário (default: 1)")
    p.add_argument("--dry-run", action="store_true", help="Apenas listar o que seria criado/atualizado")
    args = p.parse_args()

    csv_path = args.csv or os.environ.get("MEU_DINHEIRO_CSV")
    if not csv_path or not Path(csv_path).exists():
        print("Erro: informe o caminho do CSV (argumento ou MEU_DINHEIRO_CSV).", file=sys.stderr)
        return 1

    created, updated = criar_categorias(csv_path, args.user_id, dry_run=args.dry_run)
    print(f"Categorias criadas: {created} | atualizadas: {updated}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
