"""Authentication routes."""
import base64
import hashlib
import hmac
import json
import time
from typing import Any
from urllib.parse import quote_plus
from urllib.request import urlopen

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models.user import User
from app.services.user_service import UserService

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


class GoogleLoginRequest(BaseModel):
    id_token: str


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")


def _b64url_decode(raw: str) -> bytes:
    padding = "=" * ((4 - len(raw) % 4) % 4)
    return base64.urlsafe_b64decode(raw + padding)


def _sign_payload(payload: bytes) -> str:
    digest = hmac.new(settings.auth_secret.encode("utf-8"), payload, hashlib.sha256).digest()
    return _b64url_encode(digest)


def _build_session_token(user_id: int, email: str) -> str:
    now = int(time.time())
    exp = now + int(settings.auth_session_ttl_hours * 3600)
    payload = json.dumps({"uid": user_id, "email": email, "iat": now, "exp": exp}, separators=(",", ":")).encode("utf-8")
    payload_b64 = _b64url_encode(payload)
    signature = _sign_payload(payload)
    return f"{payload_b64}.{signature}"


def _parse_session_token(token: str | None) -> dict[str, Any] | None:
    if not token or "." not in token:
        return None
    payload_b64, signature = token.split(".", 1)
    try:
        payload = _b64url_decode(payload_b64)
    except Exception:
        return None
    expected_sig = _sign_payload(payload)
    if not hmac.compare_digest(signature, expected_sig):
        return None
    try:
        data = json.loads(payload.decode("utf-8"))
    except Exception:
        return None
    if not isinstance(data, dict):
        return None
    exp = int(data.get("exp", 0))
    if exp <= int(time.time()):
        return None
    return data


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.auth_session_cookie_name,
        value=token,
        httponly=True,
        secure=settings.auth_session_cookie_secure,
        samesite="lax",
        max_age=int(settings.auth_session_ttl_hours * 3600),
        path="/",
    )


def _clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(key=settings.auth_session_cookie_name, path="/")


@router.post("/login")
def password_login_disabled():
    raise HTTPException(status_code=410, detail="Password login is disabled. Use Google authentication.")


def _verify_google_id_token(id_token: str) -> dict[str, str] | None:
    token = id_token.strip()
    if not token:
        return None
    try:
        url = f"{settings.auth_google_tokeninfo_url}?id_token={quote_plus(token)}"
        with urlopen(url, timeout=8) as response:  # nosec B310: trusted Google tokeninfo endpoint
            payload = json.loads(response.read().decode("utf-8"))
    except Exception:
        return None

    if not isinstance(payload, dict):
        return None

    email = str(payload.get("email", "")).strip().lower()
    email_verified = str(payload.get("email_verified", "")).lower() == "true"
    audience = str(payload.get("aud", "")).strip()
    name = str(payload.get("name", "")).strip() or None
    if not email or not email_verified:
        return None
    if settings.auth_google_client_id and audience != settings.auth_google_client_id:
        return None
    return {"email": email, "name": name or ""}


def _get_single_authorized_user(db: Session, google_email: str, google_name: str | None) -> User:
    active_users = db.query(User).filter(User.is_active == True).order_by(User.id.asc()).all()
    if not active_users:
        created = User(email=google_email, name=google_name, is_active=True)
        db.add(created)
        db.commit()
        db.refresh(created)
        return created

    authorized = active_users[0]
    if authorized.email.lower() == google_email:
        if google_name and authorized.name != google_name:
            authorized.name = google_name
            db.add(authorized)
            db.commit()
            db.refresh(authorized)
        return authorized

    # If seed placeholder user exists, first Google login claims this deployment.
    if len(active_users) == 1 and authorized.email.lower().endswith("@local"):
        authorized.email = google_email
        authorized.name = google_name
        db.add(authorized)
        db.commit()
        db.refresh(authorized)
        return authorized

    raise HTTPException(status_code=403, detail="This Google account is not authorized for this deployment")


@router.post("/google-login")
def google_login(payload: GoogleLoginRequest, response: Response, db: Session = Depends(get_db)):
    google_user = _verify_google_id_token(payload.id_token)
    if not google_user:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    user = _get_single_authorized_user(db, google_user["email"], google_user.get("name") or None)
    token = _build_session_token(user.id, user.email)
    _set_auth_cookie(response, token)
    return {"authenticated": True, "user": {"id": user.id, "email": user.email, "name": user.name}}


@router.get("/session")
def get_session(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get(settings.auth_session_cookie_name)
    data = _parse_session_token(token)
    if not data:
        return {"authenticated": False}
    user = UserService.get_user(db, int(data["uid"]))
    if not user or not user.is_active:
        return {"authenticated": False}
    return {"authenticated": True, "user": {"id": user.id, "email": user.email, "name": user.name}}


@router.get("/me")
def get_current_user(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get(settings.auth_session_cookie_name)
    data = _parse_session_token(token)
    if not data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = UserService.get_user(db, int(data["uid"]))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "profile_image_path": user.profile_image_path,
            "is_active": user.is_active,
        }
    }


@router.post("/logout")
def logout(response: Response):
    _clear_auth_cookie(response)
    return {"ok": True}
