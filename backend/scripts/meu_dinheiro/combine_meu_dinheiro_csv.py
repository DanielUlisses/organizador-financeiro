"""
Combina dois (ou mais) CSVs exportados do Meu Dinheiro em um único arquivo,
deduplicando por "ID Único". Quando o mesmo ID aparece nos dois, mantém a linha
do último arquivo (ex.: o export que inclui Transferência e Pagamento).

O segundo arquivo costuma ter coluna extra "Venc. Fatura"; a saída usa o
formato sem essa coluna (16 colunas) para compatibilidade com o parser.

Uso:
  python combine_meu_dinheiro_csv.py arquivo1.csv arquivo2.csv -o combined.csv
  python combine_meu_dinheiro_csv.py arquivo1.csv arquivo2.csv  # imprime na stdout
"""
import csv
import sys
from pathlib import Path

# Cabeçalho de saída (formato sem "Venc. Fatura", compatível com parse_csv)
OUTPUT_HEADER = [
    "Tipo",
    "Status",
    "Data prevista",
    "Data efetiva",
    "Valor previsto",
    "Valor efetivo",
    "Descrição",
    "Categoria",
    "Subcategoria",
    "Conta",
    "Conta transferência",
    "ID Único",
    "Tags",
    "Cartão",
    "Repetição",
    "Data de criação",
]


def _row_to_output(row: dict) -> list[str]:
    """Mapeia um DictReader row para lista de valores na ordem OUTPUT_HEADER."""
    return [row.get(h, "").strip() if row.get(h) is not None else "" for h in OUTPUT_HEADER]


def combine_csvs(
    caminhos: list[str | Path],
    saida: str | Path | None = None,
    preferir_ultimo: bool = True,
    preservar_conta_do_primeiro: bool = True,
) -> tuple[int, int]:
    """
    Combina os CSVs, deduplicando por "ID Único". Quando há duplicata, mantém
    a linha do último arquivo na lista (preferir_ultimo=True).

    Se preservar_conta_do_primeiro=True, para cada ID mantido usa "Conta" e
    "Conta transferência" da **primeira** ocorrência do ID (primeiro arquivo
    onde o ID apareceu). Isso evita que um export parcial (ex.: só Nomad ou só
    transferências) sobrescreva a conta correta (ex.: "1 Sicoob" -> "3 Inter").

    Retorna (total_linhas_escritas, total_ids_unicos).
    """
    id_para_linha: dict[str, dict] = {}
    id_para_primeira_conta: dict[str, tuple[str, str]] = {}

    for caminho in caminhos:
        path = Path(caminho)
        if not path.exists():
            raise FileNotFoundError(f"Arquivo não encontrado: {path}")
        with open(path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                uid = (row.get("ID Único") or "").strip()
                if not uid:
                    continue
                if uid not in id_para_primeira_conta:
                    conta = (row.get("Conta") or "").strip()
                    conta_transf = (row.get("Conta transferência") or "").strip()
                    id_para_primeira_conta[uid] = (conta, conta_transf)
                # Sobrescreve com a linha deste arquivo (último arquivo ganha nos demais campos)
                id_para_linha[uid] = row

    total = len(id_para_linha)
    out_file = open(Path(saida), "w", encoding="utf-8", newline="") if saida else sys.stdout
    try:
        writer = csv.writer(out_file)
        writer.writerow(OUTPUT_HEADER)
        for uid, row in id_para_linha.items():
            out_row = dict(row)
            if preservar_conta_do_primeiro and uid in id_para_primeira_conta:
                primeira_conta, primeira_conta_transf = id_para_primeira_conta[uid]
                if primeira_conta:
                    out_row["Conta"] = primeira_conta
                if primeira_conta_transf:
                    out_row["Conta transferência"] = primeira_conta_transf
            writer.writerow(_row_to_output(out_row))
    finally:
        if saida and out_file is not sys.stdout:
            out_file.close()

    return total, total


def main() -> int:
    import argparse
    p = argparse.ArgumentParser(
        description="Combina CSVs Meu Dinheiro deduplicando por ID Único (mantém último em duplicatas)."
    )
    p.add_argument("csvs", nargs="+", help="Dois ou mais arquivos CSV (o último prevalece em IDs duplicados)")
    p.add_argument("-o", "--output", default="", help="Arquivo de saída (se omitido, imprime na stdout)")
    p.add_argument(
        "--no-preserve-conta",
        action="store_true",
        help="Desativa: por padrão Conta/Conta transferência vêm do primeiro arquivo onde o ID aparece (evita 3 Inter engolir 1 Sicoob)",
    )
    args = p.parse_args()

    if len(args.csvs) < 2:
        print("Informe pelo menos dois arquivos CSV.", file=sys.stderr)
        return 1

    try:
        n, _ = combine_csvs(
            args.csvs,
            saida=args.output or None,
            preservar_conta_do_primeiro=not args.no_preserve_conta,
        )
        if args.output:
            print(f"Escritas {n} transações únicas em {args.output}", file=sys.stderr)
        return 0
    except FileNotFoundError as e:
        print(e, file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
