"""Transaction category/tag routes."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.transaction_metadata import (
    TransactionCategoryCreate,
    TransactionCategoryResponse,
    TransactionCategoryUpdate,
    TransactionTagCreate,
    TransactionTagResponse,
    TransactionTagUpdate,
)
from app.services.transaction_metadata_service import TransactionMetadataService

router = APIRouter(prefix="/transaction-metadata", tags=["transaction-metadata"])


@router.get("/categories", response_model=List[TransactionCategoryResponse])
def list_categories(user_id: int, db: Session = Depends(get_db)):
    return TransactionMetadataService.list_categories(db, user_id)


@router.post("/categories", response_model=TransactionCategoryResponse, status_code=201)
def create_category(user_id: int, payload: TransactionCategoryCreate, db: Session = Depends(get_db)):
    return TransactionMetadataService.create_category(db, user_id, payload)


@router.put("/categories/{category_id}", response_model=TransactionCategoryResponse)
def update_category(category_id: int, user_id: int, payload: TransactionCategoryUpdate, db: Session = Depends(get_db)):
    updated = TransactionMetadataService.update_category(db, user_id, category_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Category not found")
    return updated


@router.delete("/categories/{category_id}", status_code=204)
def delete_category(category_id: int, user_id: int, db: Session = Depends(get_db)):
    success = TransactionMetadataService.delete_category(db, user_id, category_id)
    if not success:
        raise HTTPException(status_code=404, detail="Category not found")
    return None


@router.get("/tags", response_model=List[TransactionTagResponse])
def list_tags(user_id: int, db: Session = Depends(get_db)):
    return TransactionMetadataService.list_tags(db, user_id)


@router.post("/tags", response_model=TransactionTagResponse, status_code=201)
def create_tag(user_id: int, payload: TransactionTagCreate, db: Session = Depends(get_db)):
    return TransactionMetadataService.create_tag(db, user_id, payload)


@router.put("/tags/{tag_id}", response_model=TransactionTagResponse)
def update_tag(tag_id: int, user_id: int, payload: TransactionTagUpdate, db: Session = Depends(get_db)):
    updated = TransactionMetadataService.update_tag(db, user_id, tag_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Tag not found")
    return updated


@router.delete("/tags/{tag_id}", status_code=204)
def delete_tag(tag_id: int, user_id: int, db: Session = Depends(get_db)):
    success = TransactionMetadataService.delete_tag(db, user_id, tag_id)
    if not success:
        raise HTTPException(status_code=404, detail="Tag not found")
    return None
