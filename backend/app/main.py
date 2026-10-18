from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from .models import entities
from .api.work_items import router as work_items_router
from .api.teams import router as teams_router
from .api.activity import router as activity_router

from .database import Base, engine, get_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize tables when the application starts.
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="OpsFlow API",
    description="Operational work management system",
    version="0.1.0",
    lifespan=lifespan,
)
app.include_router(work_items_router)
app.include_router(teams_router)
app.include_router(activity_router)

@app.get("/")
def root():
    return {
        "message": "Welcome to OpsFlow",
        "status": "running",
    }


@app.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "database": "connected",
        }
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail="Database unavailable",
        ) from exc