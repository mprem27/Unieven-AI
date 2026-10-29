# Android and web update deployment

The Android application ID stays `in.velstudents.veltechams`. Keep the existing
private signing key outside source/export archives; never regenerate it for an
update. Android requires the same signing certificate and a higher versionCode.
Read V2.3.3-STUDENT-CLARITY.md before rollout: the public server currently lists a different certificate from the APK prepared in this workspace. The supplied Actions artifact URL returned 404 during verification: its package,
version and signing certificate could not be established. Do not claim this
release can replace that unknown APK without checking it independently.

## Manual AWS / Cloudflare deployment

1. Build signed Android release using the existing signing identity and the
   documented Android build commands. The `Build signed Android release` workflow
   restores that key from environment secrets and independently verifies the APK.
   Download its artifact and retain the whole `public-release` directory. It has
   `release.json` and a SHA-256-named APK. The workflow artifact URL is an
   authenticated CI download, not a public student download link.
2. Alternatively, generate the same directory locally with the Android SDK set:

   ```sh
   node scripts/publish-android-release.mjs --apk=android/out/veltech-ams-mini-release.apk --receipt=android/out/signing-receipt.json --out=/tmp/public-release
   ```

3. Copy the verified directory to an AWS server path readable by the campus
   process, e.g. `/srv/veltech/app-releases`. Preserve the APK and manifest
   together. Set these **server** environment variables before restarting campus:

   ```dotenv
   CAMPUS_APK_DIRECTORY=/srv/veltech/app-releases
   CAMPUS_ANDROID_PACKAGE_ID=in.velstudents.veltechams
   ```

   For Docker mount it read-only and set `CAMPUS_APK_DIRECTORY=/app-releases`:
   `-v /srv/veltech/app-releases:/app-releases:ro`. The manifest is read on each
   request, so a later release can replace `release.json` atomically after its
   APK is copied. Keep old SHA-named APKs until the rollout is checked.
4. Deploy the frontend build and route `/api/campus/*` on the same HTTPS origin
   through Cloudflare to the campus server. Bypass Cloudflare caching for
   `/api/campus/app-release*`; preserve query
   strings and `Cache-Control: no-store`. Do not rewrite API errors to index.html.
5. Verify `GET /api/campus/app-release` returns `available:true`, expected package,
   version, certificate and checksum. Download its exact `url`, compare its
   SHA-256 with the manifest, then test an actual device upgrade. Publish the
   generated `assetlinks.json` at `/.well-known/assetlinks.json` for the real
   origin using the existing signing certificate. Never publish private keys.

Settings checks and validates the latest server metadata, then opens its exact
same-origin, checksum-pinned APK attachment in the browser download manager.
The server checks the local APK hash before serving it; the browser does not
repeat that check in JavaScript before saving. Android alone confirms installation and may
show installer or Play Protect prompts. An unknown installed version is labelled
unknown; URL parameters alone cannot establish installation. A verified Android
launch enables a global release check per authenticated owner, while
visible and online. Returning to the foreground or reconnecting checks again
after a 15-minute cooldown; simultaneous events share one in-flight request. Later defers that release for that owner for 24 hours.

The stable public install address is
`https://app.veltech-mini-ams.me/api/campus/app-release/latest.apk`.
It serves the local verified APK directly. No GitHub download or external
redirect is used for the APK. See [V2.3-UPGRADE.md](V2.3-UPGRADE.md) for the included
public release folder and exact Docker copy commands.

Share `https://app.veltech-mini-ams.me/#/install` for the public APK page and guide.
See [ANDROID-INSTALL-SHARE.md](ANDROID-INSTALL-SHARE.md) for the APK/browser-app
distinction, device prompt limits, sharing fallback, and delivery checks.

Web updates support Later for 24 hours per owner across pending web updates. Accepting the
update checks the service worker registration, waits for installation when needed,
activates the waiting worker and reloads after control changes. Settings offers
“Refresh app assets” to Android and web users with an explicit confirmation and
Later. It checks for new website assets and reloads without native reset or APK
reinstallation. Active and waiting Workbox workers can share a precache, so this
flow never deletes caches, cookies, local storage, IndexedDB or private downloads.
A failed update check leaves the app running; declining never reloads. No real AMS
or production writes are part of this process.
