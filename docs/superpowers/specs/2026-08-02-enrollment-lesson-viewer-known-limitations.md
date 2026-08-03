# Known Limitations — Enrollment + Lesson Viewer

Recorded at the end of this phase (2026-08-02), same practice as the prior phase's
known-limitations doc. Two rounds of whole-branch review found and fixed 2 Critical and 8
Important defects; these are the items that were deliberately left open rather than fixed in this
pass, so they don't only exist in review conversation history.

## No live Firebase emulator verification of this phase's runtime behavior

Nothing in `src/lib/firebase/client.ts` calls `connectAuthEmulator`, `connectFirestoreEmulator`, or
`connectFunctionsEmulator`. `firebase.json` has emulator ports configured (added in this phase for
`functions`, alongside the pre-existing `firestore`/`auth`), but the browser client never connects
to them — every manual-verification step for the panel enrollment screen and lesson viewer was
build/typecheck-only, never exercised against a running backend.

A controller-attempted live smoke test (start firestore+auth+functions emulators, exercise
`enrollStudent` end to end) hit environment friction — a slow first-time Firestore emulator JAR
download combined with background-process lifecycle issues in the tooling used this session — and
was abandoned rather than completed.

This matters more here than for typical deferred items: it's the reason two real Critical bugs
(missing `students/{uid}` parent doc breaking the certificate trigger; unrestricted claims
overwrite letting an instructor demote an owner) survived ten individual task reviews and were only
caught by careful manual code tracing in the final whole-branch review, not by actually running the
code. Static review is not a substitute for execution — it caught these bugs this time, but that's
not something to rely on again.

**Recommended fix for the next phase**: add `connect*Emulator` calls behind a
`NEXT_PUBLIC_USE_EMULATORS` env flag, and actually run a full enroll → view lesson → mark complete →
certificate-generates cycle against the emulators before considering any future phase done.

## No positive Firestore rules test for the mark-complete write

`test/rules/firestore.rules.test.ts` has a test proving a student *cannot* forge `certificateUrl`,
but nothing asserts a student *can* successfully `updateDoc({ lessonsCompleted })` on their own
progress document — the specific write the entire lesson-viewer feature depends on. Manual code
tracing indicates the existing `hasOnly(['lessonsCompleted'])` rule from the prior phase permits it,
but that's a reasoned conclusion, not a verified one. Add one `assertSucceeds` test using the
existing emulator harness (`npm run test:rules` already works reliably for this repo).

Related: the rules suite lives behind `test:rules`, a separate script from the default `npm test` —
neither the existing negative test nor a future positive one runs in CI-equivalent default checks
unless both scripts are always run together.

## No backfill for students enrolled before the Critical #1 fix

`assignEnrollment`'s `createProgress` (which now also creates the `students/{uid}` parent doc) only
runs when the student isn't already enrolled in that specific course
(`!alreadyEnrolled` in `functions/src/enrollment/assignEnrollment.ts`). Nobody was enrolled through
this phase's UI before the fix landed in the same development pass, so this is currently
theoretical — but if this code is ever deployed, tested, then patched in place rather than
redeployed fresh, any student enrolled during the vulnerable window would have a `progress` doc
with no parent `students/{uid}` doc, and their certificate would never generate. A one-off backfill
script (walk all `progress` docs, `set({merge:true})` the parent doc from the student's own Auth
record) would be needed only if that specific sequence actually occurred in a real deployment.

## Minor items not addressed

- **Error code semantics**: `assignEnrollment`'s authorization failure (`'caller must be an owner or
  instructor'`) is currently surfaced as `HttpsError('failed-precondition', ...)` rather than the
  more semantically correct `'permission-denied'`. Low priority — the panel UI just shows the
  message either way.
- **Email not trimmed before lookup**: `enrollStudent` validates `data.email` is a non-empty string
  but doesn't `.trim()` it before calling `getUserByEmail`, so a pasted email with leading/trailing
  whitespace fails with a confusing "no account" error instead of resolving normally.
- **Student doc `name` field gets overwritten on every enrollment**: `createProgress` does
  `set({name, email}, {merge:true})` every time a student is enrolled into an *additional* course,
  so if `name` is ever hand-edited (e.g. via the Firebase console) that edit is silently clobbered
  on the next enrollment.
- **`/panel/inscribir` has no client-side role gate**: any signed-in student can load the enrollment
  form and only discovers they're not authorized after submitting (server-side rejection is
  correct and is the real security boundary — this is a UX gap, not a security one).
- **Raw internal error text reaches the panel UI** for any `assignEnrollment` failure not explicitly
  the "no account" case — narrower than before this phase's fixes (which returned a blanket opaque
  `internal` error), but Admin SDK/Firestore internals can still leak through `failed-precondition`
  messages. Only reachable by an authenticated owner/instructor, so low severity.

## Carried forward from the prior phase, still unaddressed by this one

- Quiz-taking UI, course/module/lesson CRUD UI, tenant creation UI, password reset/email
  verification — all still out of scope, per this phase's own design doc.
- The prior phase's other known limitations (subdomain routing via middleware, admin-SDK migration
  for server-rendered catalog pages, cast-based Firestore reads with no runtime validation) are
  unchanged by this phase.
