# Student clarity update — setup and deployment

This is the same display version **2.3.3**. Android's internal update code is **20305**; package ID remains `in.velstudents.veltechams`. The existing logo master, navbar mark and app icons are unchanged. Only the whole-logo reveal and transition were smoothed.

## What students see

- Home leads with a compact current/next class and immediate Attendance, Results, Marks and Timetable shortcuts. Student information, full class list and subject totals remain available without filling the first screen. The most urgent publication stays visible; additional reminders expand in the same area.
- Academics is a primary phone tab and a single entry point for results, marks, registered courses, credits, exams, fees, documents and regulations. Section links preserve back/refresh behavior. `/course-registration` redirects to the canonical registered-course page.
- Marks has semester, unit-test/mid-term, lab, internal, subject and report/session selection. Zero, absence and unpublished marks remain distinct. A maximum appears only when explicitly supplied for that assessment; screenshots are not used to invent denominators. PDF and Excel use the selected records and fields.
- Results retain overall CGPA, percentage, line graphs, semester divisions and exports, with advanced calculation controls disclosed separately. Published numeric values win. Public and administrator-confirmed rules require exact programme/regulation/department applicability; otherwise a project estimate is labelled clearly. An unavailable rule check cannot silently become a numerical conversion. Known non-credit P/F outcomes cannot be guessed into credited averages.
- More is a separate grouped page. Events has a compact Vel Tech banner and earlier search/filter controls. Existing community, registrations, staff/admin operations and personal download settings remain present.

Home of VelTech supplied the workflow reference through the owner's screenshots and public listing. This project's layout, palette, navigation and community/event functions are its own. No protected native HOV login was established. Official university documents, not third-party app claims, support the calculation catalogue; see [academic regulations, sources and scoped policy migration](ACADEMIC-REGULATIONS.md).

## Open the preview

The separate preview ZIP contains `veltech-web-preview.html`, a walkthrough and Windows instructions. It uses fictional records and accepts only:

- Username: `student.demo`
- Password: `PreviewOnly!2026`

Extract it and open `START-HERE.html` in Chrome/Edge. If local HTML is blocked, run `node .\preview-server.cjs` in PowerShell and open `http://127.0.0.1:8089/#/login`. No Ubuntu or npm dependencies are needed for that helper. The preview blocks university login/sync, SMTP, payments and APK installation. It does not prove real AMS data or device attendance. The managed test browser blocks direct `file://` navigation; localhost was tested without changing that policy.

## Windows Docker setup

For a new installation, install Docker Desktop, extract the application folder, then use the supplied PowerShell setup/start scripts. The setup brings the required services into Docker. You do not need to install Ubuntu, local MongoDB, Python or Node to run the complete Docker deployment.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Setup.ps1
```

Follow [the Windows setup/upgrade guide](V2-UPGRADE.md) for the database profile, initial administrator and generated `.private` configuration. Open `http://localhost:4100` after startup. The unified login identifies student/faculty/admin access. A frontend-only Vite server still needs the combined API for real accounts.

## Upgrade an existing AWS/Cloudflare installation

Keep the existing Compose project name, database, volumes, private configuration and Android signing identity. Do not run a database reset or `down -v`. Copy the updated source, then rebuild with the same Compose files you already use. A typical production command is:

```powershell
docker compose --env-file .env.production -f compose.production.yaml up -d --build academic campus
```

PostgreSQL/FerretDB deployments include their existing `compose.postgres.production.yaml` override as well. Do not switch database profiles simply to apply a UI update. Existing Atlas installations retain their original URI and configuration. No new environment variable is required for this update.

**Existing academic-policy installations:** review [the one-time scoped-policy index migration](ACADEMIC-REGULATIONS.md). The new compound index is created first. Retiring the old batch/programme uniqueness constraint requires an explicit operator command; policy and student records are not deleted. Until that step, an extra department scope may return a clear409 rather than overwrite another rule. Review overlapping legacy policies before publishing new scopes. Tests used an isolated MongoDB API database; the PostgreSQL/FerretDB profile was not newly exercised here.

The academic connector still uses bounded upstream sessions, a source cooldown and a single academic worker. App refresh restores a valid app session; it does not manufacture a fresh AMS session after a university expiry or service restart. CAPTCHA is retained when AMS requires it. Do not run simultaneous identical source sessions per student to evade university limits.

## Publish the included Android release on your domain

The full ZIP has these siblings:

```text
veltech-ams-mini/
android-release/
  release.json
  <SHA256>.apk
START-HERE.md
```

From `veltech-ams-mini`, create your existing host media release folder and copy the **APK first**, then the manifest. With the default `.campus-media` host mount:

```powershell
New-Item -ItemType Directory -Force .\.campus-media\app-releases
Copy-Item ..\android-release\*.apk .\.campus-media\app-releases\
Copy-Item ..\android-release\release.json .\.campus-media\app-releases\release.json
```

If your installation uses a different persistent media mount, use that path. All campus replicas must read the same release folder. In `.private/campus.env`, retain:

```dotenv
CAMPUS_PUBLIC_URL=https://app.veltech-mini-ams.me
CAMPUS_ORIGINS=https://app.veltech-mini-ams.me
CAMPUS_COOKIE_SECURE=true
CAMPUS_APK_DIRECTORY=/app/media/app-releases
CAMPUS_ANDROID_PACKAGE_ID=in.velstudents.veltechams
```

Student sharing/installation links after deployment:

- `https://app.veltech-mini-ams.me/#/install`
- `https://app.veltech-mini-ams.me/api/campus/app-release/latest.apk`
- Release metadata: `https://app.veltech-mini-ams.me/api/campus/app-release`

The primary download pins the manifest SHA to `/api/campus/app-release/apk?sha=...`. It serves your own domain and checked local APK bytes. Share the installation URL or your own latest.apk URL, not a GitHub Actions artifact.

Cloudflare must pass those public release GET routes and `/.well-known/assetlinks.json` through without an interactive challenge or stale cached response. Keep private API authentication and other protections in place. Verify metadata, APK headers/hash and domain association in a normal browser after deployment. This environment could not verify the current live domain metadata, and no AWS/Cloudflare changes were made.

### Signing identity

This APK is genuinely release-signed with the retained workspace certificate:

```text
3B:44:DD:8A:C3:15:56:4A:27:A7:FA:2D:03:5C:3E:58:1A:FF:20:5A:7C:B6:E6:2C:E4:5E:28:3B:28:E4:C7:68
```

It can update compatible installed copies with the same package and certificate. A previous domain observation listed a different certificate; the inaccessible older Actions APK was not inspected. If your distributed APK uses another signing key, rebuild using your original Actions signing secrets. Never discard/replace that key or force users to uninstall to hide a mismatch. No private key or signing password is included in this ZIP.

The bundled public `assetlinks.json` must match the certificate you actually distribute. Domain association remains pending until the live HTTPS statement matches. Browser controls or Android's unknown-source/Play Protect warnings cannot be disabled by this app; physical-phone installation and update acceptance remain manual checks. Deploying the web update is required because the Android wrapper opens your domain.

## Configuration and GitHub

Use existing `.private/campus.env`, academic and database settings; [SMTP instructions and templates](EMAIL-SMTP.md) remain included. Keep secrets, signing keys, database volumes, `.campus-media`, `node_modules`, generated build folders and actual student data out of GitHub. Commit the clean source/config examples and docs. Public APK/manifest files are delivery assets only; publish them to your domain's release folder.

The connected GitHub integration currently rejects writes with HTTP403. This delivery therefore uses downloadable artifacts; no new public hosted preview, repository update or production deployment is claimed.

## Verification

See [verification details](VERIFICATION.md) and [Android verification](ANDROID-2.3-VERIFICATION.md). The full automated matrix, browser checks with fictional records, real campus-API session/offline restoration tests and SDK signature checks are separate evidence. Real upstream AMS/native HOV access, physical phones, production traffic, SMTP delivery and a fresh PostgreSQL/FerretDB run were not verified in this update.
