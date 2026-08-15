# Known Limitations — Frontend Visual Design (Phase A)

Recorded at the end of this phase (2026-08-14), same practice as prior phases. Two rounds of
whole-branch review found and fixed several real defects (missing `<main>` landmarks, form
controls not inheriting the design system's font, `.btn-primary` failing WCAG AA contrast, the
embed catalog bleeding the app's background into a host page's iframe, a header/scrollbar stacking
bug that the first fix round only partially addressed). These are the items left open on purpose.

## Sidebar lesson selection is signaled by color alone

`.lesson-sidebar-list button.active` (`src/app/globals.css`) only swaps `background`/`color` to
indicate which lesson is currently open — no `aria-current`, no icon, no border. A user with a
blue-related color vision deficiency has no non-color cue for the selected lesson (the ✓ prefix
marks *completed*, not *selected*). Fix: add `aria-current="true"` and a visual affordance that
doesn't depend on hue (e.g. `font-weight` change or a left border) when the fast-follow quiz/CRUD
work next touches this file.

## Header doesn't account for the auth `loading` state

`Header.tsx` destructures only `{ user, claims, signOut }` from `useAuth()`, ignoring `loading`.
The header is absent while `onIdTokenChanged` resolves, then pops in and pushes page content down —
a visible layout shift on every navigation for signed-in users. Fix: reserve header height (or
render a skeleton) while `loading` is true.

## Inconsistent content max-width between app pages

`.page-app-content` is `720px`; `.lesson-layout` is `960px`. Both are "app" treatment, so the
container visibly changes width moving from `/cuenta` to a lesson. Not broken, just not a
deliberate token — worth reconciling into a single app-content-width variable in a later pass.

## `Header`'s logo link is a raw `<a>`, not `next/link`

Matches the rest of this codebase (every inter-page link is a plain anchor, forcing a full page
reload), so this isn't a regression — just noting that `Header` is the single most-clicked link in
the app and would benefit most from client-side navigation if/when the codebase adopts `next/link`
more broadly.

## Empty-state ordering in the public catalog

`src/app/[tenant]/page.tsx` renders an empty `<ul className="course-list">` unconditionally, with
"Todavía no hay cursos publicados." appearing after it in the DOM — a screen reader announces a
zero-item list before the explanatory text. Matches the plan's own specified code; cosmetic, not
fixed in this pass.

## `.user-email` truncation is viewport-relative, not container-relative

`max-width: 40vw` on the truncated email span means it doesn't use extra space that becomes
available once `.app-header` wraps to two lines on narrow screens. `max-width: min(40vw, 100%)` or
a flex `min-width: 0` approach would use the space better. Purely cosmetic.

## Carried forward from prior phases, unaffected by this one

Everything in the prior phases' known-limitations docs (enrollment/quiz write paths, subdomain
routing, admin-SDK migration for server-rendered pages, cast-based Firestore reads with no runtime
validation, no live emulator client wiring at the time those docs were written — since resolved —
etc.) is unchanged by this purely visual phase.
