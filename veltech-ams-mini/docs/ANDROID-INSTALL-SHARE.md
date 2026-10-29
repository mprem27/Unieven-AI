# Install and share the Android APK

Share this public page with students:

**https://app.veltech-mini-ams.me/#/install**

It provides the Android APK, current release details, and installation instructions before sign-in. Settings → Android app & updates offers the same APK actions. **Share download page** uses the device share sheet when available and otherwise copies the guide link. **Copy APK link** copies the stable direct attachment:

`https://app.veltech-mini-ams.me/api/campus/app-release/latest.apk`

Both URLs use the app’s own domain. The direct URL always selects the latest locally published verified release and does not redirect to GitHub or another download host. Do not distribute CI artifact URLs or links to authenticated settings pages.

## On an Android phone

1. Open the public page above and select **Download Android APK**.
2. Open the browser’s Downloads and open `veltech-ams-mini-<version>.apk`. If Android asks, review the source and allow this browser to install the file.
3. Review and confirm **Install** or **Update** in Android. Open the app from Android’s app drawer. Existing APK users need an update signed with the same certificate and a higher Android version code.

The website reports **Download requested** after the link is pressed. It cannot confirm that the browser saved the APK or Android installed it. If nothing downloads, check the release again. If the server reports that the release changed, refresh the release details and use the new button.

Chrome’s menu item **Install app** or **Add to Home screen** installs a separate browser web app. Android may describe it as **From Chrome**, using the web manifest’s short name **Veltech mini**. That browser installation does not establish the Android package identity `in.velstudents.veltechams`. Browser standalone mode and URL query flags are never treated as proof that the APK is installed. The APK is a Trusted Web Activity: it uses a compatible browser to display the website, while its signed Android package and app-drawer entry are distinct from a Chrome-installed web app. Removing a browser web app is optional; the APK does not require deleting saved website data.

Android, the browser, and Play Protect control prompts and reputation warnings. A valid signature and working domain association cannot guarantee that a device suppresses warnings. Review warnings and stop if the source or package identity differs. Do not turn off Play Protect or other device protections. The web page cannot install silently or override the device’s decision.

## Delivery and integrity

Release metadata at `/api/campus/app-release` is public and contains no account information. The UI validates the package, version, size, SHA-256, and exact relative pinned URL `/api/campus/app-release/apk?sha=<sha256>` before exposing its primary download. The browser downloads this same-origin attachment directly, preserving the website origin in the download manager instead of using a JavaScript Blob URL. The server serves only the local APK named by its checked publication manifest, checks its SHA-256, and requires the expected checksum on the pinned endpoint. A changed checksum returns HTTP 409. The stable share link selects the latest verified release at the time it is opened.

The browser does not repeat the hash check in JavaScript before saving. HTTPS protects transport; server publication and hash checks protect release selection; Android verifies the APK’s signature during installation. Operators can independently compare the downloaded file to the displayed SHA-256. No remote redirect, caller-supplied file URL, new account permission, or new authentication mechanism is used. The exported byte-verification helper remains available for independent checks and existing tests.

## Deployment checks

Deploy the frontend, the verified release directory, and the generated `/.well-known/assetlinks.json` for **app.veltech-mini-ams.me** using the existing deployment guide. Metadata and both APK routes must work without signing in. Preserve `Cache-Control: no-store`, APK content type and attachment disposition. Bypass edge caching and HTML/challenge substitution for these existing public release endpoints; keep account and academic API protections intact. Do not publish signing keys or put them into Docker images.

Check the public metadata version/package/hash, download its exact pinned URL and compare the file’s SHA-256. Confirm the stable link returns the APK without an external redirect. Check an old checksum returns 409 after publishing a new release. Verify `/.well-known/assetlinks.json` over public HTTPS without redirects or challenge pages and with the expected package and signing certificate; a local signing receipt is not proof that the public association is live. Then test an actual Android installation and same-key update. A website deployment alone cannot replace an APK already on a phone.

Asset refresh and **Later** retain their existing behavior: website updates use the service worker lifecycle, retain sessions/private caches/saved downloads, and never reset or reinstall the native app.
