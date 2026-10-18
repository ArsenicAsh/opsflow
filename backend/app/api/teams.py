
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models.entities import Team, TeamMembership, User, WorkItem

router = APIRouter(prefix="/teams", tags=["Teams"])

Db = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]



@router.get("")
def list_teams(db: Db, user: CurrentUser):
    stmt = (
        select(
            Team.id,
            Team.name,
            Team.created_at,
            func.count(
                func.distinct(TeamMembership.user_id)
            ).label("member_count"),
            func.count(
                func.distinct(WorkItem.id)
            ).label("work_item_count"),
        )
        .select_from(Team)
        .outerjoin(
            TeamMembership,
            (TeamMembership.team_id == Team.id)
            & (
                TeamMembership.user_id.in_(
                    select(User.id).where(User.is_active.is_(True))
                )
            ),
        )
        .outerjoin(
            WorkItem,
            WorkItem.team_id == Team.id,
        )
        .group_by(Team.id, Team.name, Team.created_at)
    )

    if not user.is_admin:
        accessible_teams = select(TeamMembership.team_id).where(
            TeamMembership.user_id == user.id
        )
        stmt = stmt.where(Team.id.in_(accessible_teams))

    rows = db.execute(stmt.order_by(Team.name)).all()

    return [
        {
            "id": row.id,
            "name": row.name,
            "created_at": row.created_at,
            "member_count": row.member_count,
            "work_item_count": row.work_item_count,
        }
        for row in rows
    ]



@router.get("/{team_id}/members")
def list_team_members(
    team_id: int,
    db: Db,
    user: CurrentUser,
):
    from fastapi import HTTPException

    if team_id <= 0:
        raise HTTPException(status_code=422, detail="Invalid team ID")

    if not user.is_admin:
        has_access = db.scalar(
            select(TeamMembership.id).where(
                TeamMembership.team_id == team_id,
                TeamMembership.user_id == user.id,
            )
        )
        if has_access is None:
            raise HTTPException(
                status_code=403, detail="Team access denied"
            )

    team = db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")

    members = db.execute(
        select(
            User.id, User.name, User.email, TeamMembership.role
        )
        .join(TeamMembership, TeamMembership.user_id == User.id)
        .where(
            TeamMembership.team_id == team_id,
            User.is_active.is_(True),
        )
        .order_by(User.name)
    ).all()

    return [
        {
            "id": member.id,
            "name": member.name,
            "email": member.email,
            "role": member.role,
        }
        for member in members
    ]
