# Verification — 2.3.5

| Suite | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Frontend | 453 | 0 | 0 |
| Campus API | 416 | 0 | 0 |
| Academic service | 227 | 0 | 1 |
| Android helpers | 27 | 0 | 0 |
| Total | 1,123 | 0 | 1 |

The complete application suites, academic service and Android helpers passed. The optional original exam-reference PDF test remains skipped because the user-uploaded attachment is no longer mounted; no assertion was weakened. Tests used disposable local databases, not production or a newly provisioned PostgreSQL/FerretDB service. The locked-source production Vite/PWA build and actual signed Gradle Android release build passed. Workflow resolution contracts and actionlint passed locally; a hosted GitHub Actions run was not triggered.

## Browser validation

The Browser plugin was unavailable. Installed Playwright and system Chromium checked the actual production frontend with fictional local accounts and real campus/academic APIs. Twelve web workflows covered first-time controlled verification, returning login, session restoration, official identity, regulation results, source-login rejection without app logout, responsive 320/390/430/1440px layouts, current PWA icons, encrypted offline recovery and console health.

Twelve additional native-mode browser checks used packaged production assets, the exact native Content Security Policy, real local APIs and a simulated Android message endpoint. They covered the first-party pinned APK address, Android update/share/permission requests, login and retained cookies after reload, absence of PWA/update-reset controls, academic Excel save transport, no service-worker registration, blob-media previews and mobile layout. This simulation does not establish physical Android device behavior.

Twenty-one launch/motion browser checks covered fresh public openings, same-tab refresh, intact current artwork, no private workspace mount on the download page, route stability, native return/picker behavior, draft retention, responsive size, press feedback, reduced/disabled motion and console health. Animation checks used event/timer state; CSS press feedback waited for rendered frames. Expected anonymous 401 responses, controlled rejected-source responses and deliberate offline failures were identified separately. No unexplained runtime or CSP error remained.

## Review and native evidence

Independent review found and corrected an absolute/relative native APK address mismatch, late transfer cleanup on account revocation, stale document callbacks, reused Android request codes and missing source-archive wrapper directories. Failing regressions were recorded before fixes; all pass. Owner generations also prevent an export from resuming after signing away and back to the same account. Camera intent compilation and precise/approximate location permission wiring were corrected.

The APK is an Android Activity containing bundled React screens in Android System WebView. It does not launch the main interface through Chrome, Trusted Web Activity or a PWA shortcut. The origin- and main-frame-restricted device bridge has bounded payloads/transfers. API calls retain the first-party HTTPS, cookies, authorization and CSRF boundaries. TLS verification, WebView debugging restrictions and blocked external privileged navigation remain in place. APK updates verify SHA-256, package, newer version and current signer before explicit Android installer approval.

The actual SDK independently verified the public APK again. Its local anonymous latest and SHA-pinned endpoints returned identical verified bytes with content length, attachment and nosniff headers; a stale checksum received 409. Domain association remains a separate optional check and does not control the APK window. See [Android evidence](ANDROID-2.3-VERIFICATION.md) and [rollout guide](RELEASE-v2.3.5.md).

## Remaining checks

No fresh real AMS or protected Home of VelTech authentication, production load/failover test, real SMTP/merchant delivery or physical Android installation/update was performed. Phone acceptance must cover WebView login/storage, save dialogs, camera/microphone/precise location, system notifications and installer approval. The current live website was not redeployed by this task. Preserve existing private configuration, signing identity and persistent volumes; do not reset data to apply an update.

The user selected mprem27/Unieven-AI for this release's project-download publication. The download branch preserves the existing main branch. A public link is valid only after successful publication and hosted-byte verification; publication evidence is recorded separately from these application tests. Android installation links inside the application continue to use its own domain.
