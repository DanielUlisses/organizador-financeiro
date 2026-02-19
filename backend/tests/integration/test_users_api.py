"""Integration tests for users API"""
import pytest
from app.models.user import User


@pytest.mark.integration
class TestUsersAPI:
    """Test users API endpoints"""

    def test_create_user(self, client, db):
        """Test creating a user via API"""
        response = client.post(
            "/users/",
            json={"email": "newuser@example.com", "name": "New User"}
        )
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "newuser@example.com"
        assert data["name"] == "New User"
        assert data["id"] is not None

    def test_get_user(self, client, db):
        """Test getting a user via API"""
        user = User(email="test@example.com", name="Test User")
        db.add(user)
        db.commit()

        response = client.get(f"/users/{user.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "test@example.com"
        assert data["name"] == "Test User"

    def test_get_user_not_found(self, client, db):
        """Test getting non-existent user"""
        response = client.get("/users/99999")
        assert response.status_code == 404

    def test_get_all_users(self, client, db):
        """Test getting all users"""
        user1 = User(email="user1@example.com")
        user2 = User(email="user2@example.com")
        db.add_all([user1, user2])
        db.commit()

        response = client.get("/users/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2

    def test_update_user(self, client, db):
        """Test updating a user"""
        user = User(email="test@example.com", name="Old Name")
        db.add(user)
        db.commit()

        response = client.put(
            f"/users/{user.id}",
            json={"name": "New Name"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "New Name"

    def test_delete_user(self, client, db):
        """Test deleting a user"""
        user = User(email="test@example.com")
        db.add(user)
        db.commit()
        user_id = user.id

        response = client.delete(f"/users/{user_id}")
        assert response.status_code == 204

        # Verify deletion
        response = client.get(f"/users/{user_id}")
        assert response.status_code == 404
