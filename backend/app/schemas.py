from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


WorkStatus = Literal[
    "open",
    "in_progress",
    "blocked",
    "awaiting_approval",
    "resolved",
    "closed",
]

WorkPriority = Literal["low", "medium", "high", "critical"]


class WorkItemCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(default="", max_length=5000)
    team_id: int = Field(gt=0)
    assignee_id: int | None = Field(default=None, gt=0)
    priority: WorkPriority = "medium"


class WorkItemUpdate(BaseModel):
    # The client must provide the version it last read.
    expected_version: int = Field(ge=1)

    title: str | None = Field(default=None, min_length=3, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    assignee_id: int | None = Field(default=None, gt=0)
    priority: WorkPriority | None = None
    status: WorkStatus | None = None


class WorkItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    team_id: int
    created_by: int
    assignee_id: int | None
    status: str
    priority: str
    version: int
    created_at: datetime
    updated_at: datetime


class WorkItemPage(BaseModel):
    items: list[WorkItemRead]
    total: int
    limit: int
    offset: int