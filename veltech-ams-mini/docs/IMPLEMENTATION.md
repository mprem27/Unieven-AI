# veltech-ams-mini V1.8 combined application

The combined project uses the original logo, a navy sidebar, blue accents, white content surfaces and phone bottom navigation. React/Vite serves the user interface; the campus Node API enforces community/event permissions and proxies owner-bound requests to the private Python/FastAPI AMS service. MongoDB Atlas remains the default Windows database.

Course metadata and sync telemetry share one owner record. A compatibility reader merges earlier split owner records without crossing student IDs. Results preserve source semester, report type and exam session, separate final grades from internal/assessment rows, and calculate only from explicit course credits and grade points. Credit totals by category are not treated as individual course weights. Unknown source layouts remain unavailable and do not erase prior successful rows.

Official college details remain private and read-only. Social names, departments, bios and links use separate fields and never change authorization. App recovery requires an emailed OTP; a derived college-email display alone does not verify a mailbox. Recovery never changes the university password.

Downloads stores actual app-triggered files in owner-scoped IndexedDB with finite limits and explicit removal. It has no access to another website's files or the system Downloads directory. The old Offline library screen is not mounted. The app shell can announce a waiting service-worker update; private API responses remain excluded from offline caching.

See VERIFICATION.md for current test evidence and the separate earlier live check. The18 October authorized read verified the current credit report and profile field structure; fees/documents remained unavailable in that account. Institution-side CAPTCHA, unsupported layouts, missing source records and provider/deployment configuration remain real dependencies. No private capture/debug hook is shipped.


V1.7 adds owner-bound asynchronous AMS report jobs with bounded concurrency and cancellation, partial workspace loading with stale-response protection, cross-tab session ownership checks, optimistic post/reel/comment actions, exact credit source metadata, an interactive stock-style results graph and scoped academic-calendar policy overrides. See VERIFICATION.md for current evidence.

V1.8 adds source-safe result filters, separate assessment series, readable phone graphs with the selected point kept in view, actual PDF/OOXML exports, owner-token reuse, incremental report checkpoints, shared report admission, contextual notifications, durable feedback notifications, scoped room overrides and Android packaging tools. The college About page links to the official portals; deployment details remain in these operator documents. Tests and operating limits are recorded in VERIFICATION.md.

20October V1.8 update: the Results overview also consumes published report-row and standalone summaries. The selected editable 10-point scale and requested percentage multiplier produce clearly labelled estimates; published AMS values have priority. Source record exports do not relabel locally estimated grade points as published values. Saved campus sessions restore before login is rendered, transient errors offer retry, stale account responses are cancelled and hidden/unchanged academic polling is suppressed. The university session remains separate and may expire after30minutes or a service restart.
