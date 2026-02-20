"""
Remove duplicatas "Compra dolar" em que o mesmo evento aparece em BRL e em USD
(mesma conta, mesma data, dois valores com razão ~4,8–5). Mantém o valor maior (BRL)
e remove o pagamento com valor menor (USD) para não contar duas vezes.

Uso:
  python scripts/meu_dinheiro/remove_compra_dolar_duplicates.py [--user-id 1] [--dry-run]
"""
import argparse
import sys
from pathlib import Path

_backend = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_backend))

from sqlalchemy import text
from app.db import SessionLocal


RATIO_MIN = 4.3
RATIO_MAX = 5.5


def find_duplicate_payment_ids(db, user_id: int) -> list[int]:
    """IDs dos pagamentos com valor menor em cada par compra dolar (mesma conta, data, razão ~5)."""
    sql = """
    WITH compra_dolar AS (
      SELECT p.id, p.due_date::date AS d, p.description, p.amount,
        COALESCE(p.from_account_id, p.to_account_id) AS acc_id
      FROM payments p
      WHERE p.user_id = :user_id
        AND p.status IN ('PROCESSED', 'RECONCILED')
        AND (p.description ILIKE '%compra%dolar%' OR p.description ILIKE '%compra%dólar%')
        AND (p.from_account_type = 'bank_account' OR p.to_account_type = 'bank_account')
    ),
    pairs AS (
      SELECT a.d, a.acc_id,
        CASE WHEN a.amount < b.amount THEN a.id ELSE b.id END AS id_small
      FROM compra_dolar a
      JOIN compra_dolar b ON a.d = b.d AND a.acc_id = b.acc_id AND a.id < b.id
      WHERE LEAST(a.amount, b.amount) > 0
        AND (GREATEST(a.amount, b.amount) / LEAST(a.amount, b.amount)) BETWEEN :ratio_min AND :ratio_max
    )
    SELECT DISTINCT id_small FROM pairs
    """
    r = db.execute(
        text(sql),
        {"user_id": user_id, "ratio_min": RATIO_MIN, "ratio_max": RATIO_MAX},
    )
    return [row[0] for row in r]


def remove_payments(db, payment_ids: list[int], dry_run: bool) -> int:
    if not payment_ids:
        return 0
    ids_str = ",".join(str(i) for i in payment_ids)
    if dry_run:
        print(f"[DRY-RUN] Removeria payment_ids: {payment_ids}")
        return len(payment_ids)
    db.execute(text("DELETE FROM payment_tags WHERE payment_id IN (" + ids_str + ")"))
    db.execute(text("DELETE FROM payment_occurrences WHERE payment_id IN (" + ids_str + ")"))
    db.execute(text("DELETE FROM recurring_payment_overrides WHERE payment_id IN (" + ids_str + ")"))
    db.execute(text("DELETE FROM payments WHERE id IN (" + ids_str + ")"))
    return len(payment_ids)


def main() -> int:
    p = argparse.ArgumentParser(description="Remove duplicatas Compra dolar (valor menor = USD)")
    p.add_argument("--user-id", type=int, default=1)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    db = SessionLocal()
    try:
        ids = find_duplicate_payment_ids(db, args.user_id)
        if not ids:
            print("Nenhuma duplicata 'Compra dolar' (razão ~4,8–5) encontrada.")
            return 0
        print(f"Encontrados {len(ids)} pagamentos duplicados (valor menor) a remover: {ids}")
        n = remove_payments(db, ids, args.dry_run)
        if not args.dry_run:
            db.commit()
            print(f"Removidos {n} pagamentos.")
        return 0
    except Exception as e:
        db.rollback()
        print(e, file=sys.stderr)
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
