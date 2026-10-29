# Academic regulations and percentage policies

Display version remains **2.3.3**. Source review: **29 October 2026**. No live AMS credentials were used for this work. Public documents describe academic rules; they do not establish which regulation is assigned to an individual student.

## Which values take priority

1. A published numeric AMS overall percentage wins, including a genuine zero. Published GPA/CGPA and numeric course grade points retain precedence over calculated values and reference letter scales.
2. A public regulation conversion requires the student's **official programme and explicit regulation** to match the document. The catalogue never infers regulation from admission year, batch range, department, course code, or screenshot.
3. Administrator-confirmed conversions additionally require the exact batch and explicit department scope. Named departments require the student's department. Programme-wide rules require an explicit `all` scope and a source that covers that scope. Unknown profile fields do not match narrow policies.
4. Multiple applicable administrator rules, including overlapping all-departments/named-department or legacy/scoped records, are ambiguous. A matching administrator conversion that conflicts with the public regulation is also ambiguous. The app returns unavailable; it does not fall through to another rule or estimate. Invalid matching formula/evidence also blocks calculation.
5. If there is no confirmed applicable conversion, the owner's requested **`(CGPA − 0.5) × 10`** remains a **project estimate**. Its university applicability is unverified. A numeric estimate is never labelled an official or batch-specific university formula.

CGPA must be a finite number from 0 through 10; resulting percentages must be from 0 through 100. Strings, missing values, NaN, Infinity and invalid coefficients do not become numbers implicitly. A missing mark is not zero. A plausible conversion does not verify a rule.

## Public catalogue and exact evidence

The university index is [Academic Regulations](https://www.veltech.edu.in/academic-regulations/). The shared catalogue contains these conservatively scoped entries:

| Programme and regulation | Documented conversion | Exact source clause |
| --- | --- | --- |
| B.Tech — VTR UGE 2025 | `CGPA × 10` | §25.23.3, printed p28 / PDF p33 |
| B.Tech — VTR UGE 2021, revised document | **Unverified** in the inspected PDF | §§6.6–6.7 document SGPA/CGPA, printed pp6–7 / PDF pp11–12 |
| B.Tech — Regulations 2013 | `CGPA × 9` | §16.2.3, printed/PDF p15 |
| B.B.A., B.Com., B.Sc. — VTR UGAS 2026 | `CGPA × 10` | §26.20.3, printed p23 / PDF p29 |

### B.Tech VTR UGE 2025

[Official PDF](https://veltech.edu.in/wp-content/uploads/2025/08/Regulations-VTR-UGE-2025-1_.pdf).

§25.1.1(a), printed p1 / PDF p6: “These regulations are applicable to all Engineering Degree Undergraduate level programmes ... with effect from the academic year 2025-26 and they are called ‘VTR UGE - 2025’.” Clause (b) allows amendments to specified batches, including students already undergoing the programme. Effective year is **document metadata**, not an automatic admission-cohort mapping.

§25.23.3: **“Equivalent Percentage of marks = (CGPA * 10)”**.

§25.22.1, Table 8, printed p27 / PDF p32: O=10, A+=9, A=8, B+=7, B=6, C=5, RA=0. P/F describe mandatory **non-credit** courses; they are not generic credited grades. `officialGradeScale()` excludes those non-credit grades rather than assigning P a guessed four points.

§§25.23.1–2 use `Σ(credit × grade points) / Σ(credit)` for semester and cumulative averages. Do not average semester GPAs without their credit weights. Repeat attempts, curriculum exclusions and earned versus registered credits still require source records; generic arithmetic cannot resolve those policies.

§§25.16.3–5, printed pp17–18 / PDF pp22–23, provide a 50 CIA / 50 SEE scheme for standard theory/practical/integrated courses. Table 6 theory CIA weightages are 20+20+5+5. They must not be confused with every raw test paper's maximum.

### B.Tech VTR UGE 2021

[Official revised PDF](https://veltech.edu.in/wp-content/uploads/2025/08/B.Tech_._Regulations_VTR_UGE2021_JUNE-2025.pdf). The cover includes amendments approved February 22, 2025; its June-2025 filename does not turn it into UGE 2025.

§1(a), printed p1 / PDF p6, describes common B.Tech rules effective AY2021–22. §6.5, Table 2, printed p6 / PDF p11: **S=10, A=9, B=8, C=7, D=6, RA=0, AB=0**. The difference between UGE2021 A=9 and UGE2025 A=8 makes exact regulation matching necessary.

§§6.6–6.7, printed pp6–7 / PDF pp11–12, describe credit-weighted SGPA/CGPA expressed to two decimal places. **No equivalent-percentage conversion clause was located in the complete inspected 54-page PDF text.** No conversion rule was verified in the public examination page, transcript application, transcript guidance or Clique guidance. Another circular or an individual conversion certificate may exist; the catalogue does not invent its content or use another regulation's formula.

The supplied marks workflow has official support in the appropriate course contexts:

- §8.2.2, printed p27 / PDF p32: **“There shall be three tests each carrying 30 marks. Average of all three tests marks shall be considered for continuous evaluation.”** Theory-course CE maximum is 40.
- §8.2.8, printed p29 / PDF p34: **“There shall be two mid-term tests each carrying 20 marks.”** This applies to integrated courses with more than 50% lecture-credit contribution. Its table assigns the mid-term contribution 10, attendance 5, assignment 5 and model laboratory 20. Raw `/20` midterms are distinct from internal contribution weightages.
- §§8.2.5–7, printed p28 / PDF p33: laboratory CE maximum 40; experiments maximum 15, average experiment marks; model laboratory maximum 25.

These clauses do **not** establish universal maxima for every batch, regulation or course. Source maxima win; missing maxima remain unknown.

### B.Tech Regulations 2013

[Official PDF](https://veltech.edu.in/wp-content/uploads/2025/08/A2_UG_Regulations2013.pdf). Cover: “Regulations 2013 for B.Tech Programmes”; printed in 2014. No later cohort assignments are inferred.

§16.2.3, printed/PDF p15: **“Example: CGPA of 6.75 on 10 point scale = 6.75/10*0.9*100=60.75%”**. The normalization matters: `(CGPA/10) × 0.9 × 100` is **CGPA ×9**, not ×90. Table §16.1.2 gives S10/A9/B8/C7/D6/RA0; no points are invented for AB/WH.

### VTR UGAS 2026

[Official PDF](https://www.veltech.edu.in/wp-content/uploads/2026/09/VTR-UGAS-2026.pdf). §26.1.1(a), printed p1 / PDF p7, applies to undergraduate B.B.A., B.Com., B.Sc. under this regulation, effective AY2026–27. §26.20.3, printed p23 / PDF p29, states **“Equivalent Percentage of marks = (CGPA * 10)”**. A B.Tech student cannot match this entry merely by sharing a department or year.

## Shared API

`shared/percentage-rules.mjs` is browser/server compatible:

- `officialRegulations`: immutable public source metadata, explicit programme keys, applicability clauses, reviewed conversions and conservative grade maps. `factor: null` means conversion remains unverified.
- `officialGradeScale(profile)`: `{grade, points, regulation, sourceUrl, sourceClause, source:'official-regulation'}[]`; returns `[]` without an exact official programme/regulation match. Published source scale entries and numeric course points still take precedence.
- `resolvePercentageRule(profile, policies=[])`: `{status, source, rule, regulation, reason}`. Status is `matched`, `unverified`, `unknown`, `ambiguous` or `invalid`. It never creates the project estimate.
- `academicRuleContext(profile, {policies=[]})`: the same context for the student rules panel.
- `normalizeBatch`, `normalizeProgramme`, `normalizeRegulation`, `normalizeDepartment`: formatting/exact-alias normalization. A bare `2025` does not identify UGE2025. Degree/programme matching does not collapse arbitrary degree-name prefixes. Department matching reuses only the static known aliases, not mutable publishing-directory customizations.
- `officialRegulationUrl`: HTTPS, exact official hostname, no credentials or nonstandard port. A valid URL is an allowlist check, not proof of document content.

The frontend `batchPercentage(overall, profile, policies)` returns `{value, source, rule}` plus `status/reason` for derived/unavailable results. Sources are `published`, `official-rule`, `batch-rule`, `legacy-rule`, `project-rule`, `unavailable`. `AcademicRules({profile,mode})` accepts the full student profile, uses `officialProfile` in connected mode and the explicitly fictional profile in demo mode, and imports its own scoped stylesheet.

## Administrator policies and legacy records

New policies record `scopeVersion: 2`, `batch`, `programme/programmeKey`, `regulation/regulationKey`, `departmentScope` (`all` or `department`), optional display `department`, and normalized `departmentKey` (`*` only for an explicitly all-departments rule). Formula, URL, clause/applicability evidence, administrator identity and confirmation time are retained. The API requires an administrator, session/CSRF protection and explicit source confirmation. It writes audit records for save/delete.

`POST /academic-rules` accepts an optional existing `id` for deliberate edits. Without `id`, upsert uses the complete scope. Reconfirming a legacy rule requires choosing department scope; the editor does not silently turn an old record into all departments. All-departments and named-department scopes can coexist but overlapping applicability is ambiguous. Read every affected source before changing scope.

Existing records without the new scope fields remain **readable and labelled “legacy cohort rule · department scope not recorded”**. A verified legacy policy can match its exact programme/batch when official regulation is missing, but remains labelled legacy. When official regulation is present, its explicit normalized regulation must agree with the legacy record. A legacy rule cannot override a conflicting explicit regulation. Legacy/scoped overlap is ambiguous. No records are backfilled, removed or silently reassigned.

`verifiedAt` represents **administrator confirmation**, not an automated independent university verification. The API does not fetch arbitrary submitted URLs. A fictional official-host path is usable in isolated tests and must never be described as verified document content.

## Non-destructive index migration

The old unique index `{batch:1, programmeKey:1}` prevents multiple department/regulation policies for one cohort. The new unique index is named `academic_rule_scope_unique`, keys `{batch:1, programmeKey:1, regulationKey:1, departmentKey:1}`, and partial filter `{scopeVersion:2}`. Legacy rows remain outside that partial index because they lack explicit scope.

Application initialization and saves may **create the new index**, but **never automatically retire the old index**. If the old index blocks an additional scope, the API returns **409** with a migration explanation and retains all existing records. GET remains available. If the stronger index cannot be created/verified, saves fail safely with 503.

An operator can explicitly run `migrateBatchRuleIndexes({retireLegacyIndex:true})` after reviewing a database backup and the legacy policies. The helper **creates and verifies the stronger unique index first**, then retires only the recognized old two-key unique index. Any creation/verification failure leaves the old protection intact. It does not drop collections, call `syncIndexes()`, alter policy records, or delete user data. There is no application startup flag that silently performs retirement.

From the project directory in **Windows PowerShell**, with Docker services already running, first inspect/create the new protection without retiring anything:

```powershell
docker compose -f compose.yaml exec -T campus node --input-type=module -e "import mongoose from 'mongoose'; import {migrateBatchRuleIndexes} from './campus/models/batch-rule.js'; await mongoose.connect(process.env.MONGODB_URI); try { console.log(JSON.stringify(await migrateBatchRuleIndexes())); } finally { await mongoose.disconnect(); }"
```

After operator review, explicitly retire only the legacy index:

```powershell
docker compose -f compose.yaml exec -T campus node --input-type=module -e "import mongoose from 'mongoose'; import {migrateBatchRuleIndexes} from './campus/models/batch-rule.js'; await mongoose.connect(process.env.MONGODB_URI); try { console.log(JSON.stringify(await migrateBatchRuleIndexes({retireLegacyIndex:true}))); } finally { await mongoose.disconnect(); }"
```

For the production Compose layout, replace `-f compose.yaml` with `--env-file .env.production -f compose.production.yaml`. Commands use the container's configured `MONGODB_URI` without printing it; do not paste credentials into the command. With multiple campus replicas, run migration once, then verify the output and create/edit scoped policies through the normal admin UI. The helper is idempotent: a later explicit run reports no retired indexes when the legacy index is already absent.

If a legacy and a new scoped rule then overlap, the matcher deliberately returns unavailable until an administrator reviews the original record by its ID. Retiring an index does not decide policy precedence.

## Verification and research limits

Behavior tests cover published zero/range checks, programme/regulation/department/batch mismatch, missing keys, malformed coefficients/evidence, overlapping policies, source conflicts, historical versus current grade meanings, explicit project estimate, legacy editing, API role/CSRF/audit boundaries and migration with pre-existing indexes/records. Migration failure is exercised against an actual isolated test database; no production database is used.

Public HOV references: [Google Play listing](https://play.google.com/store/apps/details?id=com.siva.homeofveltech), [linked developer site](https://hov-developers.web.app/). Those pages are workflow references, not authority for university academic calculations. No public calculation/source repository was linked from the inspected pages; protected app access was not established.

The working research directory outside the deliverable contains original PDFs, extracted clauses, page images and hashes. Future university amendments require a fresh source review; do not broaden this catalogue from a formula's appearance in an unrelated regulation.
