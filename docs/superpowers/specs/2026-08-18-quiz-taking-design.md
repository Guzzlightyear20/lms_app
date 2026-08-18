# Quiz Taking (Phase C) — Design

Date: 2026-08-18

## Context

The Course CRUD phase (Phase B) let owners/instructors author quiz questions per lesson, but
nothing lets a student actually take one. `src/lib/quiz/scoreQuiz.ts` has existed since the MVP
phase and is unit-tested, but nothing calls it in production. This phase closes that gap: a
student-facing quiz form in the lesson viewer, wired to write a score into the student's progress
document.

This phase does not touch course/module/lesson authoring (Phase B) or quiz *authoring* (also Phase
B) — only quiz *taking*.

## Architecture

The student lesson viewer (`src/app/[tenant]/cursos/[courseId]/page.tsx`) already loads all lessons
for a course up front. This phase extends that same load to also fetch each lesson's quiz (zero or
one per lesson, per the existing data model), keyed by lesson ID.

When the selected lesson has a quiz, a form renders below the lesson's video/text content: each
question as radio-button options, and a "Enviar" button. On submit, the pure `scoreQuiz(quiz,
answers)` function (already implemented and tested) computes a 0-100 score, which is written to
`progress.quizScores[quiz.id]` via `updateDoc` with the existing `progress` document (merge — only
the `quizScores` map field changes, `lessonsCompleted` is untouched).

No new Cloud Function. `onProgressUpdated` already triggers on *any* write to
`tenants/{tenantId}/students/{studentId}/progress/{courseId}` — writing `quizScores` naturally
re-runs `isCourseComplete` and issues a certificate if the course is now complete, with zero changes
to that function.

## Security rule change

`firestore.rules`, the student's self-update rule on their own progress doc, currently reads:

```
allow update: if request.auth != null && tenantId() == tenantId &&
  request.auth.uid == studentId &&
  request.resource.data.diff(resource.data).affectedKeys().hasOnly(['lessonsCompleted']);
```

This blocks a student from writing `quizScores` themselves. It changes to:

```
allow update: if request.auth != null && tenantId() == tenantId &&
  request.auth.uid == studentId &&
  request.resource.data.diff(resource.data).affectedKeys().hasOnly(['lessonsCompleted', 'quizScores']);
```

This is the only rules change in this phase. Read access to the `quizzes` subcollection already
allows any authenticated same-tenant user (rules unchanged from Phase B), so no read-side rule
change is needed.

## UI behavior

- A lesson's quiz section only renders if a quiz document exists for the selected lesson.
- Each question shows its text and options as a radio group (`name` scoped per question index so
  multiple questions don't cross-select). The submit button is disabled until every question has a
  selected option (reuses the same all-answered validation the pure functions already expect —
  `scoreQuiz` throws if `answers.length !== quiz.questions.length`, so the UI must not allow a
  partial submit).
- After submitting, the score is shown inline ("Obtuviste X%. Mínimo requerido: Y%.") with a
  pass/fail indicator based on `course.minQuizScore`, alongside a "Volver a intentar" button that
  resets the form's selected answers (but keeps showing the last submitted score until the next
  submit).
- If `progress.quizScores[quiz.id]` already has a value when the lesson loads (e.g., the student
  revisits the lesson after already taking the quiz), show that stored score immediately instead of
  a blank form, with a "Volver a intentar" button to re-open the form.
- Retakes are allowed without limit; each submission overwrites the previous score for that quiz
  (per explicit decision — no "attempts remaining" tracking).

## Explicitly out of scope

- Fixing the pre-existing `isCourseComplete` gap where a course can be marked complete from
  `quizScores` alone without confirming every quiz in the course was attempted (a course with two
  quizzes where the student takes and passes only one could still complete). This becomes reachable
  for the first time in this phase since nothing wrote `quizScores` before, but it is not part of
  this phase's contract — documented as a known limitation for a future phase.
- Any UI for setting `course.requiredQuizzes` / `course.minQuizScore` (still Firestore-console-only,
  a known limitation carried since Phase B).
- Time limits, question randomization, partial credit, or any quiz-taking feature beyond
  single-attempt-at-a-time scoring with unlimited retakes.
