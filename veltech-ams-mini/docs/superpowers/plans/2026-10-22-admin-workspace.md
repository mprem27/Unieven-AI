# Administrative Workspace Implementation Plan

> Implement inline with executing-plans; an independent read-only security reviewer completed the required final review. Existing user authorization requests the complete implementation and ZIP.

**Goal:** Deliver a distinct administrative workspace with bounded action grants, moderation/mail, event operations and private student seating publication.

**Architecture:** Extend current Node/Mongo administration with shared permission helpers and separate admin metadata/login/outbox/seating collections. React reuses existing management modules inside an admin shell. The private FastAPI service parses supported uploaded seating documents without university requests.

**Tech Stack:** Existing React/Vite, Express/Mongoose/MongoDB, FastAPI/Python, SMTP; bounded XLSX and PDF parsing.

**Spec:** docs/superpowers/specs/2026-10-22-admin-workspace-design.md

## Global constraints
- Version remains 1.8.0; preserve keys/private configuration/source repositories and academic graphs/login fixes.
- One shared login; owners protected; no student-supplied VTU used for seating authorization.
- Deliver one full source ZIP with Windows/Docker instructions; no real email/AMS traffic during QA.

## Review focus
- Limited admin calls denied even when a button/API path is guessed; cannot grant actions beyond own ceiling.
- A deleted post's owner still sees the exact moderation reason once, including during mail failures/retry.
- Scanner cannot grant roles/edit an event, bypass payment, or scan/manually check in without the assigned capability.
- Duplicate/ambiguous VTU rows and malformed/oversized/active documents cannot become silently published seats.
- Withdrawn publications, changed accounts and stale requests must not expose other students' rows/files.

### 1. Access and directory
- [x] Write/run failing shared permission and real Mongo API tests for action grants, updates/ceilings, owner protection and admin login metadata.
- [x] Extend shared/admin-access.mjs, User/policy/public profile, admin guards and management grant normalization.
- [x] Add admin metadata/login collections and directory/overview; verify relevant suites.

### 2. Moderation and communication
- [x] Write/run failing API/worker tests for removal reasons, persistent owner notifications, recipient scope, idempotency and retries.
- [x] Add durable admin campaigns/deliveries and branded escaped email template; integrate scheduled jobs.
- [x] Add moderation routes/history and staff message routes with scoped recipients; verify.

### 3. Event operations
- [x] Write/run failing rules/delegate QR/manual/email tests; paid/inactive tickets remain denied.
- [x] Extend event schema/input, registration consent, authorized delegation/check-in helpers and event operations endpoints.
- [x] Verify existing event tests plus new cases.

### 4. Exam seating
- [x] Write/run parser and API tests for CSV/XLSX/PDF, duplicates, exact owner identity and withdrawal/file access.
- [x] Add private parser route and locked dependencies, private file/release/entry storage, explicit publish/withdraw APIs and owned student endpoint.
- [x] Verify parser/service/permission suites.

### 5. Admin and student interface
- [x] Build separate admin shell/dashboard, action-grant picker, directory, moderation, communications and event operations screens.
- [x] Add staff seating import/review/publish and student own-seat/download cards; visible-page refresh, errors and mobile wrapping.
- [x] Browser-test actual phone/desktop UI and connected synthetic API workflows; preserve student navigation/login/results.

### 6. Delivery
- [x] Run full frontend/campus/Python/Android suites and production build; build/test Docker if environment supports it.
- [x] Update docs/env requirements and verification evidence. Export complete source/web, verify archives/fresh extraction.
- [x] Publish immutable ZIP/guide/preview to the already authorized Clinical delivery branch; keep main untouched.
