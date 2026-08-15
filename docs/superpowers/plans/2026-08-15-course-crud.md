# Course/Module/Lesson CRUD + Quiz Authoring (Phase B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an owner/instructor create, edit, delete, and reorder courses/modules/lessons, and author quiz questions per lesson — closing the gap where all course content until now had to be hand-entered in the Firestore console.

**Architecture:** All writes go directly from the client to Firestore, reusing the existing security rules that already grant owner/instructor write access to `tenants/{tenantId}/courses/**` — no new Cloud Function. Every create/update/delete/reorder operation is a small pure function taking an injected `deps` object (same pattern as `assignEnrollment` from the enrollment phase), wrapped by a thin page component that supplies the real Firestore calls. Reordering uses `@dnd-kit` for the drag interaction and a pure `reorderItems` function for the array-index math.

**Tech Stack:** Next.js (existing) + Firestore (existing) + `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (new — first added dependency in this project).

## Global Constraints

- No new Cloud Functions — every operation in this plan writes to Firestore directly from the client, relying on the existing security rules.
- Reuse `Course`, `Module`, `Lesson`, `Quiz`, `QuizQuestion` from `src/lib/models/types.ts` verbatim — no new types duplicating these shapes.
- Video is a pasted URL (`videoUrl: string`) — no file upload flow, no Storage write path added.
- TDD for all pure logic (`reorderItems`, `validateQuizQuestion`, and the four operations files). Page components (JSX, the dnd-kit drag interaction) are verified manually against the dev server only — no unit tests for them, consistent with every prior phase's page components in this project.
- TypeScript strict mode stays on.

---

## File Structure

```
src/
  lib/
    courses/
      reorderItems.ts              # pure: generic array reorder
      reorderItems.test.ts
      courseOperations.ts          # pure: create/update/delete course (injected deps)
      courseOperations.test.ts
      moduleOperations.ts          # pure: create/update/delete/reorder module (injected deps)
      moduleOperations.test.ts
      lessonOperations.ts          # pure: create/update/delete/reorder lesson (injected deps)
      lessonOperations.test.ts
    quiz/
      validateQuizQuestion.ts      # pure: quiz question validation
      validateQuizQuestion.test.ts
      quizOperations.ts            # pure: create quiz / add / update / delete question (injected deps)
      quizOperations.test.ts
  components/
    Header.tsx                     # MODIFY: add "Mis cursos" link for owner/instructor
  app/
    panel/
      cursos/
        page.tsx                   # course list + create form
        [courseId]/
          page.tsx                 # course meta editor + module/lesson outline with drag reorder
          lecciones/
            [lessonId]/
              page.tsx              # lesson content editor + quiz question editor
```

Rationale: same split as every prior phase — pure decision/write logic is unit-tested without a
browser or emulator; page components are thin I/O shells verified manually via the dev server.

---

### Task 1: `reorderItems` pure function

**Files:**
- Create: `src/lib/courses/reorderItems.ts`
- Test: `src/lib/courses/reorderItems.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `reorderItems<T>(items: T[], fromIndex: number, toIndex: number): T[]`. Used by Task 4
  (`moduleOperations.reorderModules`) and Task 5 (`lessonOperations.reorderLessons`).

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/courses/reorderItems.test.ts
import { describe, it, expect } from 'vitest';
import { reorderItems } from './reorderItems';

describe('reorderItems', () => {
  it('moves an item from an earlier index to a later index', () => {
    expect(reorderItems(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves an item from a later index to an earlier index', () => {
    expect(reorderItems(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('is a no-op when fromIndex equals toIndex', () => {
    expect(reorderItems(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the input array', () => {
    const original = ['a', 'b', 'c'];
    reorderItems(original, 0, 2);
    expect(original).toEqual(['a', 'b', 'c']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- reorderItems`
Expected: FAIL with "Cannot find module './reorderItems'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/courses/reorderItems.ts
export function reorderItems<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const result = [...items];
  const [moved] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, moved);
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- reorderItems`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/courses/reorderItems.ts src/lib/courses/reorderItems.test.ts
git commit -m "feat: add reorderItems pure array-reorder function"
```

---

### Task 2: `validateQuizQuestion` pure function

**Files:**
- Create: `src/lib/quiz/validateQuizQuestion.ts`
- Test: `src/lib/quiz/validateQuizQuestion.test.ts`

**Interfaces:**
- Consumes: `QuizQuestion` from `src/lib/models/types.ts`
- Produces: `validateQuizQuestion(question: QuizQuestion): { valid: boolean; error?: string }`. Used
  by Task 6 (`quizOperations.addQuestion`/`updateQuestion`).

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/quiz/validateQuizQuestion.test.ts
import { describe, it, expect } from 'vitest';
import { validateQuizQuestion } from './validateQuizQuestion';
import type { QuizQuestion } from '../models/types';

describe('validateQuizQuestion', () => {
  it('accepts a well-formed question', () => {
    const question: QuizQuestion = {
      text: '¿Cuál es la capital de Francia?',
      options: ['Madrid', 'París'],
      correctOptionIndex: 1,
    };
    expect(validateQuizQuestion(question)).toEqual({ valid: true });
  });

  it('rejects an empty question text', () => {
    const question: QuizQuestion = { text: '  ', options: ['a', 'b'], correctOptionIndex: 0 };
    expect(validateQuizQuestion(question).valid).toBe(false);
  });

  it('rejects fewer than 2 non-empty options', () => {
    const question: QuizQuestion = { text: 'Pregunta', options: ['a', '  '], correctOptionIndex: 0 };
    expect(validateQuizQuestion(question).valid).toBe(false);
  });

  it('rejects an out-of-range correctOptionIndex', () => {
    const question: QuizQuestion = { text: 'Pregunta', options: ['a', 'b'], correctOptionIndex: 5 };
    expect(validateQuizQuestion(question).valid).toBe(false);
  });

  it('rejects a correctOptionIndex pointing at an empty option', () => {
    const question: QuizQuestion = { text: 'Pregunta', options: ['a', '  '], correctOptionIndex: 1 };
    expect(validateQuizQuestion(question).valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- validateQuizQuestion`
Expected: FAIL with "Cannot find module './validateQuizQuestion'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/quiz/validateQuizQuestion.ts
import type { QuizQuestion } from '../models/types';

export function validateQuizQuestion(question: QuizQuestion): { valid: boolean; error?: string } {
  if (question.text.trim() === '') {
    return { valid: false, error: 'La pregunta necesita un enunciado' };
  }

  const nonEmptyOptions = question.options.filter((opt) => opt.trim() !== '');
  if (nonEmptyOptions.length < 2) {
    return { valid: false, error: 'La pregunta necesita al menos 2 opciones' };
  }

  const correctOption = question.options[question.correctOptionIndex];
  if (
    question.correctOptionIndex < 0 ||
    question.correctOptionIndex >= question.options.length ||
    !correctOption ||
    correctOption.trim() === ''
  ) {
    return { valid: false, error: 'Marcá cuál opción es la correcta' };
  }

  return { valid: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- validateQuizQuestion`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/quiz/validateQuizQuestion.ts src/lib/quiz/validateQuizQuestion.test.ts
git commit -m "feat: add validateQuizQuestion pure validation function"
```

---

### Task 3: `courseOperations` pure functions

**Files:**
- Create: `src/lib/courses/courseOperations.ts`
- Test: `src/lib/courses/courseOperations.test.ts`

**Interfaces:**
- Consumes: `Course` from `src/lib/models/types.ts`
- Produces:
  ```typescript
  interface CourseDeps {
    createCourseDoc: (tenantId: string, course: Omit<Course, 'id'>) => Promise<string>;
    updateCourseDoc: (tenantId: string, courseId: string, updates: Partial<Omit<Course, 'id'>>) => Promise<void>;
    deleteCourseDoc: (tenantId: string, courseId: string) => Promise<void>;
  }
  createCourse(deps: CourseDeps, tenantId: string, input: { title: string; description: string }): Promise<{ id: string }>
  updateCourse(deps: CourseDeps, tenantId: string, courseId: string, updates: Partial<Pick<Course, 'title' | 'description' | 'published' | 'requiredQuizzes' | 'minQuizScore'>>): Promise<void>
  deleteCourse(deps: CourseDeps, tenantId: string, courseId: string): Promise<void>
  ```
  Used by Task 8 (course list page, `createCourse`) and Task 9 (course editor page, `updateCourse`).

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/courses/courseOperations.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createCourse, updateCourse, deleteCourse, type CourseDeps } from './courseOperations';

function makeDeps(overrides: Partial<CourseDeps> = {}): CourseDeps {
  return {
    createCourseDoc: vi.fn().mockResolvedValue('course-1'),
    updateCourseDoc: vi.fn().mockResolvedValue(undefined),
    deleteCourseDoc: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('createCourse', () => {
  it('rejects an empty title without calling createCourseDoc', async () => {
    const deps = makeDeps();
    await expect(createCourse(deps, 'tenant-a', { title: '  ', description: '' })).rejects.toThrow(
      'El curso necesita un título',
    );
    expect(deps.createCourseDoc).not.toHaveBeenCalled();
  });

  it('creates a course with trimmed title and sensible defaults', async () => {
    const deps = makeDeps();
    const result = await createCourse(deps, 'tenant-a', {
      title: '  Ecommerce 101  ',
      description: 'Intro',
    });
    expect(deps.createCourseDoc).toHaveBeenCalledWith('tenant-a', {
      title: 'Ecommerce 101',
      description: 'Intro',
      published: false,
      requiredQuizzes: false,
      minQuizScore: 60,
    });
    expect(result).toEqual({ id: 'course-1' });
  });
});

describe('updateCourse', () => {
  it('passes updates through to updateCourseDoc', async () => {
    const deps = makeDeps();
    await updateCourse(deps, 'tenant-a', 'course-1', { published: true });
    expect(deps.updateCourseDoc).toHaveBeenCalledWith('tenant-a', 'course-1', { published: true });
  });
});

describe('deleteCourse', () => {
  it('passes through to deleteCourseDoc', async () => {
    const deps = makeDeps();
    await deleteCourse(deps, 'tenant-a', 'course-1');
    expect(deps.deleteCourseDoc).toHaveBeenCalledWith('tenant-a', 'course-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- courseOperations`
Expected: FAIL with "Cannot find module './courseOperations'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/courses/courseOperations.ts
import type { Course } from '../models/types';

export interface CourseDeps {
  createCourseDoc: (tenantId: string, course: Omit<Course, 'id'>) => Promise<string>;
  updateCourseDoc: (
    tenantId: string,
    courseId: string,
    updates: Partial<Omit<Course, 'id'>>,
  ) => Promise<void>;
  deleteCourseDoc: (tenantId: string, courseId: string) => Promise<void>;
}

export async function createCourse(
  deps: CourseDeps,
  tenantId: string,
  input: { title: string; description: string },
): Promise<{ id: string }> {
  const title = input.title.trim();
  if (!title) {
    throw new Error('El curso necesita un título');
  }
  const id = await deps.createCourseDoc(tenantId, {
    title,
    description: input.description.trim(),
    published: false,
    requiredQuizzes: false,
    minQuizScore: 60,
  });
  return { id };
}

export async function updateCourse(
  deps: CourseDeps,
  tenantId: string,
  courseId: string,
  updates: Partial<Pick<Course, 'title' | 'description' | 'published' | 'requiredQuizzes' | 'minQuizScore'>>,
): Promise<void> {
  await deps.updateCourseDoc(tenantId, courseId, updates);
}

export async function deleteCourse(
  deps: CourseDeps,
  tenantId: string,
  courseId: string,
): Promise<void> {
  await deps.deleteCourseDoc(tenantId, courseId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- courseOperations`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/courses/courseOperations.ts src/lib/courses/courseOperations.test.ts
git commit -m "feat: add courseOperations pure create/update/delete functions"
```

---

### Task 4: `moduleOperations` pure functions

**Files:**
- Create: `src/lib/courses/moduleOperations.ts`
- Test: `src/lib/courses/moduleOperations.test.ts`

**Interfaces:**
- Consumes: `reorderItems` (Task 1), `Module` from `src/lib/models/types.ts`
- Produces:
  ```typescript
  interface ModuleDeps {
    createModuleDoc: (tenantId: string, courseId: string, module: Omit<Module, 'id'>) => Promise<string>;
    updateModuleDoc: (tenantId: string, courseId: string, moduleId: string, updates: Partial<Omit<Module, 'id'>>) => Promise<void>;
    deleteModuleDoc: (tenantId: string, courseId: string, moduleId: string) => Promise<void>;
    writeModuleOrder: (tenantId: string, courseId: string, orderedIds: string[]) => Promise<void>;
  }
  createModule(deps, tenantId, courseId, input: { title: string; order: number }): Promise<{ id: string }>
  updateModule(deps, tenantId, courseId, moduleId, updates: Partial<Pick<Module, 'title'>>): Promise<void>
  deleteModule(deps, tenantId, courseId, moduleId): Promise<void>
  reorderModules(deps, tenantId, courseId, modules: Module[], fromIndex: number, toIndex: number): Promise<Module[]>
  ```
  Used by Task 9 (course editor page).

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/courses/moduleOperations.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  createModule,
  updateModule,
  deleteModule,
  reorderModules,
  type ModuleDeps,
} from './moduleOperations';
import type { Module } from '../models/types';

function makeDeps(overrides: Partial<ModuleDeps> = {}): ModuleDeps {
  return {
    createModuleDoc: vi.fn().mockResolvedValue('module-1'),
    updateModuleDoc: vi.fn().mockResolvedValue(undefined),
    deleteModuleDoc: vi.fn().mockResolvedValue(undefined),
    writeModuleOrder: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('createModule', () => {
  it('rejects an empty title', async () => {
    const deps = makeDeps();
    await expect(createModule(deps, 'tenant-a', 'course-1', { title: ' ', order: 0 })).rejects.toThrow(
      'El módulo necesita un título',
    );
    expect(deps.createModuleDoc).not.toHaveBeenCalled();
  });

  it('creates a module with trimmed title', async () => {
    const deps = makeDeps();
    const result = await createModule(deps, 'tenant-a', 'course-1', { title: ' Módulo 1 ', order: 2 });
    expect(deps.createModuleDoc).toHaveBeenCalledWith('tenant-a', 'course-1', {
      title: 'Módulo 1',
      order: 2,
    });
    expect(result).toEqual({ id: 'module-1' });
  });
});

describe('updateModule', () => {
  it('passes through to updateModuleDoc', async () => {
    const deps = makeDeps();
    await updateModule(deps, 'tenant-a', 'course-1', 'module-1', { title: 'Nuevo título' });
    expect(deps.updateModuleDoc).toHaveBeenCalledWith('tenant-a', 'course-1', 'module-1', {
      title: 'Nuevo título',
    });
  });
});

describe('deleteModule', () => {
  it('passes through to deleteModuleDoc', async () => {
    const deps = makeDeps();
    await deleteModule(deps, 'tenant-a', 'course-1', 'module-1');
    expect(deps.deleteModuleDoc).toHaveBeenCalledWith('tenant-a', 'course-1', 'module-1');
  });
});

describe('reorderModules', () => {
  const modules: Module[] = [
    { id: 'm1', title: 'Uno', order: 0 },
    { id: 'm2', title: 'Dos', order: 1 },
    { id: 'm3', title: 'Tres', order: 2 },
  ];

  it('reorders the array and writes the new id order', async () => {
    const deps = makeDeps();
    const result = await reorderModules(deps, 'tenant-a', 'course-1', modules, 0, 2);
    expect(result.map((m) => m.id)).toEqual(['m2', 'm3', 'm1']);
    expect(deps.writeModuleOrder).toHaveBeenCalledWith('tenant-a', 'course-1', ['m2', 'm3', 'm1']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- moduleOperations`
Expected: FAIL with "Cannot find module './moduleOperations'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/courses/moduleOperations.ts
import { reorderItems } from './reorderItems';
import type { Module } from '../models/types';

export interface ModuleDeps {
  createModuleDoc: (tenantId: string, courseId: string, module: Omit<Module, 'id'>) => Promise<string>;
  updateModuleDoc: (
    tenantId: string,
    courseId: string,
    moduleId: string,
    updates: Partial<Omit<Module, 'id'>>,
  ) => Promise<void>;
  deleteModuleDoc: (tenantId: string, courseId: string, moduleId: string) => Promise<void>;
  writeModuleOrder: (tenantId: string, courseId: string, orderedIds: string[]) => Promise<void>;
}

export async function createModule(
  deps: ModuleDeps,
  tenantId: string,
  courseId: string,
  input: { title: string; order: number },
): Promise<{ id: string }> {
  const title = input.title.trim();
  if (!title) {
    throw new Error('El módulo necesita un título');
  }
  const id = await deps.createModuleDoc(tenantId, courseId, { title, order: input.order });
  return { id };
}

export async function updateModule(
  deps: ModuleDeps,
  tenantId: string,
  courseId: string,
  moduleId: string,
  updates: Partial<Pick<Module, 'title'>>,
): Promise<void> {
  await deps.updateModuleDoc(tenantId, courseId, moduleId, updates);
}

export async function deleteModule(
  deps: ModuleDeps,
  tenantId: string,
  courseId: string,
  moduleId: string,
): Promise<void> {
  await deps.deleteModuleDoc(tenantId, courseId, moduleId);
}

export async function reorderModules(
  deps: ModuleDeps,
  tenantId: string,
  courseId: string,
  modules: Module[],
  fromIndex: number,
  toIndex: number,
): Promise<Module[]> {
  const reordered = reorderItems(modules, fromIndex, toIndex);
  await deps.writeModuleOrder(
    tenantId,
    courseId,
    reordered.map((m) => m.id),
  );
  return reordered;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- moduleOperations`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/courses/moduleOperations.ts src/lib/courses/moduleOperations.test.ts
git commit -m "feat: add moduleOperations pure create/update/delete/reorder functions"
```

---

### Task 5: `lessonOperations` pure functions

**Files:**
- Create: `src/lib/courses/lessonOperations.ts`
- Test: `src/lib/courses/lessonOperations.test.ts`

**Interfaces:**
- Consumes: `reorderItems` (Task 1), `Lesson` from `src/lib/models/types.ts`
- Produces:
  ```typescript
  interface LessonDeps {
    createLessonDoc: (tenantId: string, courseId: string, moduleId: string, lesson: Omit<Lesson, 'id'>) => Promise<string>;
    updateLessonDoc: (tenantId: string, courseId: string, moduleId: string, lessonId: string, updates: Partial<Omit<Lesson, 'id'>>) => Promise<void>;
    deleteLessonDoc: (tenantId: string, courseId: string, moduleId: string, lessonId: string) => Promise<void>;
    writeLessonOrder: (tenantId: string, courseId: string, moduleId: string, orderedIds: string[]) => Promise<void>;
  }
  createLesson(deps, tenantId, courseId, moduleId, input: { title: string; order: number }): Promise<{ id: string }>
  updateLesson(deps, tenantId, courseId, moduleId, lessonId, updates: Partial<Pick<Lesson, 'title' | 'videoUrl' | 'textContent'>>): Promise<void>
  deleteLesson(deps, tenantId, courseId, moduleId, lessonId): Promise<void>
  reorderLessons(deps, tenantId, courseId, moduleId, lessons: Lesson[], fromIndex: number, toIndex: number): Promise<Lesson[]>
  ```
  Used by Task 9 (course editor page, create/delete/reorder) and Task 10 (lesson editor page, update).

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/courses/lessonOperations.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  createLesson,
  updateLesson,
  deleteLesson,
  reorderLessons,
  type LessonDeps,
} from './lessonOperations';
import type { Lesson } from '../models/types';

function makeDeps(overrides: Partial<LessonDeps> = {}): LessonDeps {
  return {
    createLessonDoc: vi.fn().mockResolvedValue('lesson-1'),
    updateLessonDoc: vi.fn().mockResolvedValue(undefined),
    deleteLessonDoc: vi.fn().mockResolvedValue(undefined),
    writeLessonOrder: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('createLesson', () => {
  it('rejects an empty title', async () => {
    const deps = makeDeps();
    await expect(
      createLesson(deps, 'tenant-a', 'course-1', 'module-1', { title: '  ', order: 0 }),
    ).rejects.toThrow('La lección necesita un título');
    expect(deps.createLessonDoc).not.toHaveBeenCalled();
  });

  it('creates a lesson with trimmed title and empty content defaults', async () => {
    const deps = makeDeps();
    const result = await createLesson(deps, 'tenant-a', 'course-1', 'module-1', {
      title: ' Lección 1 ',
      order: 1,
    });
    expect(deps.createLessonDoc).toHaveBeenCalledWith('tenant-a', 'course-1', 'module-1', {
      title: 'Lección 1',
      order: 1,
      videoUrl: null,
      textContent: null,
      attachmentUrls: [],
    });
    expect(result).toEqual({ id: 'lesson-1' });
  });
});

describe('updateLesson', () => {
  it('passes through to updateLessonDoc', async () => {
    const deps = makeDeps();
    await updateLesson(deps, 'tenant-a', 'course-1', 'module-1', 'lesson-1', { textContent: 'Hola' });
    expect(deps.updateLessonDoc).toHaveBeenCalledWith('tenant-a', 'course-1', 'module-1', 'lesson-1', {
      textContent: 'Hola',
    });
  });
});

describe('deleteLesson', () => {
  it('passes through to deleteLessonDoc', async () => {
    const deps = makeDeps();
    await deleteLesson(deps, 'tenant-a', 'course-1', 'module-1', 'lesson-1');
    expect(deps.deleteLessonDoc).toHaveBeenCalledWith('tenant-a', 'course-1', 'module-1', 'lesson-1');
  });
});

describe('reorderLessons', () => {
  const lessons: Lesson[] = [
    { id: 'l1', title: 'Uno', order: 0, videoUrl: null, textContent: null, attachmentUrls: [] },
    { id: 'l2', title: 'Dos', order: 1, videoUrl: null, textContent: null, attachmentUrls: [] },
  ];

  it('reorders and writes the new id order', async () => {
    const deps = makeDeps();
    const result = await reorderLessons(deps, 'tenant-a', 'course-1', 'module-1', lessons, 0, 1);
    expect(result.map((l) => l.id)).toEqual(['l2', 'l1']);
    expect(deps.writeLessonOrder).toHaveBeenCalledWith('tenant-a', 'course-1', 'module-1', ['l2', 'l1']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lessonOperations`
Expected: FAIL with "Cannot find module './lessonOperations'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/courses/lessonOperations.ts
import { reorderItems } from './reorderItems';
import type { Lesson } from '../models/types';

export interface LessonDeps {
  createLessonDoc: (
    tenantId: string,
    courseId: string,
    moduleId: string,
    lesson: Omit<Lesson, 'id'>,
  ) => Promise<string>;
  updateLessonDoc: (
    tenantId: string,
    courseId: string,
    moduleId: string,
    lessonId: string,
    updates: Partial<Omit<Lesson, 'id'>>,
  ) => Promise<void>;
  deleteLessonDoc: (
    tenantId: string,
    courseId: string,
    moduleId: string,
    lessonId: string,
  ) => Promise<void>;
  writeLessonOrder: (
    tenantId: string,
    courseId: string,
    moduleId: string,
    orderedIds: string[],
  ) => Promise<void>;
}

export async function createLesson(
  deps: LessonDeps,
  tenantId: string,
  courseId: string,
  moduleId: string,
  input: { title: string; order: number },
): Promise<{ id: string }> {
  const title = input.title.trim();
  if (!title) {
    throw new Error('La lección necesita un título');
  }
  const id = await deps.createLessonDoc(tenantId, courseId, moduleId, {
    title,
    order: input.order,
    videoUrl: null,
    textContent: null,
    attachmentUrls: [],
  });
  return { id };
}

export async function updateLesson(
  deps: LessonDeps,
  tenantId: string,
  courseId: string,
  moduleId: string,
  lessonId: string,
  updates: Partial<Pick<Lesson, 'title' | 'videoUrl' | 'textContent'>>,
): Promise<void> {
  await deps.updateLessonDoc(tenantId, courseId, moduleId, lessonId, updates);
}

export async function deleteLesson(
  deps: LessonDeps,
  tenantId: string,
  courseId: string,
  moduleId: string,
  lessonId: string,
): Promise<void> {
  await deps.deleteLessonDoc(tenantId, courseId, moduleId, lessonId);
}

export async function reorderLessons(
  deps: LessonDeps,
  tenantId: string,
  courseId: string,
  moduleId: string,
  lessons: Lesson[],
  fromIndex: number,
  toIndex: number,
): Promise<Lesson[]> {
  const reordered = reorderItems(lessons, fromIndex, toIndex);
  await deps.writeLessonOrder(
    tenantId,
    courseId,
    moduleId,
    reordered.map((l) => l.id),
  );
  return reordered;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lessonOperations`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/courses/lessonOperations.ts src/lib/courses/lessonOperations.test.ts
git commit -m "feat: add lessonOperations pure create/update/delete/reorder functions"
```

---

### Task 6: `quizOperations` pure functions

**Files:**
- Create: `src/lib/quiz/quizOperations.ts`
- Test: `src/lib/quiz/quizOperations.test.ts`

**Interfaces:**
- Consumes: `validateQuizQuestion` (Task 2), `Quiz`/`QuizQuestion` from `src/lib/models/types.ts`
- Produces:
  ```typescript
  interface QuizDeps {
    createQuizDoc: (tenantId: string, courseId: string, moduleId: string, lessonId: string, quiz: Omit<Quiz, 'id'>) => Promise<string>;
    updateQuizQuestions: (tenantId: string, courseId: string, moduleId: string, lessonId: string, quizId: string, questions: QuizQuestion[]) => Promise<void>;
  }
  createQuiz(deps, tenantId, courseId, moduleId, lessonId): Promise<{ id: string }>
  addQuestion(deps, tenantId, courseId, moduleId, lessonId, quizId, existingQuestions: QuizQuestion[], newQuestion: QuizQuestion): Promise<QuizQuestion[]>
  updateQuestion(deps, tenantId, courseId, moduleId, lessonId, quizId, existingQuestions: QuizQuestion[], index: number, updatedQuestion: QuizQuestion): Promise<QuizQuestion[]>
  deleteQuestion(deps, tenantId, courseId, moduleId, lessonId, quizId, existingQuestions: QuizQuestion[], index: number): Promise<QuizQuestion[]>
  ```
  Used by Task 10 (lesson editor page).

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/quiz/quizOperations.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  createQuiz,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  type QuizDeps,
} from './quizOperations';
import type { QuizQuestion } from '../models/types';

function makeDeps(overrides: Partial<QuizDeps> = {}): QuizDeps {
  return {
    createQuizDoc: vi.fn().mockResolvedValue('quiz-1'),
    updateQuizQuestions: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const validQuestion: QuizQuestion = {
  text: '¿Cuál es la capital de Francia?',
  options: ['Madrid', 'París'],
  correctOptionIndex: 1,
};

describe('createQuiz', () => {
  it('creates an empty quiz', async () => {
    const deps = makeDeps();
    const result = await createQuiz(deps, 'tenant-a', 'course-1', 'module-1', 'lesson-1');
    expect(deps.createQuizDoc).toHaveBeenCalledWith('tenant-a', 'course-1', 'module-1', 'lesson-1', {
      lessonId: 'lesson-1',
      questions: [],
    });
    expect(result).toEqual({ id: 'quiz-1' });
  });
});

describe('addQuestion', () => {
  it('rejects an invalid question without writing', async () => {
    const deps = makeDeps();
    const invalid: QuizQuestion = { text: '', options: ['a'], correctOptionIndex: 0 };
    await expect(
      addQuestion(deps, 'tenant-a', 'course-1', 'module-1', 'lesson-1', 'quiz-1', [], invalid),
    ).rejects.toThrow();
    expect(deps.updateQuizQuestions).not.toHaveBeenCalled();
  });

  it('appends a valid question and writes the full list', async () => {
    const deps = makeDeps();
    const result = await addQuestion(
      deps,
      'tenant-a',
      'course-1',
      'module-1',
      'lesson-1',
      'quiz-1',
      [],
      validQuestion,
    );
    expect(result).toEqual([validQuestion]);
    expect(deps.updateQuizQuestions).toHaveBeenCalledWith(
      'tenant-a',
      'course-1',
      'module-1',
      'lesson-1',
      'quiz-1',
      [validQuestion],
    );
  });
});

describe('updateQuestion', () => {
  it('replaces the question at the given index', async () => {
    const deps = makeDeps();
    const second: QuizQuestion = { text: 'Otra', options: ['x', 'y'], correctOptionIndex: 0 };
    const result = await updateQuestion(
      deps,
      'tenant-a',
      'course-1',
      'module-1',
      'lesson-1',
      'quiz-1',
      [validQuestion],
      0,
      second,
    );
    expect(result).toEqual([second]);
  });
});

describe('deleteQuestion', () => {
  it('removes the question at the given index', async () => {
    const deps = makeDeps();
    const result = await deleteQuestion(
      deps,
      'tenant-a',
      'course-1',
      'module-1',
      'lesson-1',
      'quiz-1',
      [validQuestion],
      0,
    );
    expect(result).toEqual([]);
    expect(deps.updateQuizQuestions).toHaveBeenCalledWith(
      'tenant-a',
      'course-1',
      'module-1',
      'lesson-1',
      'quiz-1',
      [],
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- quizOperations`
Expected: FAIL with "Cannot find module './quizOperations'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/quiz/quizOperations.ts
import { validateQuizQuestion } from './validateQuizQuestion';
import type { Quiz, QuizQuestion } from '../models/types';

export interface QuizDeps {
  createQuizDoc: (
    tenantId: string,
    courseId: string,
    moduleId: string,
    lessonId: string,
    quiz: Omit<Quiz, 'id'>,
  ) => Promise<string>;
  updateQuizQuestions: (
    tenantId: string,
    courseId: string,
    moduleId: string,
    lessonId: string,
    quizId: string,
    questions: QuizQuestion[],
  ) => Promise<void>;
}

export async function createQuiz(
  deps: QuizDeps,
  tenantId: string,
  courseId: string,
  moduleId: string,
  lessonId: string,
): Promise<{ id: string }> {
  const id = await deps.createQuizDoc(tenantId, courseId, moduleId, lessonId, {
    lessonId,
    questions: [],
  });
  return { id };
}

export async function addQuestion(
  deps: QuizDeps,
  tenantId: string,
  courseId: string,
  moduleId: string,
  lessonId: string,
  quizId: string,
  existingQuestions: QuizQuestion[],
  newQuestion: QuizQuestion,
): Promise<QuizQuestion[]> {
  const result = validateQuizQuestion(newQuestion);
  if (!result.valid) {
    throw new Error(result.error);
  }
  const updated = [...existingQuestions, newQuestion];
  await deps.updateQuizQuestions(tenantId, courseId, moduleId, lessonId, quizId, updated);
  return updated;
}

export async function updateQuestion(
  deps: QuizDeps,
  tenantId: string,
  courseId: string,
  moduleId: string,
  lessonId: string,
  quizId: string,
  existingQuestions: QuizQuestion[],
  index: number,
  updatedQuestion: QuizQuestion,
): Promise<QuizQuestion[]> {
  const result = validateQuizQuestion(updatedQuestion);
  if (!result.valid) {
    throw new Error(result.error);
  }
  const updated = existingQuestions.map((q, i) => (i === index ? updatedQuestion : q));
  await deps.updateQuizQuestions(tenantId, courseId, moduleId, lessonId, quizId, updated);
  return updated;
}

export async function deleteQuestion(
  deps: QuizDeps,
  tenantId: string,
  courseId: string,
  moduleId: string,
  lessonId: string,
  quizId: string,
  existingQuestions: QuizQuestion[],
  index: number,
): Promise<QuizQuestion[]> {
  const updated = existingQuestions.filter((_, i) => i !== index);
  await deps.updateQuizQuestions(tenantId, courseId, moduleId, lessonId, quizId, updated);
  return updated;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- quizOperations`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/quiz/quizOperations.ts src/lib/quiz/quizOperations.test.ts
git commit -m "feat: add quizOperations pure create-quiz/add/update/delete-question functions"
```

---

### Task 7: "Mis cursos" header link

**Files:**
- Modify: `src/components/Header.tsx`

**Interfaces:**
- Consumes: `useAuth()` (existing — `claims.role`)
- Produces: nothing new — a link, not a function.

- [ ] **Step 1: Read the current file, then add the link**

Read `src/components/Header.tsx` first — it was last modified in the visual-design phase's review-fix
rounds, so confirm its exact current content before editing (don't assume; the file has a `usePathname`
embed-route check, a `useRouter` sign-out redirect, and a `.user-info` div containing the user's email
in a `.user-email` span, a role `.badge`, and the sign-out button — insert the new link as the first
child of `.user-info`, before the email span).

Insert this JSX as the first child inside the `<div className="user-info">` element, before whatever
currently renders the email:

```tsx
{(claims?.role === 'owner' || claims?.role === 'instructor') && (
  <a href="/panel/cursos" className="btn btn-secondary">
    Mis cursos
  </a>
)}
```

Do not change anything else in the file — no other logic, imports, or JSX should be touched.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0

Run: `npm test`
Expected: 27/27 passing (unchanged — this task touches no tested logic)

Run: `npm run dev`, sign in as an owner/instructor account, confirm "Mis cursos" appears in the header
and links to `/panel/cursos` (a 404 is expected until Task 8 lands — that's fine, confirms the link
itself renders and points at the right path). Sign in as a student and confirm the link does NOT
appear.

- [ ] **Step 3: Commit**

```bash
git add src/components/Header.tsx
git commit -m "feat: add Mis cursos link to header for owner/instructor"
```

---

### Task 8: Course list page

**Files:**
- Create: `src/app/panel/cursos/page.tsx`

**Interfaces:**
- Consumes: `createCourse`, `CourseDeps` (Task 3); `getFirebaseFirestore` (existing);
  `courseConverter` (existing, from `src/lib/models/courseConverters.ts`); `useAuth()` (existing)
- Produces: the `/panel/cursos` route, which Task 7's header link and Task 9's course editor both
  link back to.

- [ ] **Step 1: Write `src/app/panel/cursos/page.tsx`**

No unit test — page component, verified manually (same precedent as every prior phase's pages).

```tsx
// src/app/panel/cursos/page.tsx
'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { collection, doc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { createCourse } from '@/lib/courses/courseOperations';
import { courseConverter } from '@/lib/models/courseConverters';
import type { Course } from '@/lib/models/types';

export default function CursosPage() {
  const { claims } = useAuth();
  const tenantId = claims?.tenantId;
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!tenantId) return;

    async function loadCourses() {
      const db = getFirebaseFirestore();
      const coursesRef = collection(db, `tenants/${tenantId}/courses`).withConverter(courseConverter);
      const snapshot = await getDocs(query(coursesRef, orderBy('title')));
      setCourses(snapshot.docs.map((d) => d.data()));
      setLoading(false);
    }

    loadCourses();
  }, [tenantId]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!tenantId) return;
    setError(null);
    setSubmitting(true);
    try {
      const db = getFirebaseFirestore();
      const { id } = await createCourse(
        {
          createCourseDoc: async (tId, course) => {
            const ref = doc(collection(db, `tenants/${tId}/courses`));
            await setDoc(ref, course);
            return ref.id;
          },
          updateCourseDoc: async () => {},
          deleteCourseDoc: async () => {},
        },
        tenantId,
        { title, description },
      );
      window.location.href = `/panel/cursos/${id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el curso');
      setSubmitting(false);
    }
  }

  return (
    <main className="page-app">
      <div className="page-app-content">
        <div className="card">
          <h1>Mis cursos</h1>
          {loading ? (
            <p>Cargando...</p>
          ) : (
            <ul className="course-list">
              {courses.map((course) => (
                <li key={course.id} className="course-card">
                  <a href={`/panel/cursos/${course.id}`}>{course.title}</a>
                  <p>{course.published ? 'Publicado' : 'Borrador'}</p>
                </li>
              ))}
            </ul>
          )}
          {!loading && courses.length === 0 && <p>Todavía no creaste ningún curso.</p>}
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <h2>Crear curso</h2>
          <form onSubmit={handleCreate}>
            <label className="field">
              <span className="field-label">Título</span>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </label>
            <label className="field">
              <span className="field-label">Descripción</span>
              <input
                className="input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            {error && (
              <p className="alert alert-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creando...' : 'Crear curso'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0

Run: `npm test`
Expected: 27/27 passing (this task adds no new tests)

Run: `npm run dev`, sign in as an owner, visit `/panel/cursos`
Expected: "Mis cursos" heading, empty-state message if no courses exist yet, and a working "Crear
curso" form that creates a real course document in Firestore and redirects to
`/panel/cursos/{id}` (a 404 is expected there until Task 9 lands).

- [ ] **Step 3: Commit**

```bash
git add src/app/panel/cursos/page.tsx
git commit -m "feat: add course list page with create-course form"
```

---

### Task 9: Course editor page (modules + lessons, drag reorder)

**Files:**
- Create: `src/app/panel/cursos/[courseId]/page.tsx`

**Interfaces:**
- Consumes: `updateCourse` (Task 3); `createModule`, `deleteModule`, `reorderModules`, `ModuleDeps`
  (Task 4); `createLesson`, `deleteLesson`, `reorderLessons`, `LessonDeps` (Task 5);
  `getFirebaseFirestore` (existing); `courseConverter` (existing); `useAuth()` (existing)
- Produces: the `/panel/cursos/{courseId}` route. Lesson links point at
  `/panel/cursos/{courseId}/lecciones/{lessonId}?moduleId={moduleId}` — Task 10's route needs the
  `moduleId` query param since the lesson editor's Firestore path requires it and the URL path
  itself (per the approved design spec) doesn't carry it.

- [ ] **Step 1: Install `@dnd-kit`**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Write `src/app/panel/cursos/[courseId]/page.tsx`**

No unit test — page component with the drag-and-drop interaction, verified manually.

```tsx
// src/app/panel/cursos/[courseId]/page.tsx
'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  setDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { courseConverter } from '@/lib/models/courseConverters';
import { updateCourse, type CourseDeps } from '@/lib/courses/courseOperations';
import {
  createModule,
  deleteModule,
  reorderModules,
  type ModuleDeps,
} from '@/lib/courses/moduleOperations';
import {
  createLesson,
  deleteLesson,
  reorderLessons,
  type LessonDeps,
} from '@/lib/courses/lessonOperations';
import type { Course, Module, Lesson } from '@/lib/models/types';

interface ModuleWithLessons extends Module {
  lessons: Lesson[];
}

function SortableRow({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

export default function CourseEditorPage({ params }: { params: { courseId: string } }) {
  const { claims } = useAuth();
  const tenantId = claims?.tenantId;
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<ModuleWithLessons[]>([]);
  const [loading, setLoading] = useState(true);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [newLessonTitles, setNewLessonTitles] = useState<Record<string, string>>({});

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (!tenantId) return;
    loadCourse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function loadCourse() {
    if (!tenantId) return;
    const db = getFirebaseFirestore();
    const courseSnap = await getDoc(
      doc(db, `tenants/${tenantId}/courses/${params.courseId}`).withConverter(courseConverter),
    );
    if (courseSnap.exists()) {
      setCourse(courseSnap.data());
    }

    const modulesSnap = await getDocs(
      query(collection(db, `tenants/${tenantId}/courses/${params.courseId}/modules`), orderBy('order')),
    );
    const loadedModules: ModuleWithLessons[] = [];
    for (const moduleDoc of modulesSnap.docs) {
      const data = moduleDoc.data();
      const lessonsSnap = await getDocs(
        query(
          collection(
            db,
            `tenants/${tenantId}/courses/${params.courseId}/modules/${moduleDoc.id}/lessons`,
          ),
          orderBy('order'),
        ),
      );
      const lessons: Lesson[] = lessonsSnap.docs.map((lessonDoc) => {
        const lessonData = lessonDoc.data();
        return {
          id: lessonDoc.id,
          title: lessonData.title,
          order: lessonData.order,
          videoUrl: lessonData.videoUrl ?? null,
          textContent: lessonData.textContent ?? null,
          attachmentUrls: lessonData.attachmentUrls ?? [],
        };
      });
      loadedModules.push({ id: moduleDoc.id, title: data.title, order: data.order, lessons });
    }
    setModules(loadedModules);
    setLoading(false);
  }

  function moduleDeps(): ModuleDeps {
    const db = getFirebaseFirestore();
    return {
      createModuleDoc: async (tId, courseId, moduleData) => {
        const ref = doc(collection(db, `tenants/${tId}/courses/${courseId}/modules`));
        await setDoc(ref, moduleData);
        return ref.id;
      },
      updateModuleDoc: async () => {},
      deleteModuleDoc: async (tId, courseId, moduleId) => {
        await deleteDoc(doc(db, `tenants/${tId}/courses/${courseId}/modules/${moduleId}`));
      },
      writeModuleOrder: async (tId, courseId, orderedIds) => {
        const batch = writeBatch(db);
        orderedIds.forEach((id, index) => {
          batch.update(doc(db, `tenants/${tId}/courses/${courseId}/modules/${id}`), { order: index });
        });
        await batch.commit();
      },
    };
  }

  function lessonDeps(): LessonDeps {
    const db = getFirebaseFirestore();
    return {
      createLessonDoc: async (tId, courseId, moduleId, lessonData) => {
        const ref = doc(
          collection(db, `tenants/${tId}/courses/${courseId}/modules/${moduleId}/lessons`),
        );
        await setDoc(ref, lessonData);
        return ref.id;
      },
      updateLessonDoc: async () => {},
      deleteLessonDoc: async (tId, courseId, moduleId, lessonId) => {
        await deleteDoc(
          doc(db, `tenants/${tId}/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`),
        );
      },
      writeLessonOrder: async (tId, courseId, moduleId, orderedIds) => {
        const batch = writeBatch(db);
        orderedIds.forEach((id, index) => {
          batch.update(
            doc(db, `tenants/${tId}/courses/${courseId}/modules/${moduleId}/lessons/${id}`),
            { order: index },
          );
        });
        await batch.commit();
      },
    };
  }

  async function handleAddModule(event: FormEvent) {
    event.preventDefault();
    if (!tenantId || !newModuleTitle.trim()) return;
    const { id } = await createModule(moduleDeps(), tenantId, params.courseId, {
      title: newModuleTitle,
      order: modules.length,
    });
    setModules([...modules, { id, title: newModuleTitle.trim(), order: modules.length, lessons: [] }]);
    setNewModuleTitle('');
  }

  async function handleDeleteModule(moduleId: string) {
    if (!tenantId) return;
    await deleteModule(moduleDeps(), tenantId, params.courseId, moduleId);
    setModules(modules.filter((m) => m.id !== moduleId));
  }

  async function handleModuleDragEnd(event: DragEndEvent) {
    if (!tenantId) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = modules.findIndex((m) => m.id === active.id);
    const toIndex = modules.findIndex((m) => m.id === over.id);
    if (fromIndex === -1 || toIndex === -1) return;
    const reordered = await reorderModules(
      moduleDeps(),
      tenantId,
      params.courseId,
      modules,
      fromIndex,
      toIndex,
    );
    setModules(reordered as ModuleWithLessons[]);
  }

  async function handleAddLesson(moduleId: string) {
    if (!tenantId) return;
    const title = newLessonTitles[moduleId];
    if (!title || !title.trim()) return;
    const targetModule = modules.find((m) => m.id === moduleId);
    if (!targetModule) return;
    const { id } = await createLesson(lessonDeps(), tenantId, params.courseId, moduleId, {
      title,
      order: targetModule.lessons.length,
    });
    setModules(
      modules.map((m) =>
        m.id === moduleId
          ? {
              ...m,
              lessons: [
                ...m.lessons,
                {
                  id,
                  title: title.trim(),
                  order: m.lessons.length,
                  videoUrl: null,
                  textContent: null,
                  attachmentUrls: [],
                },
              ],
            }
          : m,
      ),
    );
    setNewLessonTitles({ ...newLessonTitles, [moduleId]: '' });
  }

  async function handleDeleteLesson(moduleId: string, lessonId: string) {
    if (!tenantId) return;
    await deleteLesson(lessonDeps(), tenantId, params.courseId, moduleId, lessonId);
    setModules(
      modules.map((m) =>
        m.id === moduleId ? { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) } : m,
      ),
    );
  }

  async function handleLessonDragEnd(moduleId: string, event: DragEndEvent) {
    if (!tenantId) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const targetModule = modules.find((m) => m.id === moduleId);
    if (!targetModule) return;
    const fromIndex = targetModule.lessons.findIndex((l) => l.id === active.id);
    const toIndex = targetModule.lessons.findIndex((l) => l.id === over.id);
    if (fromIndex === -1 || toIndex === -1) return;
    const reordered = await reorderLessons(
      lessonDeps(),
      tenantId,
      params.courseId,
      moduleId,
      targetModule.lessons,
      fromIndex,
      toIndex,
    );
    setModules(modules.map((m) => (m.id === moduleId ? { ...m, lessons: reordered } : m)));
  }

  async function handleSaveCourseMeta(event: FormEvent) {
    event.preventDefault();
    if (!tenantId || !course) return;
    const deps: CourseDeps = {
      createCourseDoc: async () => '',
      updateCourseDoc: async (tId, courseId, updates) => {
        const db = getFirebaseFirestore();
        await setDoc(doc(db, `tenants/${tId}/courses/${courseId}`), updates, { merge: true });
      },
      deleteCourseDoc: async () => {},
    };
    await updateCourse(deps, tenantId, params.courseId, {
      title: course.title,
      description: course.description,
      published: course.published,
    });
  }

  if (loading || !course) {
    return (
      <main className="page-app">
        <div className="page-app-content">
          <p>Cargando...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="page-app">
      <div className="page-app-content">
        <div className="card">
          <h1>Editar curso</h1>
          <form onSubmit={handleSaveCourseMeta}>
            <label className="field">
              <span className="field-label">Título</span>
              <input
                className="input"
                value={course.title}
                onChange={(e) => setCourse({ ...course, title: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">Descripción</span>
              <input
                className="input"
                value={course.description}
                onChange={(e) => setCourse({ ...course, description: e.target.value })}
              />
            </label>
            <label className="field">
              <input
                type="checkbox"
                checked={course.published}
                onChange={(e) => setCourse({ ...course, published: e.target.checked })}
              />{' '}
              Publicado
            </label>
            <button type="submit" className="btn btn-primary">
              Guardar
            </button>
          </form>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleModuleDragEnd}>
          <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            {modules.map((moduleItem) => (
              <div key={moduleItem.id} className="card" style={{ marginTop: 16 }}>
                <SortableRow id={moduleItem.id}>
                  <h3 style={{ cursor: 'grab' }}>{moduleItem.title}</h3>
                </SortableRow>
                <button className="btn btn-secondary" onClick={() => handleDeleteModule(moduleItem.id)}>
                  Borrar módulo
                </button>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(event) => handleLessonDragEnd(moduleItem.id, event)}
                >
                  <SortableContext
                    items={moduleItem.lessons.map((l) => l.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ul className="lesson-sidebar-list">
                      {moduleItem.lessons.map((lesson) => (
                        <SortableRow key={lesson.id} id={lesson.id}>
                          <li style={{ display: 'flex', justifyContent: 'space-between', cursor: 'grab' }}>
                            <a
                              href={`/panel/cursos/${params.courseId}/lecciones/${lesson.id}?moduleId=${moduleItem.id}`}
                            >
                              {lesson.title}
                            </a>
                            <button
                              className="btn btn-secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteLesson(moduleItem.id, lesson.id);
                              }}
                            >
                              Borrar
                            </button>
                          </li>
                        </SortableRow>
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAddLesson(moduleItem.id);
                  }}
                >
                  <input
                    className="input"
                    placeholder="Título de la lección"
                    value={newLessonTitles[moduleItem.id] ?? ''}
                    onChange={(e) =>
                      setNewLessonTitles({ ...newLessonTitles, [moduleItem.id]: e.target.value })
                    }
                  />
                  <button type="submit" className="btn btn-secondary">
                    + Lección
                  </button>
                </form>
              </div>
            ))}
          </SortableContext>
        </DndContext>

        <div className="card" style={{ marginTop: 16 }}>
          <form onSubmit={handleAddModule}>
            <input
              className="input"
              placeholder="Título del módulo"
              value={newModuleTitle}
              onChange={(e) => setNewModuleTitle(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">
              + Módulo
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0

Run: `npm test`
Expected: 27/27 passing plus the 24 new pure-logic tests from Tasks 1-6 (51 total) — this task itself
adds no new tests, but confirm the full suite is still green after installing a new dependency.

Run: `npm run dev`, visit `/panel/cursos/{courseId}` for a course created in Task 8
Expected: course title/description/published form saves correctly; adding a module and a lesson
inside it both work and persist (reload the page to confirm); dragging a module to a new position
updates its order (reload to confirm the new order stuck); dragging a lesson within its module does
the same; deleting a module or lesson removes it from Firestore (reload to confirm); the lesson link
navigates to `/panel/cursos/{courseId}/lecciones/{lessonId}?moduleId={moduleId}` (a 404 is expected
there until Task 10 lands).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json "src/app/panel/cursos/[courseId]/page.tsx"
git commit -m "feat: add course editor page with drag-and-drop module/lesson reordering"
```

---

### Task 10: Lesson editor page (content + quiz authoring)

**Files:**
- Create: `src/app/panel/cursos/[courseId]/lecciones/[lessonId]/page.tsx`

**Interfaces:**
- Consumes: `updateLesson`, `LessonDeps` (Task 5); `createQuiz`, `addQuestion`, `deleteQuestion`,
  `QuizDeps` (Task 6); `getFirebaseFirestore` (existing); `useAuth()` (existing)
- Produces: the `/panel/cursos/{courseId}/lecciones/{lessonId}` route (reads `moduleId` from the
  `?moduleId=` query param that Task 9's lesson links already append).

- [ ] **Step 1: Write `src/app/panel/cursos/[courseId]/lecciones/[lessonId]/page.tsx`**

No unit test — page component, verified manually.

```tsx
// src/app/panel/cursos/[courseId]/lecciones/[lessonId]/page.tsx
'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { updateLesson, type LessonDeps } from '@/lib/courses/lessonOperations';
import {
  createQuiz,
  addQuestion,
  deleteQuestion,
  type QuizDeps,
} from '@/lib/quiz/quizOperations';
import type { Lesson, Quiz, QuizQuestion } from '@/lib/models/types';

export default function LessonEditorPage({
  params,
  searchParams,
}: {
  params: { courseId: string; lessonId: string };
  searchParams: { moduleId?: string };
}) {
  const { claims } = useAuth();
  const tenantId = claims?.tenantId;
  const moduleId = searchParams.moduleId ?? '';
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionOptions, setNewQuestionOptions] = useState(['', '']);
  const [newQuestionCorrect, setNewQuestionCorrect] = useState(0);

  useEffect(() => {
    if (!tenantId || !moduleId) return;
    loadLesson();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, moduleId]);

  function lessonPath(): string {
    return `tenants/${tenantId}/courses/${params.courseId}/modules/${moduleId}/lessons/${params.lessonId}`;
  }

  async function loadLesson() {
    const db = getFirebaseFirestore();
    const lessonSnap = await getDoc(doc(db, lessonPath()));
    if (lessonSnap.exists()) {
      const data = lessonSnap.data();
      setLesson({
        id: lessonSnap.id,
        title: data.title,
        order: data.order,
        videoUrl: data.videoUrl ?? null,
        textContent: data.textContent ?? null,
        attachmentUrls: data.attachmentUrls ?? [],
      });
    }

    const quizzesSnap = await getDocs(collection(db, `${lessonPath()}/quizzes`));
    if (!quizzesSnap.empty) {
      const quizDoc = quizzesSnap.docs[0];
      const quizData = quizDoc.data();
      setQuiz({ id: quizDoc.id, lessonId: params.lessonId, questions: quizData.questions ?? [] });
    }
    setLoading(false);
  }

  function quizDeps(): QuizDeps {
    const db = getFirebaseFirestore();
    return {
      createQuizDoc: async (tId, courseId, modId, lessonId, newQuiz) => {
        const ref = doc(
          collection(
            db,
            `tenants/${tId}/courses/${courseId}/modules/${modId}/lessons/${lessonId}/quizzes`,
          ),
        );
        await setDoc(ref, newQuiz);
        return ref.id;
      },
      updateQuizQuestions: async (tId, courseId, modId, lessonId, quizId, questions) => {
        await updateDoc(
          doc(
            db,
            `tenants/${tId}/courses/${courseId}/modules/${modId}/lessons/${lessonId}/quizzes/${quizId}`,
          ),
          { questions },
        );
      },
    };
  }

  async function handleSaveLesson(event: FormEvent) {
    event.preventDefault();
    if (!tenantId || !lesson) return;
    setSaveError(null);
    const deps: LessonDeps = {
      createLessonDoc: async () => '',
      updateLessonDoc: async (tId, courseId, modId, lessonId, updates) => {
        const db = getFirebaseFirestore();
        await updateDoc(
          doc(db, `tenants/${tId}/courses/${courseId}/modules/${modId}/lessons/${lessonId}`),
          updates,
        );
      },
      deleteLessonDoc: async () => {},
      writeLessonOrder: async () => {},
    };
    try {
      await updateLesson(deps, tenantId, params.courseId, moduleId, params.lessonId, {
        title: lesson.title,
        videoUrl: lesson.videoUrl,
        textContent: lesson.textContent,
      });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo guardar la lección');
    }
  }

  async function handleCreateQuiz() {
    if (!tenantId) return;
    const { id } = await createQuiz(quizDeps(), tenantId, params.courseId, moduleId, params.lessonId);
    setQuiz({ id, lessonId: params.lessonId, questions: [] });
  }

  async function handleAddQuestion(event: FormEvent) {
    event.preventDefault();
    if (!tenantId || !quiz) return;
    setSaveError(null);
    const question: QuizQuestion = {
      text: newQuestionText,
      options: newQuestionOptions,
      correctOptionIndex: newQuestionCorrect,
    };
    try {
      const updated = await addQuestion(
        quizDeps(),
        tenantId,
        params.courseId,
        moduleId,
        params.lessonId,
        quiz.id,
        quiz.questions,
        question,
      );
      setQuiz({ ...quiz, questions: updated });
      setNewQuestionText('');
      setNewQuestionOptions(['', '']);
      setNewQuestionCorrect(0);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo agregar la pregunta');
    }
  }

  async function handleDeleteQuestion(index: number) {
    if (!tenantId || !quiz) return;
    const updated = await deleteQuestion(
      quizDeps(),
      tenantId,
      params.courseId,
      moduleId,
      params.lessonId,
      quiz.id,
      quiz.questions,
      index,
    );
    setQuiz({ ...quiz, questions: updated });
  }

  if (loading || !lesson) {
    return (
      <main className="page-app">
        <div className="page-app-content">
          <p>Cargando...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="page-app">
      <div className="page-app-content">
        <div className="card">
          <h1>Editar lección</h1>
          <form onSubmit={handleSaveLesson}>
            <label className="field">
              <span className="field-label">Título</span>
              <input
                className="input"
                value={lesson.title}
                onChange={(e) => setLesson({ ...lesson, title: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">Contenido de texto</span>
              <textarea
                className="input"
                rows={6}
                value={lesson.textContent ?? ''}
                onChange={(e) => setLesson({ ...lesson, textContent: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">URL de video</span>
              <input
                className="input"
                value={lesson.videoUrl ?? ''}
                onChange={(e) => setLesson({ ...lesson, videoUrl: e.target.value })}
              />
            </label>
            {saveError && (
              <p className="alert alert-error" role="alert">
                {saveError}
              </p>
            )}
            <button type="submit" className="btn btn-primary">
              Guardar
            </button>
          </form>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <h2>Quiz</h2>
          {!quiz ? (
            <button className="btn btn-primary" onClick={handleCreateQuiz}>
              Agregar quiz
            </button>
          ) : (
            <>
              <ul>
                {quiz.questions.map((q, index) => (
                  <li key={index} style={{ marginBottom: 12 }}>
                    <p>
                      <strong>{q.text}</strong>
                    </p>
                    <ul>
                      {q.options.map((opt, optIndex) => (
                        <li key={optIndex}>
                          {optIndex === q.correctOptionIndex ? '✓ ' : ''}
                          {opt}
                        </li>
                      ))}
                    </ul>
                    <button className="btn btn-secondary" onClick={() => handleDeleteQuestion(index)}>
                      Borrar pregunta
                    </button>
                  </li>
                ))}
              </ul>

              <form onSubmit={handleAddQuestion}>
                <label className="field">
                  <span className="field-label">Pregunta</span>
                  <input
                    className="input"
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                  />
                </label>
                {newQuestionOptions.map((opt, index) => (
                  <div className="field" key={index}>
                    <span className="field-label">Opción {index + 1}</span>
                    <input
                      className="input"
                      value={opt}
                      onChange={(e) => {
                        const updated = [...newQuestionOptions];
                        updated[index] = e.target.value;
                        setNewQuestionOptions(updated);
                      }}
                    />
                    <label>
                      <input
                        type="radio"
                        name="correct-option"
                        checked={newQuestionCorrect === index}
                        onChange={() => setNewQuestionCorrect(index)}
                      />{' '}
                      Correcta
                    </label>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setNewQuestionOptions([...newQuestionOptions, ''])}
                >
                  + Opción
                </button>
                <button type="submit" className="btn btn-primary">
                  Agregar pregunta
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0

Run: `npm test`
Expected: 51/51 passing (unchanged from Task 9 — this task adds no new tests)

Run: `npm run dev`, navigate to a lesson via the course editor's "+ Lección" flow, then click into it
Expected: lesson title/text/video URL save correctly (reload to confirm); "Agregar quiz" creates a
quiz document; adding a question with 2+ non-empty options and a marked-correct option succeeds and
appears in the list; submitting an invalid question (empty text, or no correct option marked) shows
the error message and does not write to Firestore; deleting a question removes it (reload to
confirm).

Run: `npm run build`
Expected: succeeds — this is the last task in the plan, so also confirm the whole app still builds
cleanly with the new `@dnd-kit` dependency and three new routes.

- [ ] **Step 3: Commit**

```bash
git add "src/app/panel/cursos/[courseId]/lecciones/[lessonId]/page.tsx"
git commit -m "feat: add lesson editor page with content fields and quiz question authoring"
```

---

## Self-Review Notes

- **Spec coverage:** full course/module/lesson CRUD (Tasks 3-5, 8-9), reordering via drag-and-drop
  backed by a pure `reorderItems` function (Tasks 1, 4, 5, 9), quiz question authoring with
  validation (Tasks 2, 6, 10), the "Mis cursos" header entry point (Task 7), no new Cloud Function
  anywhere (every write path in Tasks 8-10 goes through injected Firestore deps directly), video as
  a pasted URL only (Task 10's lesson form has a plain text `input` for `videoUrl`, no upload
  widget). All spec sections are covered.
- **Placeholder scan:** no TBD/TODO; every step has complete, runnable code.
- **Type consistency:** `Course`/`Module`/`Lesson`/`Quiz`/`QuizQuestion` field names match
  `src/lib/models/types.ts` exactly across all six operations files and both page components
  (verified against the prior phases' Task 3, which defined these types). The `CourseDeps`/
  `ModuleDeps`/`LessonDeps`/`QuizDeps` interfaces defined in Tasks 3-6 are imported and implemented
  with matching signatures in Tasks 8-10 (e.g. `moduleDeps()` in Task 9 returns an object whose
  shape exactly matches `ModuleDeps` from Task 4 — `createModuleDoc`, `updateModuleDoc`,
  `deleteModuleDoc`, `writeModuleOrder`, all with the same parameter order).
- **Cross-task URL contract:** Task 9's lesson links append `?moduleId={moduleId}`, and Task 10's
  page reads `searchParams.moduleId` — flagged explicitly in Task 9's Interfaces block so this
  doesn't read as an accidental mismatch between the two tasks.
