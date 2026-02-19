"""Pytest configuration and fixtures"""
import pytest
import uuid
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from fastapi.testclient import TestClient
from app.db import Base, get_db
from app.main import app
import os

# Use test database URL from environment or default
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/organizador_financeiro_test"
)

# Create test engine with connection timeout and pool settings
# Use NullPool to avoid connection pool issues in tests
test_engine = create_engine(
    TEST_DATABASE_URL,
    poolclass=NullPool,  # No connection pooling for tests
    pool_pre_ping=True,
    connect_args={
        "connect_timeout": 10,  # 10 second connection timeout
        "options": "-c statement_timeout=120000"  # 120 second statement timeout
    },
    echo=False  # Set to True for SQL debugging
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

# Create tables once at module level
@pytest.fixture(scope="module", autouse=True)
def setup_database():
    """Create all tables once before tests run"""
    # Clean up any existing locks first
    try:
        with test_engine.connect() as conn:
            conn.execute(text("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() AND state = 'idle in transaction';"))
            conn.commit()
    except Exception:
        pass  # Ignore errors during cleanup
    
    Base.metadata.create_all(bind=test_engine)
    yield
    # Optionally drop tables after all tests (commented out to keep data for debugging)
    # Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database session for each test with proper transaction isolation"""
    # Create a connection and start a transaction
    connection = test_engine.connect()
    transaction = connection.begin()
    
    # Bind session to this connection
    session = TestSessionLocal(bind=connection)
    
    try:
        yield session
    finally:
        # Always rollback and close
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture(scope="function")
def client(db_session):
    """Create a test client with database override"""
    def override_get_db():
        try:
            yield db_session
        finally:
            # Don't rollback here, let the fixture handle it
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    test_client = TestClient(app)
    try:
        yield test_client
    finally:
        app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def db():
    """Direct database session fixture with proper transaction isolation"""
    # Create a connection and start a transaction
    connection = test_engine.connect()
    transaction = connection.begin()
    
    # Bind session to this connection
    session = TestSessionLocal(bind=connection)
    
    try:
        yield session
    finally:
        # Always rollback and close
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def unique_email():
    """Generate a unique email for each test"""
    return f"test_{uuid.uuid4().hex[:8]}@example.com"
