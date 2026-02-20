#!/usr/bin/env python3
"""Create the default user (id=1) if no users exist. Run from backend dir: python scripts/seed_default_user.py"""
import os
import sys

# Ensure backend/app is on path when run from backend/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import SessionLocal
from app.models.user import User
from app.schemas.user import UserCreate


def main() -> int:
    db = SessionLocal()
    try:
        existing = db.query(User).first()
        if existing:
            print(f"User already exists (id={existing.id}, email={existing.email}). Skipping seed.")
            return 0
        email = os.environ.get("OF_DEFAULT_USER_EMAIL", "user@local")
        name = os.environ.get("OF_DEFAULT_USER_NAME", "User")
        user_data = UserCreate(email=email, name=name)
        user = User(**user_data.model_dump())
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"Created default user: id={user.id}, email={user.email}, name={user.name}")
        return 0
    except Exception as e:
        print(f"Seed failed: {e}", file=sys.stderr)
        db.rollback()
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
