# Frontend Visual Design — Phase A (restyle existing pages)

Date: 2026-08-14

## Context

Every page built so far (registration, login, account status, the enrollment panel, the public
catalog, the embed catalog, the lesson viewer) renders as unstyled HTML — plain `<form>`s and
`<button>`s with no visual identity. This phase gives the product a real look before building any
new screens. A second phase (course/module/lesson CRUD for owners) is planned to follow, reusing
whatever design system comes out of this phase.

## Visual direction

**Neubrutalist**, chosen via the visual brainstorming companion from three 2026-trend directions
(editorial warm, AI-native gradient/glass, neubrutalist) and four accent-color variants (electric
blue, coral, mint, pink) — bold, high-contrast, thick borders, offset drop shadows, no soft
gradients or blur effects.

**Tokens:**
- Accent: electric blue `#4361ff`
- Ink: `#111111` (borders, headings, body text)
- Surface: `#ffffff` (cards)
- App background: a light neutral (`#f5f5f0`) — distinct from the accent so content-heavy app
  pages don't fight the accent color for attention
- Border: `2px solid var(--ink)` on inputs/buttons, `3px solid var(--ink)` on cards
- Shadow: `7px 7px 0 var(--ink)` (hard offset, no blur) on cards and primary buttons
- Typography: system font stack (`system-ui, sans-serif`), no new webfont/dependency. Headings are
  bold (weight 800) and uppercase with tight letter-spacing; body text is regular weight.
- Border radius: small (8-10px) — brutalist enough to keep the hard-edged feel, not fully sharp
  corners (avoids looking unfinished)

**Two page treatments:**
1. **Hero pages** (public, unauthenticated): full-bleed electric blue background, single white
   bordered card centered on the page. Used for the root landing page, `/login`, `/registro`, and
   the public catalog (`/{tenant}`).
2. **App pages** (authenticated): light neutral background, the shared header at top, content in
   one or more bordered white cards below. Used for `/cuenta`, `/panel/inscribir`,
   `/panel/integrar`, and the lesson viewer (`/{tenant}/cursos/{courseId}`).

The embed catalog (`/embed/{tenantId}`) gets neither treatment as-is — it renders inside a
third-party site's iframe, so it keeps a compact, minimal card-list style with no header and no
full-bleed background (it must not impose the LMS's branding on the host page beyond the course
list itself).

## Shared header

A new `Header` component, rendered once in the root layout, visible only when a user is signed in
(checked via `useAuth()` — renders nothing when `user` is `null`). Shows: the product name/logo on
the left; the signed-in user's email and role badge, plus a "Cerrar sesión" button, on the right.
Appears on every app page; does not appear on hero pages (login/registro render before a session
exists, so `useAuth()` naturally returns no user there — no route-based special-casing needed).

## Implementation approach

Plain CSS with custom properties (design tokens) and a small set of reusable global classes —
`.card`, `.btn` (+ `.btn-primary`/`.btn-secondary`), `.input`, `.badge`, `.page-hero`, `.page-app`.
Written once to `src/app/globals.css`, imported in `src/app/layout.tsx`. No new npm dependency (no
Tailwind, no CSS-in-JS library, no webfont) — consistent with this codebase's existing pattern of
avoiding dependencies unless a task genuinely needs one.

Rejected alternatives: Tailwind CSS (adds a build-time dependency and config for a ~10-page app
where a handful of reusable classes cover the need just as well); CSS-in-JS (runtime overhead, no
benefit here since there's no dynamic per-instance theming).

## Scope

**In scope — restyle only, no logic changes:**
- `src/app/globals.css` (new): design tokens + component classes
- `src/components/Header.tsx` (new): shared header component
- `src/app/layout.tsx`: import globals.css, render `<Header />`
- `src/app/page.tsx` (root landing): hero treatment
- `src/app/registro/page.tsx`: hero treatment
- `src/app/login/page.tsx`: hero treatment
- `src/app/[tenant]/page.tsx` (public catalog): hero treatment, course list as cards
- `src/app/cuenta/page.tsx`: app treatment
- `src/app/panel/inscribir/page.tsx`: app treatment
- `src/app/panel/integrar/page.tsx`: app treatment
- `src/app/embed/[tenantId]/page.tsx`: compact treatment (no header, no hero background)
- `src/app/[tenant]/cursos/[courseId]/page.tsx` (lesson viewer): app treatment, two-column layout
  (lesson list sidebar + content area) using the new card/border language

**Explicitly out of scope for this phase:**
- No new pages or features (course CRUD is Phase B, planned separately)
- No dark mode / theme toggle
- No new npm dependencies
- No changes to business logic, data fetching, or Firebase calls in any of the touched files —
  this phase only changes JSX structure/className usage and adds the two new files listed above

## Testing approach

Purely visual change with no new logic — no unit tests apply (consistent with this project's
existing precedent that page components are verified manually via the dev server, not
unit-tested). Verification is: run the dev server, visually check each of the 10 touched routes,
confirm `npm test`/`npx tsc --noEmit` still pass (they shouldn't be affected, but confirms no
accidental logic breakage), and confirm the deployed production build still works after merging
(same `npm run build` check already used before every App Hosting deploy in this project).
