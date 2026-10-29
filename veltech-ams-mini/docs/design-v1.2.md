# UniEve Campus V1.2

The user requests one combined project, Windows PowerShell startup through Docker Desktop, MongoDB Atlas, removal of the retired parent portal, and improved access to their own VelTech/AMS records. Existing design choices were delegated to the assistant. This update follows those selected constraints.

## Project and startup

One root folder contains `web`, `services/campus`, `services/academic`, Docker build files, a Compose file and root PowerShell setup/start/stop commands. The React interface is the only application interface. The original event/account models remain compatible. Node and Python run inside containers. Atlas stores two separately named databases for community and academic data; no local MongoDB or user-installed Ubuntu is required. Docker Desktop may use its own WSL backend internally.

Setup privately prompts for the Atlas URI and first administrator details, generates persistent keys once, builds frozen dependencies, verifies database access and provisions the administrator without printing secrets. Private configuration is excluded from source exports and build contexts. Start validates Docker readiness and service health. Stop preserves configuration and data. Local access binds the published web port to Windows loopback. Hosted HTTPS deployment uses secure cookies.

## One account flow

New campus accounts receive their own academic workspace through a service-authenticated internal bridge. The browser does not receive the bridge credential. The bridge binds a unique campus account identifier to an academic student and issues only that student's token; it cannot claim an existing academic record merely by matching email. Existing academic accounts keep explicit password verification for migration. Server role checks continue to protect events, clubs, departments and private records.

## University data

Retired parent URLs are removed from source checks, university connection UI and active sync routes. Home of VelTech's public listing/privacy describe a student-developed AMS client, not a separate university source. The UI links that app as a reference, not as an official authenticated backend, and never sends supplied credentials to its developer.

The AMS adapter retains its session cookie, nonce and manually answered CAPTCHA. It loads source-confirmed own profile/photo, courses, bucket and timetable. Attendance/results parsers may be added only with grounded page evidence; discovery is restricted to read-only AMS-origin page links in the authenticated student dashboard. Unsupported pages remain unavailable with a source-specific reason. Failed login or missing records never imply absence, and demo records never enter a connected account. Full source parity is not claimed without successful live authenticated verification.

## Validation and delivery

Tests cover private configuration generation/reuse, URI validation, service-bridge ownership and existing-account collisions, container HTTP binding/cookies, source retirement and any added data parser. Docker builds and actual service health/account/event flows are checked with isolated fictional data. Windows PowerShell syntax and configuration/startup logic are checked; actual Windows execution requires the user's Docker Desktop. Atlas-specific live access requires their private connection URI and network allowance.

A sanitized single-folder source ZIP, built PWA ZIP, setup guide, checksum manifest and verification report are hosted in the already-authorized Clinical delivery repository without changing its main application. Real portal credentials, private runtimes and actual student records are excluded.
