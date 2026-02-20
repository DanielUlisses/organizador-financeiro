"""Integration tests for auth API."""
import pytest
import uuid
from app.config import get_settings
from app.models.user import User


@pytest.mark.integration
class TestAuthAPI:
    def test_login_session_me_logout(self, client, db_session, monkeypatch):
        settings = get_settings()
        monkeypatch.setattr(settings, "auth_login_password", "test-password")
        monkeypatch.setattr(settings, "auth_session_cookie_secure", False)

        email = f"auth_{uuid.uuid4().hex[:8]}@example.com"
        user = User(email=email, name="Auth User", is_active=True)
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        login_response = client.post("/auth/login", json={"email": email, "password": "test-password"})
        assert login_response.status_code == 200
        login_data = login_response.json()
        assert login_data["authenticated"] is True
        assert login_data["user"]["email"] == email
        assert settings.auth_session_cookie_name in login_response.cookies

        session_response = client.get("/auth/session")
        assert session_response.status_code == 200
        session_data = session_response.json()
        assert session_data["authenticated"] is True
        assert session_data["user"]["email"] == email

        me_response = client.get("/auth/me")
        assert me_response.status_code == 200
        me_data = me_response.json()
        assert me_data["user"]["email"] == email
        assert me_data["user"]["name"] == "Auth User"

        logout_response = client.post("/auth/logout")
        assert logout_response.status_code == 200
        assert logout_response.json()["ok"] is True

        post_logout_session = client.get("/auth/session")
        assert post_logout_session.status_code == 200
        assert post_logout_session.json()["authenticated"] is False

    def test_login_rejects_invalid_credentials(self, client, db_session, monkeypatch):
        settings = get_settings()
        monkeypatch.setattr(settings, "auth_login_password", "correct-password")

        email = f"auth_{uuid.uuid4().hex[:8]}@example.com"
        user = User(email=email, is_active=True)
        db_session.add(user)
        db_session.commit()

        response = client.post("/auth/login", json={"email": email, "password": "wrong-password"})
        assert response.status_code == 401
