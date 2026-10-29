# Active feature coverage

| Area | Delivered behavior | Source or remaining dependency |
| --- | --- | --- |
| Sign-in | Single username/email sign-in, automatic persisted-role routing, limited-admin permissions and cookie restoration | AMS for students; administrator provisioning for staff; genuine university verification is retained |
| Semester PDF | Aligned reference marks-statement layout with centred cells, source semester/attempt divisions, official minimal identity, logo and summary | Student-generated copy; missing/conflicting source summaries stay blank |
| Percentage | Requested (CGPA − 0.5) × 10 default and manual calculator; confirmed exact batch/programme admin overrides | Published AMS percentages take priority; no universal official conversion claimed |
| Home | Normal top current/next-class card, ten facts, private portrait, India clock, optional Home reels | Source class times; missing marks stay neutral; reels off by default |
| Official identity | Read-only source student details with no profile export | University data and administrative scope remain separate from editable social fields |
| Social profile | Display name, username, bio, social department, photo, links and privacy | Social edits never grant faculty/department permissions |
| Attendance | Subject-first overview, overview/subject calendars, touch-hold day details, full subject pages, filters, bunk allowance, independent calculator/formulas, PDF/XLSX | Only source periods; no invented absence; PDF Latin text, XLSX Unicode; overview target card removed |
| Academics | Registered courses, discovered AMS results/grades, fees/receipts, documents and examinations; separate faculty publications | Explicit source provenance; unavailable/unsupported sections remain empty; live attendance/courses/grades/assessment checked on one owned account; missing fees/documents/schedule stay unavailable |
| Sync | Overall plus nine per-module attempt/success/error states; retained records identified | One successful section does not establish that all modules synced |
| Document access | Owner-only bounded signature-checked PDF/PNG/JPEG cache from safe associated AMS links | Maximum eight files / 16 MB per student, current fee/document sections; counts against Atlas quota |
| Course registration | Source courses, warnings and official AMS handoff | No guessed registration write endpoint; official submission remains in AMS |
| Events | Events/Reels tabs, free/paid filters, details/registration/ticket pages, media, bookmarks, waitlist, QR/manual check-in | Real paid tickets require merchant configuration and verified webhook |
| Community | Mixed feed, double-tap idempotent likes/heart, contextual comments, full-screen reels, like/save/share, three-dot menus, report workflow, connections and private follower requests | Private official fields excluded from public author DTOs |
| Activity | Settings own/saved/liked/archive across posts/reels and own story archive, authorized archive/restore | Hidden content/media excluded from other students and recommendations |
| Composer | Shared validated filters, fonts, styles and proportional text placement, published rendering matches preview | Visual effects are display metadata, not a claim of video transcoding |
| Comments | Immediate comment DTO, owner edit under five minutes, permitted delete, idempotent likes | Server timestamps/ownership apply to campus posts, legacy posts and reels |
| Suggestions | Weighted follows/interests/recency/engagement, refresh diversity and suggestions between content | Heuristic recommender; no trained Instagram/LinkedIn model claimed |
| Forms | Faculty/admin only authoring, scope, required typed questions, time windows, one response/account, sign-in preserving direct links | Organizer privileges alone cannot create forms |
| Proof and response export | Fresh camera challenge for all attachments, private owner-bound image capture, scoped faculty review and Excel workbook | Camera/GPS cannot guarantee physical presence; 10,000 export rows maximum |
| Event attendance | Fresh location/radius/accuracy/time checks, active ticket, faculty review and scoped faculty QR scanning | Challenge replay and duplicate check-in denied; no anti-cheating guarantee |
| Settings | Category navigation, account/social/media/appearance, Home reels, notifications and requested hardware permissions | Connections contains no importing UI; HTTPS and browser support needed |
| Downloads | Actual app downloads retained per account on this browser, save again/delete/clear, attendance PDF/XLSX and owned social JSON | 100 files / 50 MB, 15 MB per file; browser quota applies; cannot inspect external downloads; clear shared-device copies |
| Management | Account provisioning, staff scope, activation/password tools, notices/audit, event operations and community reports | Persisted server authority; faculty publications scoped separately |
| Placements | Developing state | No fictional live jobs |
| Login/recovery | Username/password first, conditional upstream verification, rolling 30-day revocable app sessions, owner-bound 30-minute refresh cache, verified recovery email or matching institutional email with OTP | CAPTCHA cannot be bypassed; app recovery does not change AMS password; upstream cache hard capacity100, single academic worker |
| Results & credits | Semester/session/report/subject/assessment filters, clear interactive line charts, published GPA/CGPA/percentage or labelled editable 10-point estimates, cumulative line graph, selected-semester PDF and Excel, original earned-credit divisions | No guessed grade scale, credits or official percentage factor; new credit/material layouts need live verification |
| Deployment | HTTPS proxy, shared Mongo request limits/session state, optional no-license-fee self-hosted Community database | Multiple campus containers on one host; finite disk; multi-host storage/academic routing is separate work |
| Windows/web | PowerShell + Docker Desktop + Atlas, React/Vite dev workflow, responsive PWA and bottom navigation | No Ubuntu requirement; Android source generator and signed packaging guide included; actual APK requires deployment URL, SDK and private signing key |

Home of VelTech's public listing describes a student-developed AMS client. No separate documented Home API was found. The owned live AMS check retrieved 12 student fields, 22 timetable entries, five courses, five attendance summaries, 284 class marks and 173 result/assessment records. Fees/receipts, documents and an examination schedule were not exposed in that account's discovered views; complete coverage for all students remains unverified. A login in another browser does not supply this server's session. Storage is finite: Atlas holds database records and bounded private AMS file bytes; the persistent media volume holds uploaded social media and evidence.

17 October academic update: metadata split regression is fixed, including compatibility for earlier split records. New source mappings are covered by fictional structural regressions. The fresh authorized live probe expired without an answer; no new all-account or credit/document coverage claim is made.


## V1.7 behavior

Reactions update immediately and reconcile authoritative counts. Comments support contextual threaded replies, inline edits/deletion, rollback and draft recovery. The results stock-style line/area chart supports keyboard/touch/pointer input; report, semester and examination divisions remain source-specific. Credit Earned Details preserves original column headings and separates course/category rows.

Academic calendar changes are persisted and role-scoped: administrator college/department/selected students; coordinator only assigned campus department. Holiday, follow-weekday and selected-student special classes take precedence over recurring source periods. Attendance always uses the actual selected date.

Verified sign-in returns before full report sync. Each section loads independently; completion polling uses a shared freshness revision and owner checks. Three concurrent sync jobs, one per owner, are supported in one academic process. This does not increase upstream AMS capacity or create a multi-worker session store.

## V1.8 additions

Full source timetable and administrator room overrides; contextual notification inbox with opt-in current-day absence alerts, quiet hours and device sound controls; student app feedback with administrator replies and durable alert retries; mobile event wrapping; normalized older registration metadata; coalesced academic-token renewal and reports shown while syncing. Login admission is bounded to four active attempts and eight queued; all report paths share three slots. These limits protect local resources and do not establish production AMS capacity. See VERIFICATION.md and ANDROID.md.

V1.8 20October restoration update: refresh/PWA updates retain a valid campus cookie without showing login first. Transient failures retry; unchanged/hidden academic polling is suppressed. A separate real AMS expiry still requires university authentication. Overall calculation settings are per account on the device, source records remain unchanged, and the requested default percentage estimate is CGPA×10.
