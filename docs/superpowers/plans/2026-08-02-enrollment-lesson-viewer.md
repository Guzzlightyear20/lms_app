# Enrollment + Lesson Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a student register, get enrolled by an owner/instructor via a new `enrollStudent` Cloud Function, log in, view a course's lessons, and mark them complete — closing the gap that currently 404s every catalog link and requires hand-editing Firestore to test the certificate pipeline.

**Architecture:** Firebase Auth (email+password) wired into the existing Next.js app via a client-side `AuthProvider` React Context. A new callable Cloud Function (`enrollStudent`, mirroring the existing `setTenantClaims` pure-function/wrapper split) resolves a student by email, assigns them `student` claims, and creates their initial `progress` document via the Admin SDK. No Firestore security rules changes are needed — `enrollStudent`'s writes go through the Admin SDK (bypasses rules, same pattern as the certificate trigger), and a student's lesson-completion write is already permitted by the existing `hasOnly(['lessonsCompleted'])` rule from the prior phase.

**Tech Stack:** Next.js 14 (App Router, TypeScript) + Firebase Auth (client SDK) + Firebase Cloud Functions (Admin SDK `firebase-admin/auth`, `firebase-admin/firestore`) + Vitest. No new npm packages are required anywhere in this plan — `firebase`, `firebase-admin`, `firebase-functions`, and `vitest` are all already installed from the prior phase.

## Global Constraints

- Route protection in this phase is client-side only (a loading state, then a redirect/message if claims don't match) — it is NOT the security boundary. Firestore security rules remain the actual enforcement point and are not modified in this plan.
- `enrollStudent` must reject any caller whose role is not `owner` or `instructor`, exactly like the existing `setTenantClaims` callable.
- `enrollStudent` must be idempotent: enrolling an already-enrolled student in the same course must not overwrite their existing `progress` document (would wipe `lessonsCompleted`/`certificateUrl`).
- No Firestore rules changes in this plan. If a task seems to need one, stop — that means an assumption from the design doc is wrong, not that a new rule should be added ad hoc.
- No new npm dependencies. If a step seems to require installing something, stop and flag it rather than improvising.
- TypeScript strict mode stays on for both `src/` and `functions/src/` (unchanged from the prior phase).
- Out of scope for this plan, do not build: quiz-taking UI, course/module/lesson CRUD UI, tenant creation UI, password reset/email verification.

---

## File Structure

```
src/
  lib/
    auth/
      resolveLandingRoute.ts       # pure: claims -> route path
      resolveLandingRoute.test.ts
      AuthProvider.tsx             # React context wrapping onAuthStateChanged
    progress/
      addCompletedLesson.ts        # pure: (existing ids, new id) -> new ids array
      addCompletedLesson.test.ts
  app/
    layout.tsx                     # MODIFY: wrap children in <AuthProvider>
    registro/
      page.tsx                     # sign-up form
    login/
      page.tsx                     # sign-in form, redirects via resolveLandingRoute
    cuenta/
      page.tsx                     # status page for a signed-in user with no/student claims
    panel/
      inscribir/
        page.tsx                   # owner/instructor: email + courseId -> calls enrollStudent
    [tenant]/
      cursos/
        [courseId]/
          page.tsx                 # student lesson viewer + mark-complete
functions/
  src/
    enrollment/
      assignEnrollment.ts          # pure: deps + input -> {success, studentUid}
      assignEnrollment.test.ts
      enrollStudent.ts             # onCall wrapper, wires assignEnrollment to Admin SDK
    index.ts                       # MODIFY: export enrollStudent
```

Rationale: same split as the prior phase — pure decision logic (`resolveLandingRoute`, `addCompletedLesson`, `assignEnrollment`) is unit-tested without a browser or emulator; the Cloud Function's `onCall` wrapper and every page component are thin I/O shells verified manually via the dev server, consistent with how `setTenantClaims`/`onProgressUpdated` and the catalog pages were built in the prior phase.

---

### Task 1: `resolveLandingRoute` pure function

**Files:**
- Create: `src/lib/auth/resolveLandingRoute.ts`
- Test: `src/lib/auth/resolveLandingRoute.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `resolveLandingRoute(claims: { role?: string } | null): string`. Used by Task 4 (login page) to decide where to redirect after sign-in.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/auth/resolveLandingRoute.test.ts
import { describe, it, expect } from 'vitest';
import { resolveLandingRoute } from './resolveLandingRoute';

describe('resolveLandingRoute', () => {
  it('sends an owner to the enrollment panel', () => {
    expect(resolveLandingRoute({ role: 'owner' })).toBe('/panel/inscribir');
  });

  it('sends an instructor to the enrollment panel', () => {
    expect(resolveLandingRoute({ role: 'instructor' })).toBe('/panel/inscribir');
  });

  it('sends a student to the account status page', () => {
    expect(resolveLandingRoute({ role: 'student' })).toBe('/cuenta');
  });

  it('sends a user with no claims at all to the account status page', () => {
    expect(resolveLandingRoute(null)).toBe('/cuenta');
  });

  it('sends a user with an empty claims object to the account status page', () => {
    expect(resolveLandingRoute({})).toBe('/cuenta');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- resolveLandingRoute`
Expected: FAIL with "Cannot find module './resolveLandingRoute'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/auth/resolveLandingRoute.ts
export function resolveLandingRoute(claims: { role?: string } | null): string {
  if (claims?.role === 'owner' || claims?.role === 'instructor') {
    return '/panel/inscribir';
  }
  return '/cuenta';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- resolveLandingRoute`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/resolveLandingRoute.ts src/lib/auth/resolveLandingRoute.test.ts
git commit -m "feat: add resolveLandingRoute for post-login redirect"
```

---

### Task 2: `AuthProvider` context and layout wiring

**Files:**
- Create: `src/lib/auth/AuthProvider.tsx`
- Modify: `src/app/layout.tsx` (full replace — the file is small and this changes both the import and the JSX body)

**Interfaces:**
- Consumes: `getFirebaseApp` from `src/lib/firebase/client.ts` (prior phase, Task 10)
- Produces: `AuthProvider` component and `useAuth(): { user: User | null; claims: AuthClaims | null; loading: boolean }` hook, where `AuthClaims = { tenantId?: string; role?: 'owner' | 'instructor' | 'student' }`. Used by Task 4 (login redirect fallback claims shape), Task 5 (`/cuenta` page), Task 8 (panel page, to read the caller's own tenantId), and Task 10 (lesson viewer, to gate access).

- [ ] **Step 1: Write `AuthProvider.tsx`**

No unit test for this file — it wraps Firebase's `onAuthStateChanged`, which requires a live (or emulated) Auth instance to exercise meaningfully; verified manually via the dev server in Task 4's manual check.

```typescript
// src/lib/auth/AuthProvider.tsx
'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebaseApp } from '@/lib/firebase/client';

export interface AuthClaims {
  tenantId?: string;
  role?: 'owner' | 'instructor' | 'student';
}

interface AuthContextValue {
  user: User | null;
  claims: AuthClaims | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, claims: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<AuthClaims | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth(getFirebaseApp());
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        const tokenResult = await nextUser.getIdTokenResult();
        setClaims({
          tenantId:
            typeof tokenResult.claims.tenantId === 'string' ? tokenResult.claims.tenantId : undefined,
          role:
            typeof tokenResult.claims.role === 'string'
              ? (tokenResult.claims.role as AuthClaims['role'])
              : undefined,
        });
      } else {
        setClaims(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return <AuthContext.Provider value={{ user, claims, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
```

- [ ] **Step 2: Replace `src/app/layout.tsx` in full**

Read the current file first so you don't lose any content it has beyond what's shown below (it was auto-generated by Next.js in the prior phase, then had its `metadata.title`/`description` fields changed to `'LMS SaaS'` / `'Multi-tenant course platform'' — preserve those exact values, just add the `AuthProvider` wrapper):

```typescript
// src/app/layout.tsx
import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth/AuthProvider';

export const metadata: Metadata = {
  title: 'LMS SaaS',
  description: 'Multi-tenant course platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
```

If the current file's `metadata` values differ from `'LMS SaaS'` / `'Multi-tenant course platform'`, keep whatever is actually there instead of overwriting it — only add the `AuthProvider` import and wrapper.

- [ ] **Step 3: Verify the app still builds and the existing suite still passes**

Run: `npm test`
Expected: PASS, same test count as before this task (this task adds no new tests, only a provider component and a layout change)

Run: `npx tsc --noEmit`
Expected: no output, exit 0

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth/AuthProvider.tsx src/app/layout.tsx
git commit -m "feat: add AuthProvider context and wire it into the root layout"
```

---

### Task 3: Sign-up page

**Files:**
- Create: `src/app/registro/page.tsx`

**Interfaces:**
- Consumes: `getFirebaseApp` from `src/lib/firebase/client.ts`
- Produces: the `/registro` route. No exported function other components depend on.

- [ ] **Step 1: Write `src/app/registro/page.tsx`**

No unit test — form submission against live Firebase Auth is verified manually in Step 2.

```typescript
// src/app/registro/page.tsx
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirebaseApp } from '@/lib/firebase/client';

export default function RegistroPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const auth = getAuth(getFirebaseApp());
      await createUserWithEmailAndPassword(auth, email, password);
      router.push('/cuenta');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la cuenta');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <h1>Crear cuenta</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creando...' : 'Crear cuenta'}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Manually verify via the dev server**

Run: `npm run dev`, visit `http://localhost:3000/registro`, submit the form with a test email/password.
Expected: no crash; the Firebase Auth emulator or live project (whichever `NEXT_PUBLIC_FIREBASE_*` env vars point at) creates the user, and the browser navigates to `/cuenta`.

- [ ] **Step 3: Commit**

```bash
git add src/app/registro/page.tsx
git commit -m "feat: add sign-up page"
```

---

### Task 4: Login page

**Files:**
- Create: `src/app/login/page.tsx`

**Interfaces:**
- Consumes: `resolveLandingRoute` (Task 1), `getFirebaseApp`
- Produces: the `/login` route.

- [ ] **Step 1: Write `src/app/login/page.tsx`**

No unit test — the redirect *decision* is already covered by Task 1's tests; this file only wires it to a live sign-in call, verified manually in Step 2.

```typescript
// src/app/login/page.tsx
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirebaseApp } from '@/lib/firebase/client';
import { resolveLandingRoute } from '@/lib/auth/resolveLandingRoute';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const auth = getAuth(getFirebaseApp());
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const tokenResult = await credential.user.getIdTokenResult(true);
      const role = typeof tokenResult.claims.role === 'string' ? tokenResult.claims.role : undefined;
      router.push(resolveLandingRoute({ role }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <h1>Iniciar sesión</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </main>
  );
}
```

Note: `getIdTokenResult(true)` forces a fresh token from the server rather than using a cached one — necessary here because a student's `role`/`tenantId` claims may have just been assigned by `enrollStudent` (Task 7) moments before this, and a cached token wouldn't have them yet.

- [ ] **Step 2: Manually verify via the dev server**

Run: `npm run dev`, visit `http://localhost:3000/login`, sign in with the account created in Task 3.
Expected: no crash; since this account has no claims yet, it should land on `/cuenta` (per `resolveLandingRoute`'s "no role" branch, tested in Task 1).

- [ ] **Step 3: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat: add login page with claims-based redirect"
```

---

### Task 5: Account status page

**Files:**
- Create: `src/app/cuenta/page.tsx`

**Interfaces:**
- Consumes: `useAuth` (Task 2)
- Produces: the `/cuenta` route.

- [ ] **Step 1: Write `src/app/cuenta/page.tsx`**

```typescript
// src/app/cuenta/page.tsx
'use client';

import { useAuth } from '@/lib/auth/AuthProvider';

export default function CuentaPage() {
  const { claims, loading } = useAuth();

  if (loading) {
    return <main>Cargando...</main>;
  }

  if (claims?.role === 'student') {
    return (
      <main>
        <h1>Ya estás inscripto</h1>
        <p>Pedile el link del curso a quien te inscribió.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Cuenta creada</h1>
      <p>Esperá a que te inscriban en un curso.</p>
    </main>
  );
}
```

- [ ] **Step 2: Manually verify via the dev server**

Run: `npm run dev`, visit `http://localhost:3000/cuenta` while signed in as the account from Task 3 (no claims yet).
Expected: shows "Cuenta creada" / "Esperá a que te inscriban en un curso." with no crash.

- [ ] **Step 3: Commit**

```bash
git add src/app/cuenta/page.tsx
git commit -m "feat: add account status page"
```

---

### Task 6: `assignEnrollment` pure function

**Files:**
- Create: `functions/src/enrollment/assignEnrollment.ts`
- Test: `functions/src/enrollment/assignEnrollment.test.ts`

**Interfaces:**
- Consumes: nothing external (pure function with injected dependencies)
- Produces: `assignEnrollment(deps: EnrollDeps, input: EnrollInput): Promise<{ success: true; studentUid: string }>`, where:
  ```typescript
  type Role = 'owner' | 'instructor' | 'student';

  interface EnrollDeps {
    getUserByEmail: (email: string) => Promise<{ uid: string }>;
    setCustomUserClaims: (uid: string, claims: { tenantId: string; role: Role }) => Promise<void>;
    progressExists: (tenantId: string, uid: string, courseId: string) => Promise<boolean>;
    createProgress: (tenantId: string, uid: string, courseId: string) => Promise<void>;
  }

  interface EnrollInput {
    callerClaims: { tenantId: string; role: Role };
    email: string;
    courseId: string;
  }
  ```
  Used by Task 7's `enrollStudent` callable, which supplies the real Admin SDK-backed `deps`.

- [ ] **Step 1: Write the failing test**

```typescript
// functions/src/enrollment/assignEnrollment.test.ts
import { describe, it, expect, vi } from 'vitest';
import { assignEnrollment } from './assignEnrollment';

function makeDeps(overrides: Partial<{
  getUserByEmail: ReturnType<typeof vi.fn>;
  setCustomUserClaims: ReturnType<typeof vi.fn>;
  progressExists: ReturnType<typeof vi.fn>;
  createProgress: ReturnType<typeof vi.fn>;
}> = {}) {
  return {
    getUserByEmail: vi.fn().mockResolvedValue({ uid: 'student-uid-1' }),
    setCustomUserClaims: vi.fn().mockResolvedValue(undefined),
    progressExists: vi.fn().mockResolvedValue(false),
    createProgress: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('assignEnrollment', () => {
  it('rejects a caller who is not owner or instructor', async () => {
    const deps = makeDeps();

    await expect(
      assignEnrollment(deps, {
        callerClaims: { tenantId: 'tenant-a', role: 'student' },
        email: 'alumno@example.com',
        courseId: 'course-1',
      }),
    ).rejects.toThrow('caller must be an owner or instructor');

    expect(deps.getUserByEmail).not.toHaveBeenCalled();
  });

  it('resolves the student by email, assigns claims, and creates a new progress record', async () => {
    const deps = makeDeps();

    const result = await assignEnrollment(deps, {
      callerClaims: { tenantId: 'tenant-a', role: 'owner' },
      email: 'alumno@example.com',
      courseId: 'course-1',
    });

    expect(deps.getUserByEmail).toHaveBeenCalledWith('alumno@example.com');
    expect(deps.setCustomUserClaims).toHaveBeenCalledWith('student-uid-1', {
      tenantId: 'tenant-a',
      role: 'student',
    });
    expect(deps.createProgress).toHaveBeenCalledWith('tenant-a', 'student-uid-1', 'course-1');
    expect(result).toEqual({ success: true, studentUid: 'student-uid-1' });
  });

  it('allows an instructor (not just an owner) to enroll a student', async () => {
    const deps = makeDeps();

    await assignEnrollment(deps, {
      callerClaims: { tenantId: 'tenant-a', role: 'instructor' },
      email: 'alumno@example.com',
      courseId: 'course-1',
    });

    expect(deps.setCustomUserClaims).toHaveBeenCalled();
  });

  it('does not overwrite an existing progress record for an already-enrolled student', async () => {
    const deps = makeDeps({ progressExists: vi.fn().mockResolvedValue(true) });

    await assignEnrollment(deps, {
      callerClaims: { tenantId: 'tenant-a', role: 'owner' },
      email: 'alumno@example.com',
      courseId: 'course-1',
    });

    expect(deps.createProgress).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd functions && npx vitest run src/enrollment/assignEnrollment.test.ts`
Expected: FAIL with "Cannot find module './assignEnrollment'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// functions/src/enrollment/assignEnrollment.ts
export type Role = 'owner' | 'instructor' | 'student';

export interface EnrollDeps {
  getUserByEmail: (email: string) => Promise<{ uid: string }>;
  setCustomUserClaims: (uid: string, claims: { tenantId: string; role: Role }) => Promise<void>;
  progressExists: (tenantId: string, uid: string, courseId: string) => Promise<boolean>;
  createProgress: (tenantId: string, uid: string, courseId: string) => Promise<void>;
}

export interface EnrollInput {
  callerClaims: { tenantId: string; role: Role };
  email: string;
  courseId: string;
}

export async function assignEnrollment(
  deps: EnrollDeps,
  input: EnrollInput,
): Promise<{ success: true; studentUid: string }> {
  if (input.callerClaims.role !== 'owner' && input.callerClaims.role !== 'instructor') {
    throw new Error('caller must be an owner or instructor');
  }

  const { uid } = await deps.getUserByEmail(input.email);

  await deps.setCustomUserClaims(uid, { tenantId: input.callerClaims.tenantId, role: 'student' });

  const alreadyEnrolled = await deps.progressExists(input.callerClaims.tenantId, uid, input.courseId);
  if (!alreadyEnrolled) {
    await deps.createProgress(input.callerClaims.tenantId, uid, input.courseId);
  }

  return { success: true, studentUid: uid };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd functions && npx vitest run src/enrollment/assignEnrollment.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add functions/src/enrollment/assignEnrollment.ts functions/src/enrollment/assignEnrollment.test.ts
git commit -m "feat: add assignEnrollment pure enrollment logic"
```

---

### Task 7: `enrollStudent` Cloud Function

**Files:**
- Create: `functions/src/enrollment/enrollStudent.ts`
- Modify: `functions/src/index.ts`

**Interfaces:**
- Consumes: `assignEnrollment`, `EnrollDeps`, `Role` (Task 6); `getAuth` from `firebase-admin/auth`; `getFirestore` from `firebase-admin/firestore` (same modular-import pattern already used in `functions/src/certificate/onProgressUpdated.ts` and `functions/src/auth/setTenantClaims.ts`)
- Produces: callable Cloud Function `enrollStudent({ email: string, courseId: string }, context) -> { success: true; studentUid: string }`. Consumed by Task 8's panel page via `httpsCallable(functions, 'enrollStudent')`.

- [ ] **Step 1: Write `functions/src/enrollment/enrollStudent.ts`**

No new unit test — this file is a thin wrapper around already-tested `assignEnrollment`, same precedent as `setTenantClaims`'s `onCall` wrapper. Verified via `npx tsc --noEmit` (Step 2) and manually in Task 8's dev-server check.

```typescript
// functions/src/enrollment/enrollStudent.ts
import * as functionsV1 from 'firebase-functions/v1';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { assignEnrollment, type Role } from './assignEnrollment';

export const enrollStudent = functionsV1.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');
  }

  const token = context.auth.token as Record<string, unknown>;
  if (typeof token.tenantId !== 'string' || typeof token.role !== 'string') {
    throw new functionsV1.https.HttpsError(
      'failed-precondition',
      'Caller is missing tenantId/role claims',
    );
  }
  const callerClaims = { tenantId: token.tenantId, role: token.role as Role };

  const auth = getAuth();
  const db = getFirestore();

  return assignEnrollment(
    {
      getUserByEmail: async (email) => {
        const userRecord = await auth.getUserByEmail(email);
        return { uid: userRecord.uid };
      },
      setCustomUserClaims: (uid, claims) => auth.setCustomUserClaims(uid, claims),
      progressExists: async (tenantId, uid, courseId) => {
        const snap = await db
          .doc(`tenants/${tenantId}/students/${uid}/progress/${courseId}`)
          .get();
        return snap.exists;
      },
      createProgress: async (tenantId, uid, courseId) => {
        await db.doc(`tenants/${tenantId}/students/${uid}/progress/${courseId}`).set({
          courseId,
          lessonsCompleted: [],
          quizScores: {},
          certificateUrl: null,
        });
      },
    },
    {
      callerClaims,
      email: data.email,
      courseId: data.courseId,
    },
  );
});
```

- [ ] **Step 2: Update `functions/src/index.ts`**

The current file (from the prior phase) is:
```typescript
import './admin';

export { setTenantClaims } from './auth/setTenantClaims';
export { onProgressUpdated } from './certificate/onProgressUpdated';
```

Add one line:
```typescript
import './admin';

export { setTenantClaims } from './auth/setTenantClaims';
export { onProgressUpdated } from './certificate/onProgressUpdated';
export { enrollStudent } from './enrollment/enrollStudent';
```

- [ ] **Step 3: Verify the whole functions project still compiles and all tests pass**

Run: `cd functions && npx tsc --noEmit`
Expected: no output, exit 0

Run: `cd functions && npm test`
Expected: PASS, 4 new tests from Task 6 plus all previously-passing tests (12 total)

- [ ] **Step 4: Commit**

```bash
git add functions/src/enrollment/enrollStudent.ts functions/src/index.ts
git commit -m "feat: add enrollStudent callable Cloud Function"
```

---

### Task 8: Panel enrollment screen

**Files:**
- Create: `src/app/panel/inscribir/page.tsx`

**Interfaces:**
- Consumes: `getFirebaseApp`; Firebase's `httpsCallable` calling the `enrollStudent` function by name (Task 7)
- Produces: the `/panel/inscribir` route, which is where `resolveLandingRoute` (Task 1) sends owners/instructors after login.

- [ ] **Step 1: Write `src/app/panel/inscribir/page.tsx`**

```typescript
// src/app/panel/inscribir/page.tsx
'use client';

import { useState, type FormEvent } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirebaseApp } from '@/lib/firebase/client';

export default function InscribirPage() {
  const [email, setEmail] = useState('');
  const [courseId, setCourseId] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('submitting');
    setMessage(null);
    try {
      const functions = getFunctions(getFirebaseApp());
      const enrollStudent = httpsCallable(functions, 'enrollStudent');
      await enrollStudent({ email, courseId });
      setStatus('done');
      setMessage('Alumno inscripto correctamente.');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'No se pudo inscribir al alumno');
    }
  }

  return (
    <main>
      <h1>Inscribir alumno</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Email del alumno
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          ID del curso
          <input type="text" value={courseId} onChange={(e) => setCourseId(e.target.value)} required />
        </label>
        <button type="submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Inscribiendo...' : 'Inscribir'}
        </button>
      </form>
      {message && <p role="status">{message}</p>}
    </main>
  );
}
```

- [ ] **Step 2: Manually verify via the dev server + emulators**

Run: `firebase emulators:start --only functions,firestore,auth` (in one terminal) and `npm run dev` (in another). Sign in as an account with `role: owner` (assign via the emulator's Auth UI or a one-off script calling `setTenantClaims`), visit `/panel/inscribir`, submit a real student email (created via `/registro`) and a `courseId`.
Expected: "Alumno inscripto correctamente." message; the emulator's Firestore UI shows a new `tenants/{tenantId}/students/{uid}/progress/{courseId}` document with empty `lessonsCompleted`.

- [ ] **Step 3: Commit**

```bash
git add src/app/panel/inscribir/page.tsx
git commit -m "feat: add owner/instructor enrollment screen"
```

---

### Task 9: `addCompletedLesson` pure function

**Files:**
- Create: `src/lib/progress/addCompletedLesson.ts`
- Test: `src/lib/progress/addCompletedLesson.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `addCompletedLesson(lessonsCompleted: string[], lessonId: string): string[]`. Used by Task 10's lesson viewer when the student clicks "Marcar como completada".

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/progress/addCompletedLesson.test.ts
import { describe, it, expect } from 'vitest';
import { addCompletedLesson } from './addCompletedLesson';

describe('addCompletedLesson', () => {
  it('appends a new lesson id to the list', () => {
    expect(addCompletedLesson(['lesson-1'], 'lesson-2')).toEqual(['lesson-1', 'lesson-2']);
  });

  it('does not duplicate an already-completed lesson id', () => {
    expect(addCompletedLesson(['lesson-1', 'lesson-2'], 'lesson-1')).toEqual([
      'lesson-1',
      'lesson-2',
    ]);
  });

  it('returns a new array instance rather than mutating the input', () => {
    const original = ['lesson-1'];
    const result = addCompletedLesson(original, 'lesson-2');
    expect(result).not.toBe(original);
    expect(original).toEqual(['lesson-1']);
  });

  it('works from an empty list', () => {
    expect(addCompletedLesson([], 'lesson-1')).toEqual(['lesson-1']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- addCompletedLesson`
Expected: FAIL with "Cannot find module './addCompletedLesson'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/progress/addCompletedLesson.ts
export function addCompletedLesson(lessonsCompleted: string[], lessonId: string): string[] {
  if (lessonsCompleted.includes(lessonId)) {
    return lessonsCompleted;
  }
  return [...lessonsCompleted, lessonId];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- addCompletedLesson`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/progress/addCompletedLesson.ts src/lib/progress/addCompletedLesson.test.ts
git commit -m "feat: add addCompletedLesson pure progress-update logic"
```

---

### Task 10: Lesson viewer page

**Files:**
- Create: `src/app/[tenant]/cursos/[courseId]/page.tsx`

**Interfaces:**
- Consumes: `useAuth` (Task 2), `addCompletedLesson` (Task 9), `Module`/`Lesson` types from `src/lib/models/types.ts` (prior phase, Task 3), `getFirebaseApp`
- Produces: the `/{tenant}/cursos/{courseId}` route — this is the exact route the catalog pages (prior phase, Task 10) already link to, so no changes are needed there.

- [ ] **Step 1: Write `src/app/[tenant]/cursos/[courseId]/page.tsx`**

```typescript
// src/app/[tenant]/cursos/[courseId]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { getFirebaseApp } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { addCompletedLesson } from '@/lib/progress/addCompletedLesson';
import type { Lesson } from '@/lib/models/types';

interface LessonWithModule extends Lesson {
  moduleId: string;
}

export default function CursoPage({
  params,
}: {
  params: { tenant: string; courseId: string };
}) {
  const { user, claims, loading: authLoading } = useAuth();
  const [lessons, setLessons] = useState<LessonWithModule[]>([]);
  const [lessonsCompleted, setLessonsCompleted] = useState<string[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user || claims?.role !== 'student' || claims.tenantId !== params.tenant) {
      return;
    }

    async function loadCourseContent() {
      const db = getFirestore(getFirebaseApp());

      const modulesSnap = await getDocs(
        query(
          collection(db, `tenants/${params.tenant}/courses/${params.courseId}/modules`),
          orderBy('order'),
        ),
      );

      const allLessons: LessonWithModule[] = [];
      for (const moduleDoc of modulesSnap.docs) {
        const lessonsSnap = await getDocs(
          query(
            collection(
              db,
              `tenants/${params.tenant}/courses/${params.courseId}/modules/${moduleDoc.id}/lessons`,
            ),
            orderBy('order'),
          ),
        );
        lessonsSnap.forEach((lessonDoc) => {
          const data = lessonDoc.data();
          allLessons.push({
            id: lessonDoc.id,
            moduleId: moduleDoc.id,
            title: data.title,
            order: data.order,
            videoUrl: data.videoUrl ?? null,
            textContent: data.textContent ?? null,
            attachmentUrls: data.attachmentUrls ?? [],
          });
        });
      }
      setLessons(allLessons);
      if (allLessons.length > 0) {
        setSelectedLessonId(allLessons[0].id);
      }

      const progressSnap = await getDoc(
        doc(db, `tenants/${params.tenant}/students/${user!.uid}/progress/${params.courseId}`),
      );
      if (progressSnap.exists()) {
        setLessonsCompleted(progressSnap.data().lessonsCompleted ?? []);
      }

      setDataLoading(false);
    }

    loadCourseContent();
  }, [authLoading, user, claims, params.tenant, params.courseId]);

  async function markComplete(lessonId: string) {
    if (!user) return;
    const db = getFirestore(getFirebaseApp());
    const updated = addCompletedLesson(lessonsCompleted, lessonId);
    await updateDoc(
      doc(db, `tenants/${params.tenant}/students/${user.uid}/progress/${params.courseId}`),
      { lessonsCompleted: updated },
    );
    setLessonsCompleted(updated);
  }

  if (authLoading) {
    return <main>Cargando...</main>;
  }

  if (!user) {
    return (
      <main>
        <p>Tenés que iniciar sesión para ver este curso.</p>
        <a href="/login">Iniciar sesión</a>
      </main>
    );
  }

  if (claims?.role !== 'student' || claims.tenantId !== params.tenant) {
    return <main>No tenés acceso a este curso.</main>;
  }

  if (dataLoading) {
    return <main>Cargando contenido del curso...</main>;
  }

  const selectedLesson = lessons.find((l) => l.id === selectedLessonId) ?? null;

  return (
    <main>
      <aside>
        <ul>
          {lessons.map((lesson) => (
            <li key={lesson.id}>
              <button onClick={() => setSelectedLessonId(lesson.id)}>
                {lessonsCompleted.includes(lesson.id) ? '✓ ' : ''}
                {lesson.title}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section>
        {selectedLesson && (
          <>
            <h1>{selectedLesson.title}</h1>
            {selectedLesson.videoUrl && (
              <video src={selectedLesson.videoUrl} controls style={{ width: '100%' }} />
            )}
            {selectedLesson.textContent && <p>{selectedLesson.textContent}</p>}
            <button onClick={() => markComplete(selectedLesson.id)}>
              Marcar como completada
            </button>
          </>
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Manually verify via the dev server + emulators**

With the emulators and dev server still running from Task 8: in the Firestore emulator UI, manually add one `module` document and one `lesson` document underneath the `courseId` you enrolled the test student into (Task 8's manual check created the enrollment; course content itself is still authored by hand per this plan's explicit non-goal of building a CRUD UI). Sign in as the student account, visit `/{tenant}/cursos/{courseId}`.

Expected: the lesson title appears in the sidebar; clicking "Marcar como completada" adds a checkmark and the emulator's Firestore UI shows `lessonsCompleted` updated on the student's `progress` document. Visiting the same URL signed in as a *different* tenant's student (or signed out) shows the access-denied / login-prompt states instead of the lesson content.

- [ ] **Step 3: Run the full test suite one more time to confirm no regressions**

Run: `npm test` (root)
Expected: PASS, 27 tests total (18 from the prior phase + 5 from Task 1 + 4 from Task 9)

Run: `cd functions && npm test`
Expected: PASS, 12 tests total (8 from the prior phase + 4 from Task 6)

- [ ] **Step 4: Commit**

```bash
git add "src/app/[tenant]/cursos/[courseId]/page.tsx"
git commit -m "feat: add student lesson viewer with mark-complete action"
```

---

## Self-Review Notes

- **Spec coverage:** email+password sign-up/login (Tasks 3-4), claims-based redirect (Task 1), `AuthProvider` (Task 2), `enrollStudent` with its authorization/idempotency rules (Tasks 6-7), the panel enrollment screen (Task 8), and the lesson viewer with mark-complete (Tasks 9-10) are all covered. The design doc's explicit non-goals (quiz UI, course CRUD UI, tenant creation, password reset) have no corresponding tasks, as intended.
- **Placeholder scan:** no TBD/TODO markers; every step has runnable code.
- **Type consistency:** `AuthClaims` (Task 2) and the inline `{ role?: string }` / `{ tenantId?: string; role?: ... }` shapes used in Tasks 1, 4, 8, and 10 all agree on field names (`tenantId`, `role`) and the three role string literals (`'owner' | 'instructor' | 'student'`). `assignEnrollment`'s `Role` type (Task 6) matches the same three literals and is reused verbatim by `enrollStudent.ts` (Task 7). `Lesson`/`Module` field names used in Task 10 (`videoUrl`, `textContent`, `attachmentUrls`, `order`) match `src/lib/models/types.ts` exactly (verified against the prior phase's Task 3).
