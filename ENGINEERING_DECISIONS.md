# Engineering Decisions — OpsFlow

## 1. Overview

OpsFlow is a team-based work management application designed to demonstrate reliable workflow handling, access control, conflict detection, and activity tracking.

The engineering approach prioritizes a clear separation between frontend and backend responsibilities, explicit validation of workflow transitions, and predictable API behavior.

## 2. Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React, TypeScript, Vite | Component-based UI, type safety, and a fast development workflow |
| Styling | CSS | Customizable interface and theme support |
| Backend | Python, FastAPI | Typed API contracts, request validation, and straightforward REST API development |
| Data validation | Pydantic | Validates request and response data at API boundaries |
| ORM | SQLAlchemy | Models database entities and manages database interactions |
| Database | SQLite | Simple local setup with no separate database server required |
| Testing | pytest | Automated verification of important backend behavior |

## 3. Frontend and Backend Separation

The frontend communicates with the FastAPI backend through HTTP endpoints. Vite proxies the application's API paths to the local backend during development.

This separation keeps UI behavior independent of persistence and business rules. The backend remains responsible for validating operations and enforcing authorization.

## 4. Data Modeling and Persistence

SQLAlchemy models represent the application's core entities, including work items, teams, users, and activity records.

SQLite was selected to keep the development and demonstration environment lightweight. Database initialization and demo-data setup are handled by the backend's initialization and seed scripts.

## 5. Authentication and Authorization

API requests use bearer-token authentication. The backend resolves configured demo tokens to users and checks that users are active.

Team-scoped operations enforce membership and role requirements. Administrative access is handled separately from ordinary team membership.

The demo token configuration is intended for local evaluation, not production authentication.

## 6. Workflow Validation

Work-item status changes are validated by the backend rather than trusting the frontend to enforce the workflow.

Invalid transitions are rejected, keeping business rules centralized and preventing clients from bypassing the intended lifecycle through direct API requests.

## 7. Optimistic Concurrency Control

Work items use version information to detect stale updates. If a client attempts to update an outdated version, the backend rejects the conflicting update rather than silently overwriting newer data.

This approach makes concurrent-edit conflicts visible to the client.

## 8. Activity History

Important work-item operations are recorded in an activity history. This gives users a record of relevant changes and provides a basic audit trail for the application's workflows.

## 9. Automated Testing

The backend test suite covers important behavior, including:

- Creating and listing work items.
- Rejecting stale updates.
- Rejecting invalid status transitions.
- Preventing non-members from creating work items in another team.

The frontend production build is also checked to catch TypeScript and build-time errors.

## 10. Design and Usability

The interface supports light and dark themes, with theme preference persistence. The UI is organized around work items, team context, and activity history to make core workflows accessible without navigating unrelated screens.

## 11. Deliberate Trade-offs

- SQLite reduces setup complexity for a local demonstration.
- A lightweight bearer-token configuration avoids the overhead of a full identity provider.
- Backend validation and automated tests are prioritized for core workflow correctness.
- The application is designed as a demonstrable engineering challenge project rather than a fully hardened production service.

These choices keep the project focused while leaving clear paths for future extension.