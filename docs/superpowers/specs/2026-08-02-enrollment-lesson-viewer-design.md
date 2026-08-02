# Enrollment + Lesson Viewer — Design (vertical slice #2)

Date: 2026-08-02

## Context

The MVP vertical slice (2026-08-01) delivered tenant isolation, the data model, certificate
generation, and a public course catalog — but the catalog's course links point at
`/{tenant}/cursos/{courseId}`, a route that doesn't exist (documented in
`2026-08-01-lms-saas-mvp-known-limitations.md`). No login screen exists anywhere in the app, and
there is no way for a student to become enrolled in a course short of hand-editing Firestore in the
console.

This phase closes that gap: a student can register, get enrolled by an owner/instructor, log in,
view a course's lessons, and mark them complete — the minimum path that makes the certificate
pipeline (already built) reachable end-to-end from the UI.

## Scope

**In scope:**
- Email+password auth (sign-up, login) shared by all three roles.
- A new Cloud Function callable, `enrollStudent`, that resolves a student by email, assigns them
  `{ tenantId, role: 'student' }` claims, and creates their initial `progress` document for a course.
- A minimal owner/instructor panel screen (`/panel/inscribir`) to call `enrollStudent`.
- The lesson-viewer route (`/{tenant}/cursos/{courseId}`) for authenticated students: list
  modules/lessons, render the selected lesson's content, and a "mark complete" action.
- Client-side route protection (redirect to `/login` when unauthenticated or wrong role/tenant).

**Explicitly out of scope for this phase** (carried forward as known limitations, not silently
dropped):
- Quiz-taking UI (the lesson viewer shows lesson content only; quiz submission is a separate
  fast-follow since `scoreQuiz` has no persistence caller yet).
- Course/module/lesson CRUD UI for owner/instructor (content is still authored by hand in the
  Firestore console).
- Tenant creation / owner account bootstrapping (owners are assumed to be created manually via the
  Firebase console for now, same as the prior phase's assumption).
- Password reset / email verification flows.
- Subdomain-based tenant routing (still resolved from the URL path, per the prior phase's deferred
  `resolveTenant`/middleware item).

## Auth model

Firebase Auth, email+password provider. Three states a signed-in user can be in:

1. **No claims** — just registered via `/registro`, not yet enrolled anywhere. Can log in but has
   no tenant/role, so every protected page redirects them to a "not enrolled yet" message.
2. **`role: 'student'`** — enrolled in at least one tenant via `enrollStudent`. Can access
   `/{tenant}/cursos/{courseId}` for courses in their tenant they're enrolled in.
3. **`role: 'owner'` or `'instructor'`** — assumed pre-existing from the prior phase's
   `setTenantClaims` callable (bootstrapped manually via console for now). Can access
   `/panel/inscribir`.

A client-side `AuthProvider` (React Context, wrapping the app in `src/app/layout.tsx`) tracks
`{ user, claims, loading }` via Firebase's `onAuthStateChanged`, and force-refreshes the ID token
(`getIdTokenResult(user, true)`) once after `enrollStudent` succeeds or right after login, since
custom claims set server-side don't appear in a cached client token until a forced refresh.

Route protection is client-side only for this phase (a loading state, then a redirect if the
resolved claims don't match what the route needs) — no server-side session/cookie verification.
This is a known simplification, consistent with the rest of this MVP's client-SDK-heavy approach
(see the prior phase's known-limitations doc), not a security boundary — the actual security
boundary remains Firestore security rules, which are enforced server-side regardless of what the
UI does.

## `enrollStudent` Cloud Function

Callable, same authorization pattern as `setTenantClaims` (caller must be `owner` or `instructor`
of the tenant they're enrolling into):

```
enrollStudent({ email: string, courseId: string }, context) -> { success: true, studentUid: string }
```

Steps:
1. Reject if caller isn't authenticated, or isn't `owner`/`instructor`.
2. Resolve `email` to a UID via `getAuth().getUserByEmail(email)` — reject with a clear error if no
   account exists with that email (the student must sign up first).
3. Set custom claims `{ tenantId: callerTenantId, role: 'student' }` on the resolved user.
   (Overwrites any existing claims — single-tenant-per-user is an accepted MVP assumption, same as
   the rest of this codebase; not handled specially here.)
4. Create (not overwrite) `tenants/{tenantId}/students/{uid}/progress/{courseId}` with
   `{ courseId, lessonsCompleted: [], quizScores: {}, certificateUrl: null }`, using the Admin SDK
   (bypasses Firestore rules, consistent with how the certificate trigger already writes). If a
   progress doc already exists for this student+course, return success without overwriting
   (idempotent re-enrollment, not an error).

## Lesson viewer

Route: `src/app/[tenant]/cursos/[courseId]/page.tsx`, client component (needs `AuthProvider` and
interactive "mark complete").

- On mount: check `AuthProvider` state. If not signed in → redirect to `/login`. If signed in but
  claims don't match `{ role: 'student', tenantId: <this tenant> }` → show an access-denied message
  (not a redirect loop).
- Fetch the course's modules/lessons (nested Firestore reads, already permitted for any
  authenticated user in the tenant per existing rules — no rule changes needed here).
- Fetch the student's own `progress` doc for this course to know which lessons are already
  complete (rules already permit the student to read their own progress).
- Render: a sidebar list of lessons (checkmark if completed), and the selected lesson's content
  (video embed if `videoUrl` is set, otherwise rendered `textContent`).
- "Marcar como completada" button: writes to the student's own `progress` doc, updating only
  `lessonsCompleted` (append the current lesson id if not already present) — permitted by the
  existing `hasOnly(['lessonsCompleted'])` rule from the prior phase's security fix, no rule changes
  needed.
- No explicit UI reference to certificates in this phase — the certificate is generated
  server-side automatically (already built); a "download certificate" link/banner is a natural
  small addition but is left for the quiz-UI fast-follow phase, since without quiz support most
  courses in practice won't have `requiredQuizzes: true` and the completion path is already
  exercised end-to-end without it.

## Sign-up and login screens

- `/registro`: email + password fields, calls Firebase Auth's `createUserWithEmailAndPassword`.
  On success, redirect to a simple "cuenta creada, esperá a que te inscriban" landing (no tenant
  context exists yet at this point — the student isn't enrolled anywhere).
- `/login`: email + password fields, calls `signInWithEmailAndPassword`. On success, the
  `AuthProvider`'s claims determine where to send the user: `role: 'owner'/'instructor'` →
  `/panel/inscribir`; `role: 'student'` → (no single "my courses" list exists yet in this phase, so
  land on a simple message pointing them to the catalog link they were given); no claims → the
  "esperá a que te inscriban" message.

## Testing approach

Same TDD discipline as the prior phase for anything with real logic:
- `enrollStudent`'s pure authorization/claims logic (`assignEnrollment` or similar, mirroring
  `assignTenantClaims`'s pure-function/wrapper split) gets unit tests with an injected fake Admin
  SDK — no live email lookup or Firestore write in the unit tests.
- No new Firestore rules changes are needed for the lesson viewer or `enrollStudent`'s Firestore
  write (it uses the Admin SDK, which bypasses rules) — so no new rules tests are required for this
  phase, only confirmation that the *existing* rules suite still passes unchanged.
- Auth screens (`/registro`, `/login`) and the lesson viewer's rendering are not unit-tested (same
  precedent as the prior phase's page components) — validated manually via the dev server per the
  plan's UAT approach.
