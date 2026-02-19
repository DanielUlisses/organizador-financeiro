#!/bin/bash
# Test runner script for Phase 2

set -e

echo "Running Phase 2 tests..."
echo "========================="

# Check if test database exists, create if not
echo "Setting up test database..."

# Run unit tests
echo ""
echo "Running unit tests..."
pytest tests/unit/ -v --cov=app --cov-report=term-missing

# Run integration tests
echo ""
echo "Running integration tests..."
pytest tests/integration/ -v --cov=app --cov-report=term-missing

# Run all tests with coverage report
echo ""
echo "Running full test suite with coverage..."
pytest tests/ -v --cov=app --cov-report=term-missing --cov-report=html

echo ""
echo "Tests complete! Coverage report available in htmlcov/index.html"
