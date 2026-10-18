
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models.entities import Activity, TeamMembership, User, WorkItem

router = APIRouter(prefix="/activity", tags=["Activity"])

Db = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


@router.get("")
def list_activity(
    db: Db,
    user: CurrentUser,
    limit: int = Query(default=30, ge=1, le=100),
):
    stmt = (
        select(
            Activity.id,
            Activity.work_item_id,
            WorkItem.title.label("work_item_title"),
            Activity.actor_id,
            User.name.label("actor_name"),
            Activity.action,
            Activity.details,
            Activity.created_at,
            WorkItem.team_id,
        )
        .join(WorkItem, WorkItem.id == Activity.work_item_id)
        .join(User, User.id == Activity.actor_id)
    )

    if not user.is_admin:
        accessible_teams = select(TeamMembership.team_id).where(
            TeamMembership.user_id == user.id
        )
        stmt = stmt.where(WorkItem.team_id.in_(accessible_teams))

    rows = db.execute(
        stmt.order_by(
            Activity.created_at.desc(), Activity.id.desc()
        ).limit(limit)
    ).all()

    return [
        {
            "id": row.id,
            "work_item_id": row.work_item_id,
            "work_item_title": row.work_item_title,
            "actor_id": row.actor_id,
            "actor_name": row.actor_name,
            "action": row.action,
            "details": row.details,
            "created_at": row.created_at,
        }
        for row in rows
    ]
