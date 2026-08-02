# Known Limitations — LMS SaaS MVP vertical slice

Recorded at the end of the initial implementation pass (2026-08-02) so these don't only exist in
review conversation history. This vertical slice deliberately stops short of a deployable product
(see the plan's own self-review notes) — these are the specific gaps to close in the fast-follow
that adds course-editing CRUD and quiz-taking UI.

## Enrollment and progress-writing has no client path

`firestore.rules` allows only owner/instructor to `create` a student's `progress` document, and a
student may only `update` the `lessonsCompleted` field on an existing one. There is no callable
function or UI that:
- enrolls a student in a course (creates the initial `progress` doc), or
- writes `quizScores` (staff-only in rules; no writer exists anywhere in the codebase).

Consequence: a course with `requiredQuizzes: true` can never reach `isCourseComplete`, since nothing
ever writes a quiz score. This should be built alongside the quiz-taking UI in the fast-follow, as a
callable Cloud Function that validates the submitted quiz against the real questions before writing
the score (not a direct client write to `quizScores`).

## `lessonsCompleted` values are not validated against real lesson IDs

The rules restrict *which field* a student can write (`lessonsCompleted` only), not *what values* go
into it. A student can write any string into that array, including IDs of lessons that don't exist,
and reach `isCourseComplete` without having actually consumed the content. Hardening this requires
either a callable "mark lesson complete" function that validates the lesson ID server-side, or a
Firestore rule that cross-checks against the course's actual lesson list (expensive/awkward in
rules; a callable is the better fix).

## Client Firebase SDK used inside Next.js Server Components

`src/app/[tenant]/page.tsx` and `src/app/embed/[tenantId]/page.tsx` both use the `firebase/firestore`
client SDK inside `async` Server Components. This works today because published courses are now
publicly readable (see below), but it bypasses Next's fetch caching/revalidation and opens a fresh
connection per render. The correct fix is a `firebase-admin`-backed data-access layer for
server-rendered pages, added to the root Next.js app (it currently only depends on the client SDK).

## Subdomain tenant resolution is unwired

`src/lib/tenant/resolveTenant.ts` (Task 2) is fully implemented and tested but has no caller. The
public catalog pages resolve the tenant from a path segment (`/{tenant}`), not from the `Host`
header, so the design's `cliente.tucampus.com` subdomain mode doesn't exist yet. Wiring it requires
a `src/middleware.ts` that reads the request host, calls `resolveTenant`, and rewrites to the path
route.

## No lesson-viewer route

The catalog pages link to `/{tenant}/cursos/{courseId}`, but that route doesn't exist — it's part of
the lesson-viewer/quiz-taking UI explicitly deferred to the fast-follow (see the plan's own
self-review notes). Every catalog link currently 404s. Not a regression; just not built yet.

## Certificate signed URLs are effectively permanent

`functions/src/certificate/onProgressUpdated.ts` mints a signed URL expiring `2100-01-01` — in
practice a permanent, unauthenticated bearer link to a PDF containing a student's name. Also,
`getSignedUrl` requires the function's service account to hold `iam.serviceAccountTokenCreator`,
which the default Cloud Functions compute service account often lacks — this will only surface as a
runtime error on first real deploy, since it can't be caught by the local emulator/unit tests. Worth
a short-lived-URL-on-demand redesign, or a Storage-rules-gated download path, before real students
use this.

## Cast-based Firestore reads have no runtime validation

`courseConverter.fromFirestore` (Task 3) and the certificate trigger's `courseSnap.data() as
Omit<Course, 'id'>` / `progressData as Progress` casts (Task 9) trust that stored documents match
their TypeScript shape, with no runtime check. A course document missing `requiredQuizzes` silently
skips the quiz-completion gate. Low risk while only staff write these documents by hand via the
console, but worth a schema-validation pass (zod or similar) once real data-entry UI exists.

## `firestore.rules` readability hazard

The helper function `tenantId()` shares a name with the `{tenantId}` path wildcard used throughout
the file, producing expressions like `tenantId() == tenantId`. It is correct (verified by the
emulator test suite) but a trap for the next editor. Worth a rename to `callerTenant()` in a pass
that isn't racing a security fix.

## No `storage.rules` / no `storage` block in `firebase.json`

Certificates are written to Cloud Storage, but the deploy config never declares a storage
configuration, and there's no dedicated `storage.rules` file restricting client access to that
bucket. Not currently exploitable (all access is either signed-URL or admin-SDK), but incomplete
relative to the architecture.
