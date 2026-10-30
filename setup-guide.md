# Release 2.3.5

Combined student/faculty/administrator app. Android package **in.velstudents.veltechams**, version **2.3.5**, versionCode **20307**. Existing origin: **https://app.veltech-mini-ams.me**.

## Changes

- The APK opens a native Android Activity containing bundled React screens in Android System WebView. Chrome/TWA no longer hosts its main screen. The shared UI is not a native-widget rewrite. Bundled static assets belong to the APK version; `/api/*` continues to the existing same-origin HTTPS backend with existing auth protections.
- Native saving uses Android's picker, sharing uses the system share sheet, and camera/microphone/location require explicit permission. Optional foreground alerts honor permission/preferences. Background push while the APK is closed is not promised.
- Native updates download only the own-origin pinned APK endpoint, reject redirects and check checksum/package/version/signing identity before opening Android's installer. Android controls approval/warnings. Website/PWA updates retain their separate opt-in lifecycle; native runs no website service worker or PWA-install offer.
- The approved logo keeps its design/colours with current versioned artwork. Whole-logo opening animation replays on fresh document openings and qualifying longer native returns, while normal navigation and short picker/permission returns preserve the current screen. Reduced-motion/disabled-animation preferences remain respected.
- Android preparation validates local `app-build.json`, version and artwork. A deployed new frontend and live domain association are no longer compilation prerequisites. `--require-domain-association` is an optional extra gate.
- GitHub workflows accept complete source at repository root or `veltech-ams-mini/`, identify missing signing secrets early and reject ZIP-only delivery branches clearly. They preserve real test/build/signature failures.

Existing [student login, sync and academic calculation rules](V2.3.4-STUDENT-SYNC.md), account isolation and encrypted saved-record behavior remain in place. No database-profile change, password reset or backend trust bypass is required.

## Upgrade and build

Continue with [Windows Docker setup](V2-UPGRADE.md) and the existing AWS/Cloudflare deployment. No Ubuntu installation is required. Preserve `.private`, databases, media volumes, session/encryption/VAPID keys and Android signing identity. Do not run `down -v`, clear app data or uninstall as an update step.

For a locally signed APK, install the [Node/JDK/Android SDK prerequisites](ANDROID.md), restore the existing key privately, then run from the project root:

```powershell
npm --prefix frontend ci
npm --prefix frontend run build
npm --prefix android ci
npm --prefix android test
node scripts/android-prepare.mjs --config android/config.release.json --local-web frontend/dist
node scripts/android-build.mjs --config android/config.release.json
node scripts/publish-android-release.mjs --apk=android/out/veltech-ams-mini-release.apk --receipt=android/out/signing-receipt.json --out=app-releases --notes="Native Android 2.3.5"
```

The Windows helper prompts for signing passwords. Domain association is nonblocking by default; add `--require-domain-association` only for an intentional live gate. CI/private signing-secret setup is in [GITHUB.md](GITHUB.md). Private keys/passwords are excluded from source, ZIPs, images and public artifacts.

The first TWA-to-native update may need one login because browser and WebView storage are separate. Later same-key native updates preserve cookies, IndexedDB and app-private data. Expired/revoked sessions still need authentication. Compare the signing certificate with the APK actually distributed; earlier domain evidence showed a different certificate and the inaccessible older Actions APK could not be verified.

## Operator rollout checklist

These are rollout checks, not claims that a phone or production deployment has already been tested.

- [ ] Check the signed APK/receipt report 2.3.5/20307, `in.velstudents.veltechams`, the retained certificate and matching SHA-256; independently verify signature, release identity and 16 KiB alignment.
- [ ] Confirm the APK bundles current 2.3.5 `app-build.json` and artwork; open its primary screen without Chrome and check that unavailable APIs fail clearly without changing bundled assets.
- [ ] Back up private configuration/data/keys; deploy website/API with the existing AWS/Cloudflare topology and database profile, preserving volumes and cookie/CORS/TLS policies.
- [ ] Copy the verified SHA-named APK, then atomically replace `release.json` in the shared persistent directory. Retain the settings in [the deployment guide](ANDROID-UPDATE-DEPLOYMENT.md).
- [ ] Verify public metadata, pinned APK and `latest.apk` on the own domain without sign-in, caching, challenges or external redirects; compare actual downloaded hashes. Verify protected APIs reject unauthenticated access.
- [ ] If maintaining/requiring association, independently verify the live `assetlinks.json` package/certificate; a local receipt does not prove deployed association.
- [ ] On an actual Android phone, verify install/update approval, one-time TWA migration login, subsequent native update session/data retention, back/keyboard/navigation, two-account isolation and saved records.
- [ ] Verify file save/cancel, sharing, camera/microphone/location denial/grant, notification preferences and opening animation. Test live AMS only with an authorized account; fictional-record tests do not establish upstream access.
- [ ] Share `https://app.veltech-mini-ams.me/#/install` after verifying the published APK. Retain previous server images/public files for recovery without resetting storage; Android fixes need a higher versionCode rather than a forced downgrade.

Project download links use [mprem27/Unieven-AI](https://github.com/mprem27/Unieven-AI), as selected by the user. The publisher verifies hosted ZIP bytes before sharing a download link and preserves the existing main branch. No AWS/Cloudflare deployment or real-phone/live-AMS acceptance is claimed here. Check build/test evidence and actual delivered files separately from this checklist.
