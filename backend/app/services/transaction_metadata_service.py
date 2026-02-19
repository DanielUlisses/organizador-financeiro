"""Services for transaction categories and tags."""
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.transaction_metadata import TransactionCategory, TransactionTag
from app.schemas.transaction_metadata import (
    TransactionCategoryCreate,
    TransactionCategoryUpdate,
    TransactionTagCreate,
    TransactionTagUpdate,
)


class TransactionMetadataService:
    @staticmethod
    def list_categories(db: Session, user_id: int) -> List[TransactionCategory]:
        return (
            db.query(TransactionCategory)
            .filter(TransactionCategory.user_id == user_id)
            .order_by(TransactionCategory.transaction_type, TransactionCategory.name)
            .all()
        )

    @staticmethod
    def create_category(db: Session, user_id: int, payload: TransactionCategoryCreate) -> TransactionCategory:
        model = TransactionCategory(user_id=user_id, **payload.model_dump())
        db.add(model)
        db.commit()
        db.refresh(model)
        return model

    @staticmethod
    def update_category(
        db: Session, user_id: int, category_id: int, payload: TransactionCategoryUpdate
    ) -> Optional[TransactionCategory]:
        model = (
            db.query(TransactionCategory)
            .filter(TransactionCategory.id == category_id, TransactionCategory.user_id == user_id)
            .first()
        )
        if not model:
            return None
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(model, field, value)
        db.commit()
        db.refresh(model)
        return model

    @staticmethod
    def delete_category(db: Session, user_id: int, category_id: int) -> bool:
        model = (
            db.query(TransactionCategory)
            .filter(TransactionCategory.id == category_id, TransactionCategory.user_id == user_id)
            .first()
        )
        if not model:
            return False
        db.delete(model)
        db.commit()
        return True

    @staticmethod
    def list_tags(db: Session, user_id: int) -> List[TransactionTag]:
        return db.query(TransactionTag).filter(TransactionTag.user_id == user_id).order_by(TransactionTag.name).all()

    @staticmethod
    def create_tag(db: Session, user_id: int, payload: TransactionTagCreate) -> TransactionTag:
        model = TransactionTag(user_id=user_id, **payload.model_dump())
        db.add(model)
        db.commit()
        db.refresh(model)
        return model

    @staticmethod
    def update_tag(db: Session, user_id: int, tag_id: int, payload: TransactionTagUpdate) -> Optional[TransactionTag]:
        model = db.query(TransactionTag).filter(TransactionTag.id == tag_id, TransactionTag.user_id == user_id).first()
        if not model:
            return None
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(model, field, value)
        db.commit()
        db.refresh(model)
        return model

    @staticmethod
    def delete_tag(db: Session, user_id: int, tag_id: int) -> bool:
        model = db.query(TransactionTag).filter(TransactionTag.id == tag_id, TransactionTag.user_id == user_id).first()
        if not model:
            return False
        db.delete(model)
        db.commit()
        return True
