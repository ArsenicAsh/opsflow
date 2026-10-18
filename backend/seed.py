from sqlalchemy import select

from app.database import Base, engine, SessionLocal
from app.models.entities import User, Team, TeamMembership

Base.metadata.create_all(bind=engine)

with SessionLocal() as db:
    team = db.scalar(
        select(Team).where(Team.name == "Operations")
    )
    if team is None:
        team = Team(name="Operations")
        db.add(team)
        db.flush()

    demo_users = [
        ("admin@opsflow.local", "Demo Admin", True),
        ("manager@opsflow.local", "Demo Manager", False),
        ("member@opsflow.local", "Demo Member", False),
    ]

    users = {}
    for email, name, is_admin in demo_users:
        user = db.scalar(
            select(User).where(User.email == email)
        )
        if user is None:
            user = User(
                email=email,
                name=name,
                is_admin=is_admin,
            )
            db.add(user)
            db.flush()
        users[email] = user

    memberships = [
        (users["manager@opsflow.local"], "manager"),
        (users["member@opsflow.local"], "member"),
    ]

    for user, role in memberships:
        membership = db.scalar(
            select(TeamMembership).where(
                TeamMembership.user_id == user.id,
                TeamMembership.team_id == team.id,
            )
        )
        if membership is None:
            db.add(
                TeamMembership(
                    user_id=user.id,
                    team_id=team.id,
                    role=role,
                )
            )

    db.commit()

    print(f"Seeded team: {team.name} (ID {team.id})")
    for email, user in users.items():
        print(f"{email}: user ID {user.id}")