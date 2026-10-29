# Login and sync welcome

The shared sign-in remains one page for students, faculty and administrators. The full-screen welcome appears **only after authentication succeeds**. If AMS requests a CAPTCHA, students complete it on the sign-in form first. Pending credentials and incorrect-password errors do not show the welcome. A saved valid session restores without requesting the university password again.

After verification, the animated application logo appears for about 650 ms, followed by the authenticated account photo/name and available official student ID/department. Accepted source profile changes update the identity as they arrive. Missing photos use initials. Blue light gradients, a subtle grid and floating academic icons honour opening/background animation and reduced-motion settings.

## Choose when to enter

- **Open Home** becomes available when the main records or a majority of supported sections have updated. It also becomes available after 3.5 seconds so a slow or unavailable source cannot prevent access to the rest of the app. Faculty/admin accounts use **Open workspace** and their assigned destination.
- **Wait for all sections** keeps the screen open beyond the normal eight-second fallback. It opens the workspace automatically when the current sync ends, including a partial or failed sync. Unavailable sections are never labelled as successfully synced. Open Home remains available if the student changes their mind.
- Without choosing Wait, the screen opens after usable records arrive, or after eight seconds. Remaining work continues in the existing background worker. Choosing Home does not send a new AMS login or start another source sync.

The counter reflects actual source module states, not a fabricated percentage. Retained/unsupported sections do not count as newly updated. The welcome never reads a previous account or a sample identity, and does not add private data to browser storage. Sign-out clears it. Automatic completion preserves a restored destination; explicitly choosing Home opens Home.

## Faster workspace reads

Current deployments return the saved academic workspace in one authenticated private-service request rather than seven separate requests. This endpoint reads owned database records; it does not contact AMS. Overlapping frontend reads share the same active account request. Cached values appear while upstream sections sync independently. Existing owner guards, background admission limits and source checkpoints remain in place.

Saved-session checks use a 30-second cold-start allowance and at most one retry for a transient network/server failure. Credential and CAPTCHA submissions are never automatically repeated. Timeouts show an actionable message rather than a raw Axios duration. Only an actual unauthorized session clears sign-in; a temporary server failure does not log the student out.

## Results

Final results retain the existing overall CGPA/percentage and cumulative/semester line graphs. Test marks, mid-tests, lab marks, assignments and internal marks appear in their original report tables with filters and PDF/Excel exports. Assessment views contain no graphs or GPA calculation controls.

## Update

No new environment variable, dependency or database migration is needed. The package version remains **1.8.0**. Preserve existing private configuration, persistent encryption keys, database names, media volumes and the public origin. Rebuild **both** campus and academic services so the new bundled endpoint is available. Older private services retain the existing fallback until upgraded.

See [DEPLOYMENT-UPDATE.md](DEPLOYMENT-UPDATE.md) for Windows, deployment and phone installation steps, [EMAIL-SMTP.md](EMAIL-SMTP.md) for email, and [ANDROID.md](ANDROID.md) for a separately signed Android package after adding a real HTTPS origin.
