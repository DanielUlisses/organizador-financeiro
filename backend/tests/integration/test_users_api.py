"""Integration tests for users API"""
import pytest
import uuid
from app.models.user import User


@pytest.mark.integration
class TestUsersAPI:
    """Test users API endpoints"""

    def test_create_user(self, client, db_session):
        """Test creating a user via API"""
        unique_email = f"newuser_{uuid.uuid4().hex[:8]}@example.com"
        response = client.post(
            "/users/",
            json={"email": unique_email, "name": "New User"}
        )
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == unique_email
        assert data["name"] == "New User"
        assert data["id"] is not None

    def test_get_user(self, client, db_session):
        """Test getting a user via API"""
        unique_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        user = User(email=unique_email, name="Test User")
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        response = client.get(f"/users/{user.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == unique_email
        assert data["name"] == "Test User"

    def test_get_user_not_found(self, client, db_session):
        """Test getting non-existent user"""
        response = client.get("/users/99999")
        assert response.status_code == 404

    def test_get_all_users(self, client, db_session):
        """Test getting all users"""
        user1 = User(email=f"user1_{uuid.uuid4().hex[:8]}@example.com")
        user2 = User(email=f"user2_{uuid.uuid4().hex[:8]}@example.com")
        db_session.add_all([user1, user2])
        db_session.commit()

        response = client.get("/users/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2

    def test_update_user(self, client, db_session):
        """Test updating a user"""
        unique_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        user = User(email=unique_email, name="Old Name")
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        response = client.put(
            f"/users/{user.id}",
            json={"name": "New Name"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "New Name"

    def test_delete_user(self, client, db_session):
        """Test deleting a user"""
        unique_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        user = User(email=unique_email)
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        user_id = user.id

        response = client.delete(f"/users/{user_id}")
        assert response.status_code == 204

        # Verify deletion
        response = client.get(f"/users/{user_id}")
        assert response.status_code == 404
