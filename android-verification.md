# Android release verification — 2.3.5

- Runtime: standalone Android Activity, locally bundled React screens and Android System WebView.
- Package: `in.velstudents.veltechams`; version `2.3.5`; internal code `20307`.
- APK: 11,937,687 bytes.
- SHA-256: `6dcd7987d09c64c910718ad11af64e4fb912a0df14cc969b1a311b698103fcae`.
- Retained workspace certificate: `3B:44:DD:8A:C3:15:56:4A:27:A7:FA:2D:03:5C:3E:58:1A:FF:20:5A:7C:B6:E6:2C:E4:5E:28:3B:28:E4:C7:68`.
- Bundled asset digest: `2ac930a1233c4b00abe97a3e40701acde13a74291f6190f2cf5960211b1badf7`.
- Connected API origin: `https://app.veltech-mini-ams.me`.

Gradle release build, SDK apksigner v2/v3 verification, selected-keystore certificate comparison, aapt package/version/launchable/nondebug identity, 16 KiB zipalign and independent publisher verification passed. The local anonymous latest and SHA-pinned routes served the actual matching APK without PWA/login/GitHub redirects, with verified length and checksum; stale checksum was rejected. The public release manifest is atomic and the key stays private.

The approved whole logo design/colours are preserved and current versioned artwork is bundled in the UI and launcher. The website and PWA receive the same current assets; native UI updates require an APK update. The APK does not register a website service worker or depend on Chrome/TWA/domain verification to render its primary screen.

The retained certificate matches previous workspace builds. The older inaccessible Actions APK could not be inspected; compatibility with a different owner-held key is unverified. Preserve the package and actual installed signing key. Do not ask users to uninstall or erase data to hide a key mismatch. The first TWA-to-native migration can need one login because browser and WebView storage are separate; later same-key native updates preserve WebView data.

No physical phone/emulator acceptance was performed. Android controls security warnings and installer approval. Domain association is currently pending and optional for this standalone runtime. No AWS/Cloudflare deployment occurred. Follow [the Android guide](ANDROID.md) and [release rollout](RELEASE-v2.3.5.md).
