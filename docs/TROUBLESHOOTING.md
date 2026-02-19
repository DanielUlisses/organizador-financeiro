# Troubleshooting Guide

## PostgreSQL 18 Docker Volume Issue

If you encounter an error about PostgreSQL 18+ volume configuration:

```
Error: in 18+, these Docker images are configured to store database data...
```

This happens when upgrading from PostgreSQL <18 to PostgreSQL 18+. The volume mount path has changed.

### Solution

1. **Stop and remove the old container and volumes:**
   ```bash
   make clean-db
   # or manually:
   docker-compose -f docker/docker-compose.yml down -v
   ```

2. **Start fresh with the new configuration:**
   ```bash
   make createdb
   ```

### What Changed

- **Old (PostgreSQL <18)**: Volume mounted to `/var/lib/postgresql/data`
- **New (PostgreSQL 18+)**: Volume mounted to `/var/lib/postgresql`

The docker-compose.yml has been updated to use the new mount path. If you have existing data you need to preserve, you'll need to migrate it using `pg_upgrade` (see PostgreSQL documentation).

### Fresh Start

If you don't need to preserve existing data, the simplest solution is:

```bash
make clean-db    # Remove old volumes
make createdb   # Start fresh with new configuration
```

---

## Other Common Issues

### Database Connection Errors

- Ensure PostgreSQL container is running: `docker ps | grep organizador-financeiro-db`
- Check container logs: `docker logs organizador-financeiro-db`
- Verify environment variables in `.env` match docker-compose.yml

### Migration Errors

- Ensure you've run migrations: `make migrate-up`
- Check Alembic version: `cd backend && alembic current`
- If stuck, check migration files in `backend/alembic/versions/`

### Test Database Issues

- Ensure test database exists: `make createdb` creates both main and test databases
- Check TEST_DATABASE_URL in environment matches test database name

---

## Python Dependency Build Errors

### pydantic-core Build Failure

If you encounter errors building `pydantic-core` (requires Rust):

```
ERROR: Failed building wheel for pydantic-core
```

**Solution 1: Upgrade pip and use pre-built wheels (Recommended)**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
```

**Solution 2: Install Rust (if pre-built wheels aren't available for your platform)**
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Then retry pip install
pip install -r requirements.txt
```

**Solution 3: Use alternative installation method**
```bash
# Try installing with --only-binary flag to force pre-built wheels
pip install --only-binary :all: -r requirements.txt

# Or install pydantic separately first
pip install --upgrade pip
pip install pydantic pydantic-settings
pip install -r requirements.txt
```

**Solution 4: Check Python version compatibility**
- **Python 3.14+ is NOT supported** - PyO3 (used by pydantic-core) only supports up to Python 3.13
- Use Python 3.10, 3.11, 3.12, or 3.13 (3.12 or 3.13 recommended)
- Check: `python3 --version`
- If you have Python 3.14, install a compatible version:
  ```bash
  # Using pyenv (recommended)
  pyenv install 3.12.0
  pyenv local 3.12.0
  
  # Or use your system's Python 3.12/3.13
  python3.12 -m venv backend/.venv
  ```

**Solution 5: Workaround for Python 3.14 (not recommended)**
If you absolutely must use Python 3.14, you can try:
```bash
export PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1
pip install -r requirements.txt
```
However, this may cause runtime issues. **Strongly recommend using Python 3.12 or 3.13 instead.**

**Solution 6: Use Docker for consistent environment**
If build issues persist, consider using Docker for the backend to ensure consistent build environment.
