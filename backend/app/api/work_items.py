
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models.entities import (
    Activity,
    TeamMembership,
    User,
    WorkItem,
    utc_now,
)
from ..schemas import WorkItemCreate, WorkItemPage, WorkItemRead, WorkItemUpdate


router = APIRouter(prefix="/work-items", tags=["Work items"])

Db = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]

ALLOWED_TRANSITIONS = {
    "open": {"in_progress", "blocked", "closed"},
    "in_progress": {"blocked", "awaiting_approval", "resolved", "open"},
    "blocked": {"in_progress", "open"},
    "awaiting_approval": {"resolved", "in_progress"},
    "resolved": {"closed", "in_progress"},
    "closed": set(),
}


def can_access_team(db: Session, user: User, team_id: int) -> bool:
    if user.is_admin:
        return True

    return db.scalar(
        select(TeamMembership.id).where(
            TeamMembership.user_id == user.id,
            TeamMembership.team_id == team_id,
        )
    ) is not None


def verify_assignee(
    db: Session,
    assignee_id: int | None,
    team_id: int,
) -> None:
    if assignee_id is None:
        return

    membership = db.scalar(
        select(TeamMembership.id).where(
            TeamMembership.user_id == assignee_id,
            TeamMembership.team_id == team_id,
        )
    )

    if membership is None:
        raise HTTPException(
            status_code=422,
            detail="Assignee must belong to the item's team",
        )

    assignee = db.get(User, assignee_id)

    if assignee is None or not assignee.is_active:
        raise HTTPException(status_code=422, detail="Invalid assignee")


def get_authorized_item(
    db: Session,
    user: User,
    item_id: int,
) -> WorkItem:
    item = db.get(WorkItem, item_id)

    if item is None:
        raise HTTPException(status_code=404, detail="Work item not found")

    if not can_access_team(db, user, item.team_id):
        raise HTTPException(status_code=403, detail="Team access denied")

    return item


# ---------------------------------------------------------
# TEAM MEMBERS
# ---------------------------------------------------------

@router.get("/team-members")
def list_team_members(
    db: Db,
    user: CurrentUser,
    team_id: int = Query(gt=0),
):
    if not can_access_team(db, user, team_id):
        raise HTTPException(status_code=403, detail="Team access denied")

    members = db.execute(
        select(User.id, User.name, User.email, TeamMembership.role)
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


# ---------------------------------------------------------
# CREATE WORK ITEM
# ---------------------------------------------------------

@router.post("", response_model=WorkItemRead, status_code=201)
def create_work_item(
    payload: WorkItemCreate,
    db: Db,
    user: CurrentUser,
):
    if not can_access_team(db, user, payload.team_id):
        raise HTTPException(status_code=403, detail="Team access denied")

    verify_assignee(db, payload.assignee_id, payload.team_id)

    item = WorkItem(
        title=payload.title,
        description=payload.description,
        team_id=payload.team_id,
        created_by=user.id,
        assignee_id=payload.assignee_id,
        priority=payload.priority,
    )

    db.add(item)
    db.flush()

    db.add(
        Activity(
            work_item_id=item.id,
            actor_id=user.id,
            action="created",
            details={"title": item.title},
        )
    )

    db.commit()
    db.refresh(item)

    return item


# ---------------------------------------------------------
# LIST WORK ITEMS
# ---------------------------------------------------------

@router.get("", response_model=WorkItemPage)
def list_work_items(
    db: Db,
    user: CurrentUser,
    team_id: int | None = Query(default=None, gt=0),
    status: str | None = None,
    priority: str | None = None,
    search: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    stmt = select(WorkItem)

    if not user.is_admin:
        accessible_teams = select(TeamMembership.team_id).where(
            TeamMembership.user_id == user.id
        )
        stmt = stmt.where(WorkItem.team_id.in_(accessible_teams))

    if team_id is not None:
        if not can_access_team(db, user, team_id):
            raise HTTPException(status_code=403, detail="Team access denied")

        stmt = stmt.where(WorkItem.team_id == team_id)

    if status is not None:
        if status not in ALLOWED_TRANSITIONS:
            raise HTTPException(status_code=422, detail="Invalid status")

        stmt = stmt.where(WorkItem.status == status)

    if priority is not None:
        if priority not in {"low", "medium", "high", "critical"}:
            raise HTTPException(status_code=422, detail="Invalid priority")

        stmt = stmt.where(WorkItem.priority == priority)

    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            or_(
                WorkItem.title.ilike(pattern),
                WorkItem.description.ilike(pattern),
            )
        )

    total = db.scalar(
        select(func.count()).select_from(stmt.subquery())
    ) or 0

    items = db.scalars(
        stmt.order_by(WorkItem.updated_at.desc(), WorkItem.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()

    return WorkItemPage(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


# ---------------------------------------------------------
# READ ONE WORK ITEM
# ---------------------------------------------------------

@router.get("/{item_id}", response_model=WorkItemRead)
def read_work_item(
    item_id: int,
    db: Db,
    user: CurrentUser,
):
    return get_authorized_item(db, user, item_id)


# ---------------------------------------------------------
# UPDATE WORK ITEM
# ---------------------------------------------------------

@router.patch("/{item_id}", response_model=WorkItemRead)
def update_work_item(
    item_id: int,
    payload: WorkItemUpdate,
    db: Db,
    user: CurrentUser,
):
    item = get_authorized_item(db, user, item_id)
    membership = None

    if not user.is_admin:
        membership = db.scalar(
            select(TeamMembership).where(
                TeamMembership.user_id == user.id,
                TeamMembership.team_id == item.team_id,
            )
        )

    changes = payload.model_dump(
        exclude_unset=True,
        exclude={"expected_version"},
    )

    if not changes:
        raise HTTPException(status_code=422, detail="No changes supplied")

    for field in ("title", "description", "priority", "status", "assignee_id"):
        if field in changes and changes[field] is None:
            raise HTTPException(
                status_code=422,
                detail=f"{field} cannot be null",
            )

    if "assignee_id" in changes:
        verify_assignee(db, changes["assignee_id"], item.team_id)

    if "status" in changes:
        new_status = changes["status"]

        if (
            new_status != item.status
            and new_status not in ALLOWED_TRANSITIONS[item.status]
        ):
            raise HTTPException(
                status_code=409,
                detail=f"Invalid transition: {item.status} -> {new_status}",
            )

        if new_status == "awaiting_approval":
            if not user.is_admin and (
                membership is None or membership.role != "manager"
            ):
                raise HTTPException(
                    status_code=403,
                    detail="Only a manager or administrator can request approval",
                )

        if (
            item.status == "awaiting_approval"
            and new_status in {"resolved", "in_progress"}
        ):
            if not user.is_admin and (
                membership is None or membership.role != "manager"
            ):
                raise HTTPException(
                    status_code=403,
                    detail="Only a manager or administrator can decide approval",
                )

    # Atomic compare-and-swap: only one update can claim this version.
    statement = (
        update(WorkItem)
        .where(
            WorkItem.id == item_id,
            WorkItem.version == payload.expected_version,
        )
        .values(
            **changes,
            version=WorkItem.version + 1,
            updated_at=utc_now(),
        )
    )

    result = db.execute(statement)

    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Work item changed since you last read it. Refresh and retry.",
        )

    db.add(
        Activity(
            work_item_id=item_id,
            actor_id=user.id,
            action="updated",
            details={
                "changes": changes,
                "previous_version": payload.expected_version,
                "new_version": payload.expected_version + 1,
            },
        )
    )

    db.commit()

    return db.get(WorkItem, item_id)
