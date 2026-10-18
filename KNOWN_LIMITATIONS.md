# Known Limitations — OpsFlow

## 1. Authentication Is for Demonstration

The application uses configured bearer tokens mapped to user IDs. This is suitable for the current local demonstration but is not a complete production identity system.

There is no claim of production-grade authentication, token lifecycle management, or a full password-reset and account-recovery flow.

**Future improvement:** Integrate a proper identity provider or implement a hardened authentication system with secure token issuance, expiration, revocation, and account management.

## 2. Local Database Configuration

The application uses SQLite to simplify setup and local evaluation. This is not a deployment architecture validated for high-concurrency, multi-instance production workloads.

**Future improvement:** Evaluate PostgreSQL and an appropriate database migration and backup strategy for production deployment.

## 3. Demo Token Configuration

The frontend uses a configured demo bearer token, and the backend must be configured to recognize it. The token is not intended to represent a secure production credential.

Environment configuration must be completed before running the application locally. The actual `.env` file and database file must not be committed to the public repository.

**Future improvement:** Replace the demo token flow with secure per-user authentication and environment-specific secret management.

## 4. Concurrency Handling

Version checks detect stale updates and prevent a client from silently overwriting a newer version of a work item. This does not constitute a complete distributed concurrency-control strategy for every possible multi-instance deployment.

**Future improvement:** Test concurrency behavior under greater load and evaluate database-level locking or other coordination mechanisms where needed.

## 5. Test Coverage

The automated backend tests cover key work-item behaviors, including creation and listing, stale-update rejection, invalid status transitions, and team-membership enforcement.

They do not establish complete coverage of every frontend interaction, authorization combination, failure scenario, integration boundary, or deployment configuration.

**Future improvement:** Expand tests to cover authentication failures, role-based access cases, team and activity endpoints, frontend workflows, and end-to-end scenarios.

## 6. Operational Monitoring

The project includes a health endpoint, but it does not provide a complete production observability system.

**Future improvement:** Add structured logging, error monitoring, metrics, alerting, and operational dashboards appropriate to the deployment environment.

## 7. Deployment and Production Hardening

Successful local execution and a frontend production build do not, by themselves, establish that the application is production-ready. Deployment security, infrastructure configuration, scaling, backup recovery, and operational procedures require separate validation.

**Future improvement:** Establish a deployment pipeline, production configuration, security review, and documented recovery procedures before production use.

## 8. Scope of the Current Project

OpsFlow focuses on work-item management, teams, workflow validation, concurrency checks, and activity history. Features beyond the implemented scope should not be assumed to exist.

Potential future extensions include notifications, richer reporting, advanced filtering, and more comprehensive user administration.

---

These limitations describe the current project's intended scope and known architectural trade-offs. They should be revised as implementation or deployment capabilities change.