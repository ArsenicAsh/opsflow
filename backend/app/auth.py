from pathlib import Path

import json
import secrets
from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.orm import Session

from .database import get_db
from .models.entities import User, TeamMembership


class Settings(BaseSettings):
    opsflow_demo_tokens: str = "{}"

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        extra="ignore",
    )


settings = Settings()
bearer = HTTPBearer(auto_error=False)


def get_token_map() -> dict[str, int]:
    try:
        raw = json.loads(settings.opsflow_demo_tokens)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            "OPSFLOW_DEMO_TOKENS must contain valid JSON"
        ) from exc

    if not isinstance(raw, dict):
        raise RuntimeError("Token configuration must be a JSON object")

    result = {}

    for token, user_id in raw.items():
        if not isinstance(token, str) or not token:
            raise RuntimeError("Tokens must be non-empty strings")
        if type(user_id) is not int or user_id < 1:
            raise RuntimeError("Token user IDs must be positive integers")
        result[token] = user_id

    return result


def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer),
    ],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Bearer token required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_map = get_token_map()
    user_id = None

    # Compare tokens without exposing the configured token values.
    for configured_token, configured_user_id in token_map.items():
        if secrets.compare_digest(
            credentials.credentials, configured_token
        ):
            user_id = configured_user_id

    if user_id is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.get(User, user_id)

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=401,
            detail="User not found or inactive",
        )

    return user


def require_team_role(
    db: Session,
    user: User,
    team_id: int,
    allowed_roles: set[str],
) -> TeamMembership:
    membership = (
        db.query(TeamMembership)
        .filter(
            TeamMembership.user_id == user.id,
            TeamMembership.team_id == team_id,
        )
        .first()
    )

    if membership is None:
        raise HTTPException(
            status_code=403,
            detail="You do not belong to this team",
        )

    if user.is_admin:
        return membership

    if membership.role not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail="Insufficient team permissions",
        )

    return membership