import pytest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app.auth import get_current_user
from app.models.entities import User, Team, TeamMembership


@pytest.fixture
def client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
    )

    Base.metadata.create_all(bind=engine)

    with TestingSession() as db:
        user = User(
            id=1,
            email="member@test.local",
            name="Test Member",
            is_admin=False,
            is_active=True,
        )
        team = Team(id=1, name="Test Team")
        db.add_all([user, team])
        db.flush()

        db.add(
            TeamMembership(
                user_id=1,
                team_id=1,
                role="member",
            )
        )
        db.commit()

    def override_get_db():
        with TestingSession() as db:
            yield db

    def override_user():
        with TestingSession() as db:
            return db.get(User, 1)

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_user

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def create_item(client):
    response = client.post(
        "/work-items",
        json={
            "title": "Test payment investigation",
            "description": "Test description",
            "team_id": 1,
            "assignee_id": 1,
            "priority": "high",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_create_and_list_work_item(client):
    item = create_item(client)

    response = client.get("/work-items")

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["id"] == item["id"]


def test_stale_update_is_rejected(client):
    item = create_item(client)

    first_update = client.patch(
        f"/work-items/{item['id']}",
        json={
            "expected_version": 1,
            "status": "in_progress",
        },
    )
    assert first_update.status_code == 200
    assert first_update.json()["version"] == 2

    stale_update = client.patch(
        f"/work-items/{item['id']}",
        json={
            "expected_version": 1,
            "priority": "critical",
        },
    )

    assert stale_update.status_code == 409


def test_invalid_status_transition_is_rejected(client):
    item = create_item(client)

    response = client.patch(
        f"/work-items/{item['id']}",
        json={
            "expected_version": 1,
            "status": "resolved",
        },
    )

    assert response.status_code == 409


def test_non_member_cannot_create_in_another_team(client):
    response = client.post(
        "/work-items",
        json={
            "title": "Unauthorized work item",
            "description": "",
            "team_id": 999,
            "priority": "medium",
        },
    )

    assert response.status_code == 403