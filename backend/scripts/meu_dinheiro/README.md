# Importação Meu Dinheiro (CSV)

Scripts de uso **único** na primeira carga: leem o CSV exportado do app Meu Dinheiro e criam contas (bancárias + cartões) e transações no Organizador Financeiro. Tudo em Python e SQL; nada é exposto na interface do app.

## Estrutura do CSV

- **Data efetiva**: data da transação (usada como `due_date` / data do pagamento).
- **Valor efetivo**: valor da transação (formato BR: `1.234,56`).
- **Conta**: conta de origem (despesa/transferência) ou destino (receita).
- **Conta transferência**: preenchida em transferências e em **Pagamento** (pagamento de cartão).
- **Tipo**: Receita, Despesa, **Transferência**, **Pagamento**, **Saldo inicial**. Saldo inicial é importado como **receita** na conta na data efetiva (abertura de conta; contas são criadas com saldo 0).
- **Status**: Conciliado → `reconciled`, Pendente → `pending`, Nconciliado/Confirmado → `processed`.
- **Repetição**: Fixo/Único/Parcelado — na importação todas as transações são tratadas como **únicas** (one-time).

## Regras de contas

| Nome no CSV              | Tipo no app        |
|--------------------------|--------------------|
| Contém "TPC"             | Cartão Amex        |
| "Mastercard Black"       | Cartão Mastercard  |
| "Visa Infinity"          | Cartão Visa        |
| "Carteira de investimentos" | Poupança (savings) |
| Demais                   | Conta corrente (checking) |

### Contas de investimento: importar e arquivar depois

Neste fluxo, contas de investimento também são importadas (contas e transações), para manter o histórico completo e reduzir drift de saldo em contas operacionais.

Depois do import e recálculo, você pode arquivar essas contas (setar `is_active=false`) com `archive_investment_accounts.py` para:
- não aparecerem na listagem operacional de contas;
- não entrarem nos cards/charts que usam `/bank-accounts`.

O campo **Cartão** do CSV (ex.: "Daniel 7583") tem os 4 dígitos finais; múltiplos cartões na mesma conta são tratados como um único cartão no app (um last4 pode ser guardado como referência).

Alguns exports do Meu Dinheiro vêm **sem** a coluna "Venc. Fatura"; outros trazem essa coluna entre "Data efetiva" e "Valor previsto". O parser aceita os dois formatos. Se você tiver **dois CSVs** (por exemplo um com só receitas/despesas e outro com transferências e pagamentos), use o script **combine** para gerar um único CSV deduplicado por "ID Único" antes de rodar contas e importação.

## Combinar dois CSVs (quando as transferências vêm em outro export)

Se um export não trouxer transferências/pagamentos e outro trouxer, combine os dois e use o resultado na importação:

```bash
cd backend
python scripts/meu_dinheiro/combine_meu_dinheiro_csv.py \
  /caminho/arquivo_sem_transferencias.csv \
  /caminho/arquivo_com_transferencias.csv \
  -o /caminho/Meu_Dinheiro_combined.csv
```

- Os dois arquivos podem ter estruturas ligeiramente diferentes (ex.: um com coluna "Venc. Fatura", outro sem).
- Em duplicatas (mesmo "ID Único"), é mantida a linha do **último** arquivo (Tipo, Status, datas, valor etc.), mas **Conta** e **Conta transferência** vêm do **primeiro** arquivo onde o ID apareceu. Assim um export parcial (ex.: só Nomad ou só transferências) não sobrescreve a conta correta. Use `--no-preserve-conta` para desativar e voltar ao comportamento "último arquivo em tudo".
- A saída tem 2.361 transações únicas (exemplo: 2.030 + 790 − 459 duplicatas).

Use depois `MEU_DINHEIRO_CSV=/caminho/Meu_Dinheiro_combined.csv` nos passos de contas e importação.

## Pré-requisitos

- Python com dependências do backend instaladas (ative o venv do projeto ou instale com `pip install -r backend/requirements.txt`).
- Banco PostgreSQL (dev ou teste) com schema aplicado (Alembic).
- Um usuário existente (ex.: `id=1`); pode usar `scripts/seed_default_user.py`.

## Passos para limpar o banco de teste e rodar a importação

### 1. Usar o banco de teste

No `.env` na raiz do projeto (ou no backend), use o banco de teste para não afetar dados de desenvolvimento:

```bash
# No .env (ou export antes dos comandos)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/organizador_financeiro_test
```

Ou, apenas para os scripts, sem alterar `.env`:

```bash
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/organizador_financeiro_test
```

### 2. Recriar o banco de teste (drop + create)

```bash
# Conectar ao postgres e recriar o database (ajuste user/host se necessário)
psql -U postgres -h localhost -c "DROP DATABASE IF EXISTS organizador_financeiro_test;"
psql -U postgres -h localhost -c "CREATE DATABASE organizador_financeiro_test;"
```

### 3. Rodar migrações

A partir da **pasta backend**:

```bash
cd backend
alembic upgrade head
```

### 4. Criar o usuário padrão (se não existir)

```bash
python scripts/seed_default_user.py
```

### 5. Criar contas e cartões a partir do CSV

As contas são criadas a partir de **Conta** e **Conta transferência** (para que todas as contas referenciadas existam). Use o CSV combinado se tiver usado o passo de combinação.

```bash
# Caminho do CSV (combinado ou único) como argumento
python scripts/meu_dinheiro/create_accounts.py /caminho/para/Meu_Dinheiro_combined.csv

# Ou via variável de ambiente
export MEU_DINHEIRO_CSV=/caminho/para/Meu_Dinheiro_combined.csv
python scripts/meu_dinheiro/create_accounts.py

# Só simular (não grava)
python scripts/meu_dinheiro/create_accounts.py "$MEU_DINHEIRO_CSV" --dry-run
```

Por padrão usa `--user-id=1`. Outro usuário: `--user-id=2`.

### 6. Criar/atualizar categorias (com cor e ícone)

As categorias são extraídas da coluna **Categoria** do CSV, separadas por tipo de transação (receita/despesa/transferência).  
O script faz **upsert**: cria as faltantes e atualiza cor/ícone das existentes.
Quando existir **Subcategoria**, ela passa a ser o nome da categoria no app (com fallback para Categoria).

```bash
python scripts/meu_dinheiro/create_categories.py "$MEU_DINHEIRO_CSV"

# Dry-run (só mostra o que faria)
python scripts/meu_dinheiro/create_categories.py "$MEU_DINHEIRO_CSV" --dry-run
```

### 7. Importar transações

```bash
python scripts/meu_dinheiro/import_transactions.py "$MEU_DINHEIRO_CSV"

# Dry-run (só contagem)
python scripts/meu_dinheiro/import_transactions.py "$MEU_DINHEIRO_CSV" --dry-run
```

Por padrão, quando faltar **data efetiva** e/ou **valor efetivo**, o import usa **Data prevista** e **Valor previsto** (transação entra como `pending`, ou seja, planejada).  
Para importar **somente efetivado** (ignorar planejadas), use `--somente-efetivo`.

## Limpar só transações (mantendo contas)

Se você quer rerodar o import sem recriar contas, rode este bloco no banco alvo:

```bash
cd backend
python - <<'PY'
from sqlalchemy import text
from app.db import SessionLocal

sql = """
TRUNCATE TABLE payment_tags RESTART IDENTITY;
TRUNCATE TABLE payment_occurrences RESTART IDENTITY CASCADE;
TRUNCATE TABLE recurring_payment_overrides RESTART IDENTITY CASCADE;
TRUNCATE TABLE payments RESTART IDENTITY CASCADE;
"""

db = SessionLocal()
try:
    db.execute(text(sql))
    db.commit()
    print("Transações removidas. Contas mantidas.")
finally:
    db.close()
PY
```

Se também quiser recriar categorias do zero:

```bash
cd backend
python - <<'PY'
from sqlalchemy import text
from app.db import SessionLocal

db = SessionLocal()
try:
    db.execute(text("DELETE FROM transaction_categories WHERE user_id = :uid"), {"uid": 1})
    db.commit()
    print("Categorias removidas para user_id=1.")
finally:
    db.close()
PY
```

## Recalcular saldo atual das contas (bank_accounts.balance)

Após reimportar, recalcule `bank_accounts.balance` com base nas transações efetivadas:

```bash
cd backend
python scripts/meu_dinheiro/recalculate_bank_balances.py --user-id 1

# opcional dry-run
python scripts/meu_dinheiro/recalculate_bank_balances.py --user-id 1 --dry-run
```

## Compra dolar duplicada (BRL + USD)

Alguns exports trazem a mesma "Compra dolar" duas vezes: um valor em BRL e outro em USD (razão ~4,8–5). Isso duplica a saída na conta e distorce o saldo (ex.: Inter fev/2024 deveria fechar 13,05 mas fechava -1892,62).

- **No import**: o script `import_transactions.py` detecta pares (mesma data, mesma conta, descrição "compra dolar", dois valores com razão entre 4,3 e 5,5) e **ignora a linha com valor menor** (USD).
- **Já importou**: use o script abaixo para remover do banco os pagamentos duplicados (valor menor) e depois recalcule os saldos:

```bash
cd backend
python scripts/meu_dinheiro/remove_compra_dolar_duplicates.py --user-id 1
# opcional: --dry-run para só listar o que seria removido

python scripts/meu_dinheiro/recalculate_bank_balances.py --user-id 1
```

## Arquivar contas de investimento (pós-import)

Após validar os saldos, arquive contas de investimento sem apagar histórico/transações:

```bash
cd backend
python scripts/meu_dinheiro/archive_investment_accounts.py --user-id 1

# opcional dry-run
python scripts/meu_dinheiro/archive_investment_accounts.py --user-id 1 --dry-run
```

## Resumo dos comandos (copiar/colar)

Assumindo CSV em `~/Downloads/Meu_Dinheiro_20260219232317.csv` e banco de teste já configurado no `.env`:

```bash
cd backend

# 1) Recriar banco de teste (opcional)
# psql -U postgres -h localhost -c "DROP DATABASE IF EXISTS organizador_financeiro_test;"
# psql -U postgres -h localhost -c "CREATE DATABASE organizador_financeiro_test;"

# 2) Migrações
alembic upgrade head

# 3) Usuário
python scripts/seed_default_user.py

# 4) Contas
export MEU_DINHEIRO_CSV=~/Downloads/Meu_Dinheiro_20260219232317.csv
python scripts/meu_dinheiro/create_accounts.py "$MEU_DINHEIRO_CSV"

# 5) Categorias
python scripts/meu_dinheiro/create_categories.py "$MEU_DINHEIRO_CSV"

# 6) Transações
python scripts/meu_dinheiro/import_transactions.py "$MEU_DINHEIRO_CSV"

# 7) Recalcular saldos de contas
python scripts/meu_dinheiro/recalculate_bank_balances.py --user-id 1

# 8) Arquivar contas de investimento (opcional, recomendado para UI operacional)
python scripts/meu_dinheiro/archive_investment_accounts.py --user-id 1
```

## Arquivos

- **parse_csv.py**: parser do CSV (datas BR, valor BR, colunas em português); funções `iterar_linhas`, `contas_unicas`, `contas_todas_unicas`, etc. Aceita CSV com ou sem coluna "Venc. Fatura".
- **combine_meu_dinheiro_csv.py**: combina dois ou mais CSVs e deduplica por "ID Único" (mantém a linha do último arquivo em duplicatas). Saída no formato de 16 colunas.
- **create_accounts.py**: cria `bank_accounts` e `credit_cards` a partir de **Conta** e **Conta transferência** do CSV.
- **create_categories.py**: cria/atualiza `transaction_categories` a partir do CSV, definindo cor e ícone por categoria.
- **import_transactions.py**: cria `payments` (ONE_TIME) e `payment_occurrences`. "Saldo inicial" vira receita na conta na data efetiva. Em "Transferência"/"Pagamento", a direção é definida pelo sinal de `Valor efetivo` na conta da linha (valor positivo = entrada na conta da linha; valor negativo = saída). Deduplicação por `ID Único` quando disponível. Deduplicação de "Compra dolar" duplicada (BRL+USD): ignora a linha com valor menor quando há par com razão ~4,8–5. Deduplica transferências espelhadas. Vincula `category_id` quando a categoria existe.
- **remove_compra_dolar_duplicates.py**: remove do banco pagamentos "Compra dolar" que são o valor menor de um par BRL/USD (razão 4,3–5,5), para corrigir saldos já importados.
- **recalculate_bank_balances.py**: recalcula `bank_accounts.balance` a partir dos `payments` efetivados (`RECONCILED`/`PROCESSED`).
- **archive_investment_accounts.py**: marca `bank_accounts.is_active=false` para contas de investimento importadas (mantém histórico, oculta da UI operacional).

Nenhum desses scripts é usado pela API ou pelo front; são apenas ferramentas de carga inicial.
