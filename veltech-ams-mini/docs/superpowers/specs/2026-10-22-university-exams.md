# University administration update — version 2.0.0

The user authorizes this same-version update, professional admin redesign, exam file imports, university-wide publishing, exact student audience matching, and calendar/home corrections. Retain student visual design and all existing capabilities. Do not modify original repositories or publish sample schedules to real accounts.

## Required behavior
- Admin schedules are the only source of examination announcements in the student UI; AMS remains authoritative for student identity and registered course codes, results and academic records.
- Exam schedules are drafts with title, exam type, academic year, term, university/department audience, optional regulation/batch/semester/section, bounded rows, and optional original PDF/Excel/CSV document. Staff import then inspect and correct dates/times/course codes before explicit publication.
- Server matching requires verified academic identity, a registered course-code exact match (normalized punctuation/case), and every nonempty audience restriction. Missing required identity fields fail closed. No matching by editable social department, course title, or inferred batch.
- Publication is atomic: stage immutable FacultyExam rows by revision, then swap one ExamPlan publication pointer; reads include only current published revisions. A withdrawn plan and its document disappear from students. Existing individual exams and seating remain supported.
- Original generic schedule documents are authenticated and available only to students with a current matching exam. Private seating files retain stricter individual authorization.
- Calendar overrides use official academic department, priority student > department > university. Holiday hides classes; substitute working day uses the specified weekday timetable on the actual date. Home/timetable reflect changes even if academic auto-refresh is off, without repeatedly scraping AMS.
- Admin shell groups navigation. Overview shows permission-scoped operational data. Separate schedule listing and editor/review page. Permissions picker groups modules, supports presets and grantor action limits. Responsive at 320/390/1440px.

## Design
Navy sidebar, true-white panels, pale blue canvas; primary blue and teal; no orange/red accents. 14px controls, 30px headings, 12px panel radius, 24–32px gutters, tables/lists instead of nested marketing cards. Preserve existing brand/logo. Desktop exam registry concept generated in this session; mobile stacks controls with 44px targets.

## Reference
The supplied two-page PDF has merged date/session cells and OCR ambiguity. Visible heading is Test-II and Mid Term Test-I despite its filename. Import must expose warnings and require staff review; never trust filename as exam type or invent ambiguous course codes. No silent OCR correction.

## Boundaries
No real email sends, upstream university mutations, AMS bypass, migration destruction, signed APK claims or free unlimited database promises. Browser plugin absent: regular Playwright Chromium is the available browser fallback.
