# Frontend Visual Design (Phase A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every existing page a real neubrutalist visual identity (electric blue accent, thick black borders, offset shadows, bold uppercase headings) plus a shared header for authenticated pages — no logic changes, no new npm dependencies.

**Architecture:** One global CSS file (`src/app/globals.css`) defines design tokens and a small set of reusable classes (`.card`, `.btn`, `.input`, `.badge`, `.page-hero`, `.page-app`, etc.), imported once in the root layout. A new `Header` client component reads auth state and renders itself only when a user is signed in and the route isn't the embed catalog. Every page component gets its JSX wrapped in the new classes — the data-fetching and event-handling logic in each file is otherwise untouched.

**Tech Stack:** Plain CSS (custom properties + classes), no CSS framework, no new npm packages.

## Global Constraints

- No new npm dependencies (spec: "Rejected alternatives: Tailwind CSS... CSS-in-JS").
- No changes to business logic, data fetching, or Firebase calls in any touched file — only JSX structure and `className` usage change, plus the two new files (`globals.css`, `Header.tsx`).
- Tokens (exact values, spec: "Visual direction" section): accent `#4361ff`, ink `#111111`, surface `#ffffff`, app background `#f5f5f0`, border `2px solid` (inputs/buttons) / `3px solid` (cards), shadow `7px 7px 0` (hard offset, no blur), border-radius 8-10px, headings bold/uppercase, system font stack only (no webfont).
- Two page treatments only: hero (full-bleed blue, centered white card) for public/unauthenticated pages; app (light neutral background, header, cards) for authenticated pages. The embed catalog gets neither — compact, no header, no full-bleed background.
- No dark mode / theme toggle.
- No unit tests for this plan — purely visual, verified via `npx tsc --noEmit`, `npm test` (confirming no accidental regression), and manual dev-server checks, consistent with this project's existing precedent for page components.

---

## File Structure

```
src/
  app/
    globals.css                          # NEW: design tokens + component classes
    layout.tsx                           # MODIFY: import globals.css, render <Header />
    page.tsx                             # MODIFY: hero treatment
    registro/page.tsx                    # MODIFY: hero treatment
    login/page.tsx                       # MODIFY: hero treatment
    [tenant]/page.tsx                    # MODIFY: hero treatment, course list styling
    embed/[tenantId]/page.tsx            # MODIFY: compact treatment
    cuenta/page.tsx                      # MODIFY: app treatment
    panel/inscribir/page.tsx             # MODIFY: app treatment
    panel/integrar/page.tsx              # MODIFY: app treatment
    [tenant]/cursos/[courseId]/page.tsx  # MODIFY: app treatment, two-column lesson layout
  components/
    Header.tsx                           # NEW: shared header, auth-aware
```

---

### Task 1: Design tokens and global CSS

**Files:**
- Create: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: CSS custom properties (`--color-accent`, `--color-ink`, `--color-surface`, `--color-bg-app`, `--color-danger`, `--border-thin`, `--border-thick`, `--shadow-offset`, `--shadow-offset-sm`, `--radius`) and classes (`.card`, `.field`, `.field-label`, `.input`, `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-block`, `.alert`, `.alert-error`, `.alert-info`, `.badge`, `.page-hero`, `.page-hero-title`, `.page-app`, `.page-app-content`, `.course-list`, `.course-card`, `.embed-list`, `.lesson-layout`, `.lesson-sidebar-list`, `.app-header`) that every later task's JSX references by exact name.

- [ ] **Step 1: Write `src/app/globals.css`**

```css
:root {
  --color-accent: #4361ff;
  --color-ink: #111111;
  --color-surface: #ffffff;
  --color-bg-app: #f5f5f0;
  --color-danger: #d1293d;
  --border-thin: 2px solid var(--color-ink);
  --border-thick: 3px solid var(--color-ink);
  --shadow-offset: 7px 7px 0 var(--color-ink);
  --shadow-offset-sm: 4px 4px 0 var(--color-ink);
  --radius: 10px;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: var(--color-ink);
  background: var(--color-bg-app);
}

h1,
h2,
h3 {
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: -0.02em;
  margin: 0 0 8px;
}

a {
  color: var(--color-accent);
  font-weight: 600;
}

/* Hero page shell (public, unauthenticated) */
.page-hero {
  min-height: 100vh;
  background: var(--color-accent);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  gap: 24px;
}

.page-hero-title {
  color: #fff;
  text-align: center;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: -0.02em;
  font-size: 28px;
  margin: 0;
}

.page-hero .card {
  width: 100%;
  max-width: 380px;
}

/* App page shell (authenticated) */
.page-app {
  min-height: 100vh;
}

.page-app-content {
  max-width: 720px;
  margin: 0 auto;
  padding: 32px 24px;
}

/* Card */
.card {
  background: var(--color-surface);
  border: var(--border-thick);
  border-radius: var(--radius);
  box-shadow: var(--shadow-offset);
  padding: 28px;
}

/* Form elements */
.field {
  margin-bottom: 16px;
  display: block;
}

.field-label {
  display: block;
  font-weight: 700;
  font-size: 13px;
  text-transform: uppercase;
  margin-bottom: 6px;
}

.input {
  width: 100%;
  padding: 11px 12px;
  border: var(--border-thin);
  border-radius: 8px;
  font-size: 15px;
  background: #fff;
  color: var(--color-ink);
}

.input:focus {
  outline: 3px solid var(--color-accent);
  outline-offset: 1px;
}

/* Buttons */
.btn {
  display: inline-block;
  padding: 11px 20px;
  border-radius: 8px;
  border: var(--border-thin);
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  text-decoration: none;
  text-align: center;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-ink);
  color: var(--color-accent);
  box-shadow: var(--shadow-offset-sm);
}

.btn-secondary {
  background: #fff;
  color: var(--color-ink);
}

.btn-block {
  display: block;
  width: 100%;
}

/* Alerts */
.alert {
  border: var(--border-thin);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  font-weight: 600;
  margin-top: 12px;
}

.alert-error {
  background: #ffe3e6;
  color: var(--color-danger);
  border-color: var(--color-danger);
}

.alert-info {
  background: #eef6ff;
  color: var(--color-ink);
}

/* Badge */
.badge {
  display: inline-block;
  padding: 3px 10px;
  border: 2px solid var(--color-ink);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  background: #fff;
}

/* Header */
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  background: #fff;
  border-bottom: var(--border-thick);
}

.app-header .logo {
  font-weight: 800;
  text-transform: uppercase;
  font-size: 18px;
  letter-spacing: -0.02em;
  text-decoration: none;
  color: var(--color-ink);
}

.app-header .user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
}

/* Catalog list */
.course-list {
  display: grid;
  gap: 16px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.course-card a {
  font-size: 18px;
  text-decoration: none;
  color: var(--color-ink);
  font-weight: 800;
}

.course-card p {
  margin: 6px 0 0;
  color: #444;
  font-size: 14px;
}

/* Embed compact catalog (no header/hero, lives inside a foreign iframe) */
.embed-list {
  list-style: none;
  margin: 0;
  padding: 12px;
}

.embed-list li {
  margin-bottom: 10px;
}

.embed-list a {
  display: block;
  padding: 10px 14px;
  border: 2px solid var(--color-ink);
  border-radius: 8px;
  text-decoration: none;
  color: var(--color-ink);
  font-weight: 700;
}

/* Lesson viewer layout */
.lesson-layout {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 20px;
  max-width: 960px;
  margin: 0 auto;
  padding: 32px 24px;
  align-items: start;
}

.lesson-sidebar-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lesson-sidebar-list button {
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  border: var(--border-thin);
  border-radius: 8px;
  background: #fff;
  font-weight: 600;
  cursor: pointer;
}

.lesson-sidebar-list button.active {
  background: var(--color-accent);
  color: #fff;
}

@media (max-width: 720px) {
  .lesson-layout {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 2: Import it in `src/app/layout.tsx`**

Current file:
```tsx
import { AuthProvider } from '@/lib/auth/AuthProvider'

export const metadata = {
  title: 'LMS SaaS',
  description: 'Multi-tenant course platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
```

Replace with:
```tsx
import { AuthProvider } from '@/lib/auth/AuthProvider'
import './globals.css'

export const metadata = {
  title: 'LMS SaaS',
  description: 'Multi-tenant course platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
```

(Header is added in Task 2 — this step only wires up the stylesheet so Task 1 is independently verifiable.)

- [ ] **Step 3: Verify nothing broke**

Run: `npx tsc --noEmit`
Expected: exit 0, no output

Run: `npm test`
Expected: 27/27 passing (unchanged — this task touches no logic)

Run: `npm run dev`, visit `http://localhost:3000/login`
Expected: page loads with no crash; it will look unstyled still (globals.css defines classes, but no page uses them yet) except body background/font may already shift slightly — that's expected and fixed by later tasks.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat: add neubrutalist design tokens and global CSS"
```

---

### Task 2: Shared header

**Files:**
- Create: `src/components/Header.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `useAuth()` from `src/lib/auth/AuthProvider.tsx` (`{ user, claims, signOut }`); `usePathname` from `next/navigation`; `.app-header`, `.logo`, `.user-info`, `.badge`, `.btn`, `.btn-secondary` classes (Task 1)
- Produces: `<Header />` component, rendered once in the root layout inside `<AuthProvider>`, above `{children}`.

- [ ] **Step 1: Write `src/components/Header.tsx`**

```tsx
'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';

export function Header() {
  const pathname = usePathname();
  const { user, claims, signOut } = useAuth();

  if (!user || pathname?.startsWith('/embed')) {
    return null;
  }

  return (
    <header className="app-header">
      <a href="/" className="logo">
        LMS SaaS
      </a>
      <div className="user-info">
        <span>{user.email}</span>
        {claims?.role && <span className="badge">{claims.role}</span>}
        <button className="btn btn-secondary" onClick={() => signOut()}>
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
```

The `pathname?.startsWith('/embed')` check is what keeps the header out of the embed catalog iframe (Task 5) even if the tenant owner happens to be signed in in the same browser — the spec requires the embed page impose no branding beyond the course list.

- [ ] **Step 2: Wire it into `src/app/layout.tsx`**

```tsx
import { AuthProvider } from '@/lib/auth/AuthProvider'
import { Header } from '@/components/Header'
import './globals.css'

export const metadata = {
  title: 'LMS SaaS',
  description: 'Multi-tenant course platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Header />
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0

Run: `npm test`
Expected: 27/27 passing

Run: `npm run dev`, sign in at `/login` with a test account, confirm the header appears on `/cuenta` with the email and a "Cerrar sesión" button that actually signs out. Visit `/login` itself (before signing in) and confirm the header does NOT appear there.

- [ ] **Step 4: Commit**

```bash
git add src/components/Header.tsx src/app/layout.tsx
git commit -m "feat: add shared header for authenticated pages"
```

---

### Task 3: Hero pages (root, login, registro)

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/registro/page.tsx`

**Interfaces:**
- Consumes: `.page-hero`, `.page-hero-title`, `.card`, `.field`, `.field-label`, `.input`, `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-block`, `.alert`, `.alert-error` (Task 1)
- Produces: nothing new — these are leaf pages.

- [ ] **Step 1: Replace `src/app/page.tsx`**

```tsx
export default function HomePage() {
  return (
    <div className="page-hero">
      <p className="page-hero-title">LMS SaaS</p>
      <div className="card">
        <h2>Plataforma de cursos</h2>
        <p style={{ marginBottom: 20 }}>
          Gestioná cursos, alumnos y certificados desde un solo lugar.
        </p>
        <a href="/login" className="btn btn-primary btn-block">
          Iniciar sesión
        </a>
        <div style={{ height: 12 }} />
        <a href="/registro" className="btn btn-secondary btn-block">
          Crear cuenta
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/app/login/page.tsx`**

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase/client';
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
      const auth = getFirebaseAuth();
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
    <div className="page-hero">
      <p className="page-hero-title">LMS SaaS</p>
      <div className="card">
        <h1>Iniciar sesión</h1>
        <form onSubmit={handleSubmit}>
          <label className="field">
            <span className="field-label">Email</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span className="field-label">Contraseña</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && (
            <p className="alert alert-error" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={submitting}
            style={{ marginTop: 8 }}
          >
            {submitting ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Replace `src/app/registro/page.tsx`**

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase/client';

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
      const auth = getFirebaseAuth();
      await createUserWithEmailAndPassword(auth, email, password);
      router.push('/cuenta');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la cuenta');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-hero">
      <p className="page-hero-title">LMS SaaS</p>
      <div className="card">
        <h1>Crear cuenta</h1>
        <form onSubmit={handleSubmit}>
          <label className="field">
            <span className="field-label">Email</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span className="field-label">Contraseña</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>
          {error && (
            <p className="alert alert-error" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={submitting}
            style={{ marginTop: 8 }}
          >
            {submitting ? 'Creando...' : 'Crear cuenta'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0

Run: `npm test`
Expected: 27/27 passing

Run: `npm run dev`, visit `/`, `/login`, `/registro`
Expected: all three show the blue full-bleed background with a centered white bordered card with offset shadow; form submission still works exactly as before (sign in / sign up / redirect).

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/login/page.tsx src/app/registro/page.tsx
git commit -m "feat: restyle root, login, and registro pages as hero pages"
```

---

### Task 4: Public catalog page

**Files:**
- Modify: `src/app/[tenant]/page.tsx`

**Interfaces:**
- Consumes: `.page-hero`, `.page-hero-title`, `.card`, `.course-list`, `.course-card` (Task 1)
- Produces: nothing new — leaf page. Links to `/{tenant}/cursos/{courseId}`, unchanged (Task 7 restyles that route, not this one).

- [ ] **Step 1: Replace `src/app/[tenant]/page.tsx`**

```tsx
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase/client';
import { courseConverter } from '@/lib/models/courseConverters';

export default async function TenantCatalogPage({
  params,
}: {
  params: { tenant: string };
}) {
  const db = getFirebaseFirestore();
  const coursesRef = collection(db, `tenants/${params.tenant}/courses`).withConverter(
    courseConverter,
  );
  const snapshot = await getDocs(query(coursesRef, where('published', '==', true)));
  const courses = snapshot.docs.map((d) => d.data());

  return (
    <div className="page-hero">
      <p className="page-hero-title">LMS SaaS</p>
      <div className="card" style={{ maxWidth: 560 }}>
        <h1>Cursos disponibles</h1>
        <ul className="course-list">
          {courses.map((course) => (
            <li key={course.id} className="course-card">
              <a href={`/${params.tenant}/cursos/${course.id}`}>{course.title}</a>
              <p>{course.description}</p>
            </li>
          ))}
        </ul>
        {courses.length === 0 && <p>Todavía no hay cursos publicados.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0

Run: `npm test`
Expected: 27/27 passing

Run: `npm run dev`, visit `/demo-tenant` (or any tenant id — an empty published-courses result is fine)
Expected: blue hero background, centered card titled "Cursos disponibles", "Todavía no hay cursos publicados." shown when the list is empty, no crash.

- [ ] **Step 3: Commit**

```bash
git add "src/app/[tenant]/page.tsx"
git commit -m "feat: restyle public course catalog as a hero page"
```

---

### Task 5: Embed catalog (compact)

**Files:**
- Modify: `src/app/embed/[tenantId]/page.tsx`

**Interfaces:**
- Consumes: `.embed-list` (Task 1). Relies on Task 2's `Header` already excluding itself from `/embed/*` routes — this task does not need to do anything about the header itself.
- Produces: nothing new — leaf page.

- [ ] **Step 1: Replace `src/app/embed/[tenantId]/page.tsx`**

```tsx
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase/client';
import { courseConverter } from '@/lib/models/courseConverters';

export default async function EmbedCatalogPage({
  params,
}: {
  params: { tenantId: string };
}) {
  const db = getFirebaseFirestore();
  const coursesRef = collection(db, `tenants/${params.tenantId}/courses`).withConverter(
    courseConverter,
  );
  const snapshot = await getDocs(query(coursesRef, where('published', '==', true)));
  const courses = snapshot.docs.map((d) => d.data());

  return (
    <ul className="embed-list">
      {courses.map((course) => (
        <li key={course.id}>
          <a href={`/${params.tenantId}/cursos/${course.id}`} target="_top">
            {course.title}
          </a>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0

Run: `npm test`
Expected: 27/27 passing

Run: `npm run dev`, visit `/embed/demo-tenant` both signed out AND signed in (as any account)
Expected: no header in either case (confirms Task 2's pathname check works), compact bordered link list, no blue full-bleed background, no crash.

- [ ] **Step 3: Commit**

```bash
git add "src/app/embed/[tenantId]/page.tsx"
git commit -m "feat: restyle embed catalog as a compact list, no header"
```

---

### Task 6: App pages (cuenta, panel/inscribir, panel/integrar)

**Files:**
- Modify: `src/app/cuenta/page.tsx`
- Modify: `src/app/panel/inscribir/page.tsx`
- Modify: `src/app/panel/integrar/page.tsx`

**Interfaces:**
- Consumes: `.page-app`, `.page-app-content`, `.card`, `.field`, `.field-label`, `.input`, `.btn`, `.btn-primary`, `.alert`, `.alert-error`, `.alert-info` (Task 1); `useAuth()` (existing)
- Produces: nothing new — leaf pages.
- Note: the standalone "Cerrar sesión" buttons that used to live inside `cuenta/page.tsx`'s own JSX are removed in this task — sign-out is now handled once, globally, by the shared `Header` (Task 2). This is intentional, not an accidental omission.

- [ ] **Step 1: Replace `src/app/cuenta/page.tsx`**

```tsx
// src/app/cuenta/page.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';

export default function CuentaPage() {
  const { claims, loading, refreshClaims } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshClaims();
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="page-app">
        <div className="page-app-content">
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  if (claims?.role === 'student') {
    return (
      <div className="page-app">
        <div className="page-app-content">
          <div className="card">
            <h1>Ya estás inscripto</h1>
            <p>Pedile el link del curso a quien te inscribió.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-app">
      <div className="page-app-content">
        <div className="card">
          <h1>Cuenta creada</h1>
          <p>Esperá a que te inscriban en un curso.</p>
          <button className="btn btn-primary" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? 'Actualizando...' : 'Ya me inscribieron — actualizar'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/app/panel/inscribir/page.tsx`**

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from '@/lib/firebase/client';

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
      const functions = getFirebaseFunctions();
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
    <div className="page-app">
      <div className="page-app-content">
        <div className="card">
          <h1>Inscribir alumno</h1>
          <form onSubmit={handleSubmit}>
            <label className="field">
              <span className="field-label">Email del alumno</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span className="field-label">ID del curso</span>
              <input
                className="input"
                type="text"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                required
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={status === 'submitting'}>
              {status === 'submitting' ? 'Inscribiendo...' : 'Inscribir'}
            </button>
          </form>
          {message && (
            <p
              className={`alert ${status === 'error' ? 'alert-error' : 'alert-info'}`}
              role="status"
            >
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Replace `src/app/panel/integrar/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { buildEmbedSnippet } from '@/lib/embed/buildEmbedSnippet';

export default function IntegrarPage({
  searchParams,
}: {
  searchParams: { tenantId?: string };
}) {
  const tenantId = searchParams.tenantId ?? '';
  const [copied, setCopied] = useState(false);

  const snippet = buildEmbedSnippet({
    tenantId,
    baseUrl: process.env.NEXT_PUBLIC_APP_BASE_URL ?? 'https://tucampus.com',
  });

  return (
    <div className="page-app">
      <div className="page-app-content">
        <div className="card">
          <h1>Integrar en mi web</h1>
          <p>Copiá este código y pegalo en la página de tu sitio donde quieras mostrar los cursos:</p>
          <textarea
            readOnly
            value={snippet}
            rows={3}
            className="input"
            style={{ fontFamily: 'monospace', resize: 'vertical' }}
          />
          <button
            className="btn btn-primary"
            style={{ marginTop: 12 }}
            onClick={() => {
              navigator.clipboard.writeText(snippet);
              setCopied(true);
            }}
          >
            {copied ? 'Copiado' : 'Copiar código'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0

Run: `npm test`
Expected: 27/27 passing

Run: `npm run dev`, sign in, visit `/cuenta`, `/panel/inscribir`, `/panel/integrar`
Expected: light neutral background, header at top (from Task 2), bordered white card with offset shadow for the page content; every button/form still functions exactly as before (refresh claims, enroll a student, copy the embed snippet).

- [ ] **Step 5: Commit**

```bash
git add src/app/cuenta/page.tsx "src/app/panel/inscribir/page.tsx" "src/app/panel/integrar/page.tsx"
git commit -m "feat: restyle cuenta, panel/inscribir, and panel/integrar as app pages"
```

---

### Task 7: Lesson viewer

**Files:**
- Modify: `src/app/[tenant]/cursos/[courseId]/page.tsx`

**Interfaces:**
- Consumes: `.page-app`, `.card`, `.lesson-layout`, `.lesson-sidebar-list`, `.alert`, `.alert-error`, `.btn`, `.btn-primary` (Task 1)
- Produces: nothing new — leaf page.

- [ ] **Step 1: Replace `src/app/[tenant]/cursos/[courseId]/page.tsx`**

```tsx
// src/app/[tenant]/cursos/[courseId]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase/client';
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isEnrolled, setIsEnrolled] = useState(false);

  useEffect(() => {
    if (authLoading || !user || claims?.role !== 'student' || claims.tenantId !== params.tenant) {
      return;
    }

    async function loadCourseContent() {
      try {
        const db = getFirebaseFirestore();

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
          setIsEnrolled(true);
        }
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'No se pudo cargar el curso');
      } finally {
        setDataLoading(false);
      }
    }

    loadCourseContent();
  }, [authLoading, user, claims, params.tenant, params.courseId]);

  async function markComplete(lessonId: string) {
    if (!user || !isEnrolled) return;
    const db = getFirebaseFirestore();
    const updated = addCompletedLesson(lessonsCompleted, lessonId);
    setActionError(null);
    try {
      await updateDoc(
        doc(db, `tenants/${params.tenant}/students/${user.uid}/progress/${params.courseId}`),
        { lessonsCompleted: updated },
      );
      setLessonsCompleted(updated);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'No se pudo marcar la lección como completada',
      );
    }
  }

  if (authLoading) {
    return (
      <div className="page-app">
        <div className="page-app-content">
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page-app">
        <div className="page-app-content">
          <div className="card">
            <p>Tenés que iniciar sesión para ver este curso.</p>
            <a href="/login" className="btn btn-primary" style={{ marginTop: 12 }}>
              Iniciar sesión
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (claims?.role !== 'student' || claims.tenantId !== params.tenant) {
    return (
      <div className="page-app">
        <div className="page-app-content">
          <div className="card">
            <p>No tenés acceso a este curso.</p>
          </div>
        </div>
      </div>
    );
  }

  if (dataLoading) {
    return (
      <div className="page-app">
        <div className="page-app-content">
          <p>Cargando contenido del curso...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="page-app">
        <div className="page-app-content">
          <div className="card">
            <p className="alert alert-error" role="alert">
              Error al cargar el curso: {loadError}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const selectedLesson = lessons.find((l) => l.id === selectedLessonId) ?? null;

  return (
    <div className="page-app">
      <div className="lesson-layout">
        <aside className="card">
          <ul className="lesson-sidebar-list">
            {lessons.map((lesson) => (
              <li key={lesson.id}>
                <button
                  className={lesson.id === selectedLessonId ? 'active' : ''}
                  onClick={() => setSelectedLessonId(lesson.id)}
                >
                  {lessonsCompleted.includes(lesson.id) ? '✓ ' : ''}
                  {lesson.title}
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <section className="card">
          {selectedLesson && (
            <>
              <h1>{selectedLesson.title}</h1>
              {selectedLesson.videoUrl && (
                <video src={selectedLesson.videoUrl} controls style={{ width: '100%' }} />
              )}
              {selectedLesson.textContent && <p>{selectedLesson.textContent}</p>}
              {isEnrolled ? (
                <>
                  <button className="btn btn-primary" onClick={() => markComplete(selectedLesson.id)}>
                    Marcar como completada
                  </button>
                  {actionError && (
                    <p className="alert alert-error" role="alert">
                      {actionError}
                    </p>
                  )}
                </>
              ) : (
                <p>No estás inscripto en este curso.</p>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0

Run: `npm test`
Expected: 27/27 passing

Run: `npm run dev`, sign in as a student enrolled in a course with at least one lesson, visit `/{tenant}/cursos/{courseId}`
Expected: two-column layout (lesson list sidebar on the left in a bordered card, lesson content on the right in a bordered card), clicking a lesson highlights it in blue, "Marcar como completada" still updates the checkmark; narrow the browser window and confirm the layout collapses to a single column below ~720px.

- [ ] **Step 3: Run the full verification suite one more time to confirm no regressions across the whole plan**

Run: `npm test`
Expected: 27/27 passing

Run: `npx tsc --noEmit`
Expected: exit 0

Run: `npm run build`
Expected: succeeds (same check already required before every App Hosting deploy in this project)

- [ ] **Step 4: Commit**

```bash
git add "src/app/[tenant]/cursos/[courseId]/page.tsx"
git commit -m "feat: restyle lesson viewer with two-column neubrutalist layout"
```

---

## Self-Review Notes

- **Spec coverage:** design tokens (Task 1), shared header incl. the embed-page exclusion (Task 2), hero pages — root/login/registro (Task 3), public catalog hero treatment (Task 4), embed catalog compact treatment (Task 5), app pages — cuenta/panel/inscribir/panel/integrar (Task 6), lesson viewer two-column app treatment (Task 7). All 10 files listed in the spec's Scope section are covered; no extra files touched.
- **Placeholder scan:** no TBD/TODO; every step has complete, exact code.
- **Type consistency:** every page continues to consume the same hooks/functions with the same signatures as before this plan (`useAuth()`, `getFirebaseAuth()`, `getFirebaseFirestore()`, `getFirebaseFunctions()`, `resolveLandingRoute()`, `addCompletedLesson()`, `buildEmbedSnippet()`, `courseConverter`) — this plan only changes JSX/className, confirmed by diffing each task's replacement against the file content read at plan-writing time. The one intentional behavior change (removing the duplicate sign-out buttons from `cuenta/page.tsx` now that `Header` provides one) is called out explicitly in Task 6 so a reviewer doesn't mistake it for an accidental omission.
