# Course/Module/Lesson CRUD + Quiz Authoring (Phase B) — Design

Date: 2026-08-15

## Context

The MVP vertical slice built the data model, tenant isolation, and certificate pipeline. The
enrollment/lesson-viewer phase let students consume courses and mark lessons complete. The visual
design phase gave the app a real identity. But there is still no way for an owner/instructor to
actually author course content — every course, module, and lesson in this project so far has been
created by hand in the Firestore console. This phase closes that gap: full CRUD for
courses/modules/lessons (create, edit, delete, reorder) plus authoring quiz questions per lesson.

Explicitly out of scope, carried forward as a separate future phase: the student-facing "take the
quiz" screen. `src/lib/quiz/scoreQuiz.ts` already exists and is unit-tested, but nothing calls it
yet — that's Phase C, a student-experience feature, not an authoring one.

## Architecture

All CRUD operations write directly to Firestore from the client. The existing security rules
(`firestore.rules`, from the MVP phase) already grant `owner`/`instructor` write access to
`tenants/{tenantId}/courses/**` — no new Cloud Function is needed for any create/edit/delete/reorder
operation in this phase. This mirrors how the panel's existing "Inscribir alumno" screen is the only
place in the app that needs a Cloud Function (because it must resolve a student's UID from an email,
which requires the Admin SDK) — course content authoring has no such requirement.

Every write path reuses `Course`/`Module`/`Lesson`/`Quiz`/`QuizQuestion` from
`src/lib/models/types.ts` and the existing `courseConverter` from
`src/lib/models/courseConverters.ts`. No new Firestore converters are added for modules/lessons —
this phase's pages read/write those documents with plain typed objects, consistent with how the
existing lesson viewer already reads modules/lessons without a converter.

## Navigation

Three new routes under `/panel`, all requiring `role: owner` or `role: instructor` (checked the same
way `/panel/inscribir` already is — no new auth pattern):

- **`/panel/cursos`** — list of the tenant's courses, with a "Crear curso" button.
- **`/panel/cursos/{courseId}`** — course editor: title, description, published toggle, and the
  module/lesson outline (create/rename/delete/reorder modules; create/rename/delete/reorder lessons
  within a module).
- **`/panel/cursos/{courseId}/lecciones/{lessonId}`** — lesson content editor: title, text content,
  video URL, and the quiz question editor.

`src/components/Header.tsx` gets one new link, "Mis cursos" → `/panel/cursos`, shown only when
`claims?.role === 'owner' || claims?.role === 'instructor'` (mirrors the existing conditional
rendering pattern already used for the sign-out button).

## Reordering

New dependency: **`@dnd-kit/core` + `@dnd-kit/sortable`** — the first new npm package added to this
project since its inception. Chosen because it's the standard, actively-maintained, accessible
drag-and-drop library for React; hand-rolling drag-and-drop accessibly (keyboard support, screen
reader announcements) is significant, well-trodden work not worth re-doing.

The drag-and-drop *interaction* (pointer/keyboard sensors, visual drag feedback) lives entirely in
dnd-kit's components. The *decision* of what the new order should be after a drop is a pure
function, unit-tested the same way `addCompletedLesson` was in the prior phase:

```typescript
function reorderItems<T>(items: T[], fromIndex: number, toIndex: number): T[]
```

After a drop, the page calls `reorderItems`, then writes the new `order` value (0-based index) for
every item in the reordered list to Firestore in a single batch (`writeBatch`), so a reorder is one
atomic write, not N separate ones racing each other.

## Quiz authoring

Each lesson may have zero or one quiz (the data model's `Quiz` already models a single
`questions: QuizQuestion[]` array per quiz document, and the certificate/completion logic already
assumes at most one quiz per lesson via `course.requiredQuizzes`/`quizScores` keyed by quiz ID — this
phase doesn't change that assumption). On the lesson editor page: if no quiz document exists yet,
show "Agregar quiz"; once created, show an editable list of questions — text, 2+ options, which
option is correct — with add/remove per question.

Validation (a question needs at least 2 non-empty options and exactly one marked correct) is a pure
function:

```typescript
function validateQuizQuestion(question: QuizQuestion): { valid: boolean; error?: string }
```

tested the same way as the rest of this project's pure logic, independent of any Firestore or UI
code.

## Firestore write helpers

Following the `assignEnrollment` precedent (a pure function with injected dependencies, wrapped by a
thin caller that supplies the real Firestore calls), the create/update/delete/reorder operations for
courses, modules, and lessons are each a small pure function taking a `deps` object
(`{ createDoc, updateDoc, deleteDoc, batchWrite }`-shaped, mocked in tests) so the "what Firestore
calls happen, in what order, with what data" logic is unit-testable without a live Firestore
instance or emulator — consistent with how this project has tested every other piece of
Firestore-adjacent logic so far.

## Testing approach

TDD for all pure logic: `reorderItems`, `validateQuizQuestion`, and the injected-dependency
Firestore write helpers for course/module/lesson create/update/delete. Page components (JSX, the
dnd-kit drag interaction itself, the actual rendered course outline) are verified manually against
the dev server, same precedent as every prior phase's page components — visual/interactive
correctness isn't unit-testable without a much heavier testing setup (e.g. Playwright), which is
explicitly out of scope for this phase.

## Explicitly out of scope

- The student-facing "take the quiz" screen (Phase C, separate).
- Video file upload to Storage (owner pastes a URL — YouTube, Vimeo, or a direct link; no upload
  flow, no Storage write path added).
- Tenant/owner account creation (still manual via console, per the MVP phase's known limitations).
- Course duplication/templates, bulk import, or any authoring convenience beyond straightforward
  create/edit/delete/reorder.
