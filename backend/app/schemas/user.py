"""User schemas"""
from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional


class UserBase(BaseModel):
    email: EmailStr
    name: Optional[str] = None


class UserCreate(UserBase):
    pass


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    profile_image_path: Optional[str] = None
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    id: int
    email: str  # str so reserved/special-use domains (e.g. .local) from DB serialize
    profile_image_path: Optional[str] = None  # relative to uploads base URL
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
