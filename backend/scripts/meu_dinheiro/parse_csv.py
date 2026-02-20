"""
Parser do CSV exportado pelo app Meu Dinheiro.
Uso: apenas na primeira carga; não faz parte do app.

Colunas do CSV (português):
- Tipo: Receita | Despesa | Transferência | Pagamento | Saldo inicial
  (alguns exports têm coluna extra "Venc. Fatura" entre Data efetiva e Valor previsto)
- Status: Conciliado | Pendente | Nconciliado | Confirmado
- Data prevista, Data efetiva (dd/mm/yyyy)
- Valor previsto, Valor efetivo (formato BR: 1.234,56)
- Descrição, Categoria, Subcategoria
- Conta: conta de origem/destino
- Conta transferência: preenchida apenas em transferências
- ID Único, Tags, Cartão (ex: "Daniel 7583" -> últimos 4 dígitos 7583)
- Repetição: Único | Fixo | Parcelado
- Data de criação
"""
import csv
import re
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any, Iterator


def _parse_data_br(s: str) -> date | None:
    """Converte data no formato dd/mm/yyyy para date. Retorna None se vazio ou inválido."""
    if not s or not s.strip():
        return None
    s = s.strip()
    try:
        return datetime.strptime(s, "%d/%m/%Y").date()
    except ValueError:
        return None


def _parse_valor_br(s: str) -> Decimal | None:
    """
    Converte valor no formato brasileiro para Decimal.
    Ex: "30.000,00" -> 30000.00, "-8.850,00" -> -8850.00
    Retorna None se vazio ou inválido.
    """
    if not s or not s.strip():
        return None
    s = s.strip().replace(".", "").replace(",", ".")
    try:
        return Decimal(s)
    except Exception:
        return None


def _extrair_quatro_digitos_cartao(cartao: str) -> str | None:
    """
    Extrai os 4 dígitos do campo Cartão (ex: "Daniel 7583" ou "Daniel (7196)" -> "7583" / "7196").
    Ignora o texto antes dos 4 dígitos.
    """
    if not cartao or not cartao.strip():
        return None
    match = re.search(r"\d{4}", cartao.strip())
    return match.group(0) if match else None


def iterar_linhas(caminho_csv: str | Path) -> Iterator[dict[str, Any]]:
    """
    Lê o CSV e produz um dicionário por linha com chaves em português e valores já parseados
    quando for o caso (data efetiva, valor efetivo, cartão 4 dígitos).
    """
    path = Path(caminho_csv)
    if not path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {path}")

    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            data_efetiva = _parse_data_br(row.get("Data efetiva", ""))
            valor_efetivo = _parse_valor_br(row.get("Valor efetivo", ""))
            cartao = (row.get("Cartão") or "").strip()
            quatro_digitos = _extrair_quatro_digitos_cartao(cartao)

            yield {
                "tipo": (row.get("Tipo") or "").strip(),
                "status": (row.get("Status") or "").strip(),
                "data_prevista": _parse_data_br(row.get("Data prevista", "")),
                "data_efetiva": data_efetiva,
                "valor_previsto": _parse_valor_br(row.get("Valor previsto", "")),
                "valor_efetivo": valor_efetivo,
                "descricao": (row.get("Descrição") or "").strip(),
                "categoria": (row.get("Categoria") or "").strip(),
                "subcategoria": (row.get("Subcategoria") or "").strip(),
                "conta": (row.get("Conta") or "").strip(),
                "conta_transferencia": (row.get("Conta transferência") or "").strip(),
                "id_unico": (row.get("ID Único") or "").strip(),
                "tags": (row.get("Tags") or "").strip(),
                "cartao": cartao,
                "cartao_last4": quatro_digitos,
                "repeticao": (row.get("Repetição") or "").strip(),
                "data_criacao": _parse_data_br(row.get("Data de criação", "")),
            }


def contas_unicas(caminho_csv: str | Path) -> set[str]:
    """Retorna o conjunto de nomes de conta (Conta) presentes no CSV."""
    contas = set()
    for row in iterar_linhas(caminho_csv):
        if row["conta"]:
            contas.add(row["conta"])
    return contas


def contas_transferencia_unicas(caminho_csv: str | Path) -> set[str]:
    """Retorna o conjunto de nomes de conta de transferência presentes no CSV."""
    contas = set()
    for row in iterar_linhas(caminho_csv):
        if row["conta_transferencia"]:
            contas.add(row["conta_transferencia"])
    return contas


def contas_todas_unicas(caminho_csv: str | Path) -> set[str]:
    """Retorna todas as contas únicas (Conta + Conta transferência). Use para criar todas as contas necessárias."""
    return contas_unicas(caminho_csv) | contas_transferencia_unicas(caminho_csv)


if __name__ == "__main__":
    import sys
    csv_path = sys.argv[1] if len(sys.argv) > 1 else "/home/daniel/Downloads/Meu_Dinheiro_20260219232317.csv"
    n = 0
    for linha in iterar_linhas(csv_path):
        n += 1
        if n <= 3:
            print(linha)
    print(f"... total de linhas processadas: {n}")
    print("Contas:", sorted(contas_unicas(csv_path)))
    print("Contas transferência:", sorted(contas_transferencia_unicas(csv_path)))
