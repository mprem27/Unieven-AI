# Percentage calculation

The requested default is **Percentage = (CGPA − 0.5) × 10**. For example, CGPA 8.4 gives 79%. The manual calculator uses the same formula.

The results overview applies this order:

1. Use an unambiguous published AMS percentage when present.
2. Otherwise use a confirmed administrator rule matching the student's **official** admission–completion batch and programme.
3. Otherwise use the requested default formula above.

CGPA/percentage values outside supported ranges, missing CGPA or conflicting matching rules remain unavailable. No value is silently clamped. A calculation based on estimated grade points remains labelled as an estimate. The overall graph and overview are independent of detail filters below them.

The default is a project requirement supplied by its owner, not a claim that an official regulation was independently verified. Online sources disagreed; the university's cited regulation PDF refused access from this environment. A college administrator should confirm any batch-specific departure against the applicable official document.

## Configure a batch override

Sign in through **Admin → Academic admin → Batch rules**. Enter the full batch (for example `2023-2027`), programme, regulation/circular title, clause/page, multiplier, CGPA offset and official HTTPS university URL. Confirm that you checked the rule against that source, then save.

An offset of `0.5` and multiplier `10` gives the default formula. An exact batch/programme rule overrides only that cohort. Student-editable social department/name never determines the rule. Published AMS percentages still take priority. Creating/updating/removing a rule requires the saved college-administrator role and is audited; students and faculty cannot change it.

