# UniEve Campus V1.2 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline; one independent final review.

**Goal:** Deliver one project running from Windows PowerShell with Docker Desktop and MongoDB Atlas, with a clearer and improved AMS connection.

**Architecture:** React is built into the campus Node service. A private Python academic container supplies authorized student data. A service-authenticated account bridge removes separate academic sign-in for newly provisioned accounts. Root PowerShell scripts configure Atlas and persistent keys, build, provision, start and stop Compose.

**Tech Stack:** Node 24, React 19, Python 3.12, FastAPI, Express, MongoDB Atlas, Docker Compose, PowerShell 5.1+.

**Spec:** `docs/design-v1.2.md`.

## Global Constraints

- One extracted project folder; no sibling-repository dependencies.
- Windows PowerShell + Docker Desktop; no user Ubuntu/Node/Python/mongod installation.
- Atlas URI and generated keys remain local/private and are never printed or archived.
- Retired parent portal must not be contacted by active sync paths.
- Manual CAPTCHA only; read only the authorized student's university records.
- No connected-mode demo substitution or unverified full-data claims.

## Review Focus

- Existing private configuration must survive repeated setup.
- Invalid Atlas URI and reserved URI characters must fail safely without exposing credentials.
- A matching email must not grant ownership of an existing academic record.
- HTTP localhost cookies must work while HTTPS deployment defaults remain secure.
- Failed or partial university sync must preserve existing confirmed records.

## Task 1: Docker and PowerShell project startup

**Files:** `compose.yaml`, `docker/*.Dockerfile`, `scripts/CampusTools.psm1`, root `Setup.ps1`, `Start.ps1`, `Stop.ps1`, `.dockerignore`, `.gitignore`, `tests/powershell.ps1`, campus HTTP configuration.

**Interfaces:** Produces private campus/academic env files, persistent encryption/service keys, and health-checked web port 4100. Academic API is private at `http://academic:8000/api/v1`.

- [ ] Add configuration tests for URI handling, persistent keys, partial configuration and secret exclusion; run RED before helper implementation.
- [ ] Implement PowerShell-compatible helpers and scripts; validate parser syntax and GREEN behavior.
- [ ] Build immutable-lockfile Docker stages with optional cloud CA secret mounts; expose Node on 0.0.0.0 inside its container and publish loopback only.
- [ ] Exercise Compose build/start/health/restart/stop with isolated fictional data and no Atlas credential values.

## Task 2: Single account workflow

**Files:** academic campus bridge route/service and DB indexes, campus academic client/routes, Settings UI; Python and Node ownership tests.

**Interfaces:** Internal authenticated bridge consumes campus ID/email/name and returns that user's academic token. Existing accounts require explicit verification; browser still calls only the campus API.

- [ ] Add RED tests for bridge authentication, campus-ID ownership, existing-email collision and token renewal.
- [ ] Implement idempotent academic workspace provisioning; refresh expired academic tokens through the verified binding.
- [ ] Integrate automatic linking and account-safe UI states; run backend/Python/frontend suites.

## Task 3: University sources and data coverage

**Files:** academic university source registry, AMS adapter/parsers, campus sync routes, Settings connection/status UI, source/parser tests.

**Interfaces:** Public source metadata identifies AMS, university website and the third-party Home app. Authenticated sync returns data coverage and partial-source errors without inventing records.

- [ ] Add RED tests proving retired URLs are not checked/contacted, and source coverage is accurate.
- [ ] Research public AMS/Home contracts; implement only grounded own-data parsing/discovery and document unsupported fields.
- [ ] Run actual read-only checks only after a fresh manual challenge answer; keep private values out of artifacts.
- [ ] Browser-check account/connection/mobile behavior and compare existing UI flows.

## Task 4: Review and delivery

**Files:** `README.md`, `scripts/export.py`, manifests and verification artifacts.

- [ ] Review the complete change independently and fix material findings with regression coverage.
- [ ] Verify source extraction contains one root, all Docker inputs and no secrets/private student patterns.
- [ ] Publish versioned ZIPs and guide in Clinical, verify anonymous downloads and hashes, and preserve Clinical main.
- [ ] Save concise reusable cloud startup notes and report live-source and Windows/Atlas verification limits.
