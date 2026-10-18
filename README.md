# OpsFlow

**A team-based operational work management platform.**

OpsFlow helps teams create, assign, track, and resolve work items through a shared workspace with team visibility, activity history, and controlled status transitions.

## Features

- **Work item management:** Create, view, search, filter, and update work items.
- **Lifecycle management:** Track work through statuses such as Open, In Progress, Blocked, Awaiting Approval, Resolved, and Closed.
- **Priority management:** Organize work by Low, Medium, High, and Critical priority.
- **Team collaboration:** View teams, team members, assignments, and team work-item counts.
- **Activity history:** Review recorded actions and changes.
- **Operational overview:** View summary metrics, status distribution, priority breakdowns, and recent activity.
- **Theme switching:** Switch between Obsidian/Emerald dark mode and Ivory/Peach/Tangerine light mode.
- **Responsive interface:** Navigate the workspace across desktop and smaller screens.
- **Concurrency safeguards:** Reject stale work-item updates using version checks.
- **Access controls:** Apply authentication and team-membership checks in the backend.

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite |
| Styling | CSS |
| Icons | Lucide React |
| Backend | Python, FastAPI |
| Data access | SQLAlchemy |
| Database | SQLite for local development |
| Testing | Pytest, FastAPI TestClient |

## Project Structure

```text
opsflow/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── models/
│   │   ├── services/
│   │   ├── auth.py
│   │   ├── database.py
│   │   ├── main.py
│   │   └── schemas.py
│   ├── tests/
│   ├── requirements.txt
│   └── seed.py
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── App.css
│   │   └── index.css
│   ├── package.json
│   └── vite.config.ts
├── .env.example
└── .gitignore
```

## Prerequisites

- Python 3.13 or a compatible Python version
- Node.js and npm
- Git

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/ArsenicAsh/opsflow.git
cd opsflow
```

### 2. Configure the backend

Create and activate a virtual environment from the repository root.

**Windows PowerShell:**

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Install the backend dependencies:

```powershell
cd backend
python -m pip install -r requirements.txt
```

Create the local environment configuration using `.env.example` as a reference. Copy it to the appropriate `.env` location and configure the required values according to the backend settings.

Never commit real credentials, tokens, or other secrets.

### 3. Start the backend

From the `backend` directory, run:

```powershell
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

The API will normally be available at:

`http://127.0.0.1:8000`

FastAPI's interactive API documentation is normally available at:

`http://127.0.0.1:8000/docs`

### 4. Start the frontend

Open another terminal:

```powershell
cd opsflow\frontend
npm install
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`.

The frontend development server proxies API requests to the backend. Start both services for the complete application.

### 5. Run the tests

From the repository root, with the virtual environment installed:

```powershell
cd backend
..\.venv\Scripts\python.exe -m pytest tests/test_work_items.py -v
```

### 6. Build the frontend

```powershell
cd frontend
npm run build
```

The production build is generated in `frontend/dist/`.

## Design

OpsFlow uses a shared component layout and two visual themes:

- **Dark:** Obsidian backgrounds with emerald and teal accents.
- **Light:** Warm ivory surfaces with peach highlights and tangerine accents.

The selected theme is saved in the browser so it can persist across page refreshes.

## Engineering Considerations

- Work-item state changes are validated against permitted lifecycle transitions.
- Version checks protect against stale concurrent updates.
- Team-membership checks restrict certain operations to authorized team members.
- Activity records provide a history of recorded work-item actions.
- Automated tests cover work-item creation and listing, stale updates, invalid status transitions, and cross-team membership enforcement.

## Development Status

OpsFlow is an actively developed software engineering challenge project. Local development and automated tests have been verified. Deployment, production authentication, and other operational hardening should be evaluated separately before using the application for real business data.

## License

No license has been specified yet. All rights remain with the respective copyright holders unless a license is added to this repository.
