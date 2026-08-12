# Known Limitations — Enrollment + Lesson Viewer

Recorded at the end of this phase (2026-08-02), same practice as the prior phase's
known-limitations doc. Two rounds of whole-branch review found and fixed 2 Critical and 8
Important defects; these are the items that were deliberately left open rather than fixed in this
pass, so they don't only exist in review conversation history.

## Live emulator verification: partially closed after this doc was first written

**Update (same day, after initial writing):** `src/lib/firebase/client.ts` now exposes
`getFirebaseAuth()` / `getFirebaseFirestore()` / `getFirebaseFunctions()`, which connect to the
local emulators via `connect*Emulator` when `NEXT_PUBLIC_USE_EMULATORS=true` (see `.env.local`,
gitignored). All seven consumer files (`AuthProvider`, `/registro`, `/login`,
`/panel/inscribir`, the public catalog + embed pages, the lesson viewer) were switched over to
these wrappers. This was verified live: registering a real account against the Auth emulator and
landing on `/cuenta` in the correct no-claims state, and the public catalog page rendering against
the Firestore emulator with no crash.

**What's still not verified live**: the actual `enrollStudent` → lesson viewer → mark-complete →
certificate-generates cycle end to end. Reaching that requires a bootstrapped owner account (custom
claims can only be set via the Admin SDK, and there's no self-service path to become an owner — see
the prior phase's "tenant creation UI" gap), plus seeded course/module/lesson data. Setting that up
wasn't done in this pass.

**Root cause found for the Cloud Functions emulator's initial "Failed to load function
definition... Timeout after 10000" error** (this was mistakenly attributed to environment/tooling
friction when this doc was first written): the emulator gives function loading a hard 10-second
budget, and `require()`-ing the freshly-built `functions/lib/index.js` took longer than that on its
very first touch after a `tsc` build — most likely Windows Defender scanning the newly-written JS
files. It is NOT a code defect: isolated `require()` calls on `lib/admin.js`,
`lib/auth/setTenantClaims.js`, `lib/certificate/onProgressUpdated.js`, and
`lib/enrollment/enrollStudent.js` all loaded in well under a second individually, and a cold
`require('./lib/index.js')` that first timed out at 8s loaded cleanly in 550ms on retry once the
files had been touched once. Restarting the functions emulator a second time after a build is a
reliable workaround; a `tsc --build` cache warm (e.g. running the build twice, or excluding
`functions/lib` from real-time AV scanning) would remove the need for that workaround.

Two other things worth recording about the emulator session itself:
- Processes started via `nohup ... & disown` inside a single Bash tool call did not survive between
  separate tool calls in this session's tooling — the emulator was confirmed listening on all its
  ports, then found completely gone (nothing on any of its ports) on the next check. Starting it
  with the tool's own `run_in_background: true` parameter instead kept it alive correctly. This
  matches earlier `npm install` background-process patterns observed in the prior phase.
- No backfill or seed script exists for local demo data (a bootstrapped owner, sample courses,
  modules, lessons) — every live check in this pass either used the Firestore Emulator UI directly
  or was limited to what doesn't require seed data (registration, login, empty catalog render).

**Recommended fix for the next phase**: write a small seed script (or a documented manual sequence
via the Emulator UI) that creates one owner account, one tenant, one course with a lesson, so the
full enroll → view → complete → certificate cycle can actually be exercised locally without hand
data-entry every time.

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
