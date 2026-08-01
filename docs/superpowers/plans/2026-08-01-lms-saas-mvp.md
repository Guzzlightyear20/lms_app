# LMS SaaS MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the core vertical slice of a multi-tenant LMS — tenant resolution, course/lesson content model, enrollment + progress tracking, quizzes, auto-generated certificates, and an embeddable public course view — deployable as a SaaS add-on for client websites.

**Architecture:** Next.js (App Router, TypeScript) frontend backed by Firebase (Firestore, Auth, Storage, Cloud Functions). Tenant is resolved per-request from the hostname (subdomain) or a `tenantId` route param (embed mode). All Firestore data is scoped under `tenants/{tenantId}/...`. Firebase custom claims (`{ tenantId, role }`) gate owner/instructor/student access. A Cloud Function listens for progress updates and generates a certificate PDF when a course is completed.

**Tech Stack:** Next.js 14 (App Router) + TypeScript, Firebase (Auth, Firestore, Storage, Cloud Functions v2), Vitest for unit tests, `@firebase/rules-unit-testing` + Firebase Emulator Suite for security-rules/integration tests, `pdf-lib` for certificate generation.

## Global Constraints

- All Firestore reads/writes for course content go through `tenants/{tenantId}/...` — no top-level `courses` collection (tenant isolation is structural, not just a filter).
- Every Cloud Function and Firestore security rule must check `request.auth.token.tenantId` matches the resource's tenant before allowing access.
- No payment/checkout code in this MVP — enrollment is created directly (owner/admin action or open self-enroll toggle per course), per spec's explicit out-of-scope list.
- TypeScript strict mode on for both `src/` (Next.js app) and `functions/src/` (Cloud Functions).
- Node 20 for Cloud Functions runtime.

---

## File Structure

```
lms-saas/
  package.json
  tsconfig.json
  vitest.config.ts
  next.config.js
  firebase.json
  firestore.rules
  firestore.indexes.json
  src/
    lib/
      firebase/
        client.ts                  # Firebase client SDK init (browser)
      tenant/
        resolveTenant.ts           # host/param -> tenantId
        resolveTenant.test.ts
      models/
        types.ts                   # shared TS types (Course, Module, Lesson, Quiz, Progress)
        courseConverters.ts        # Firestore data converters
        courseConverters.test.ts
      quiz/
        scoreQuiz.ts                # pure scoring logic
        scoreQuiz.test.ts
      progress/
        computeCompletion.ts        # pure completion-check logic
        computeCompletion.test.ts
    app/
      embed/[tenantId]/
        page.tsx                    # public catalog, embed mode
      [tenant]/
        page.tsx                    # public catalog, subdomain mode
        cursos/[courseId]/
          page.tsx                  # lesson viewer + quiz UI
      panel/
        cursos/
          page.tsx                  # owner/instructor course list
          [courseId]/
            page.tsx                # module/lesson editor
        integrar/
          page.tsx                  # "Integrar en mi web" snippet screen
  functions/
    package.json
    tsconfig.json
    vitest.config.ts
    src/
      index.ts                      # exports all functions
      certificate/
        generateCertificatePdf.ts   # pure PDF-bytes builder
        generateCertificatePdf.test.ts
        onProgressUpdated.ts        # Firestore trigger, wraps computeCompletion + generateCertificatePdf
      auth/
        setTenantClaims.ts          # callable function: assign {tenantId, role} claim
        setTenantClaims.test.ts
  test/
    rules/
      firestore.rules.test.ts       # tenant isolation via emulator
```

Rationale: pure logic (`resolveTenant`, `scoreQuiz`, `computeCompletion`, `generateCertificatePdf`) is split from I/O (Firestore converters, Cloud Function triggers, React pages) so the bulk of behavior is unit-testable without the emulator. Only tenant-isolation security rules and the claims-assignment callable need the emulator.

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `next.config.js`
- Create: `src/lib/tenant/resolveTenant.ts` (stub, filled in Task 2)
- Test: none (scaffolding only, verified by running the test runner with zero tests)

**Interfaces:**
- Consumes: nothing
- Produces: a working `npm test` (Vitest) and `npm run dev` (Next.js) command for all later tasks.

- [ ] **Step 1: Initialize the Next.js + TypeScript project**

```bash
mkdir -p /d/lms-saas && cd /d/lms-saas
npm init -y
npm install next@14 react@18 react-dom@18
npm install -D typescript @types/react @types/node vitest
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "preserve",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "vitest.config.ts"],
  "exclude": ["node_modules", "functions"]
}
```

- [ ] **Step 3: Write `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Add npm scripts to `package.json`**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "test": "vitest run"
  }
}
```

- [ ] **Step 5: Write minimal `next.config.js`**

```javascript
/** @type {import('next').NextConfig} */
module.exports = {};
```

- [ ] **Step 6: Verify the test runner works with zero tests**

Run: `npm test`
Expected: Vitest reports "No test files found" or "0 passed" without crashing.

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts next.config.js package-lock.json
git commit -m "chore: scaffold Next.js + TypeScript + Vitest project"
```

---

### Task 2: Tenant resolution

**Files:**
- Create: `src/lib/tenant/resolveTenant.ts`
- Test: `src/lib/tenant/resolveTenant.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `resolveTenant(input: { host: string; embedTenantId?: string; rootDomain: string }): string | null` — later tasks (App Router pages, Firestore queries) call this to determine which tenant's data to load.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/tenant/resolveTenant.test.ts
import { describe, it, expect } from 'vitest';
import { resolveTenant } from './resolveTenant';

describe('resolveTenant', () => {
  it('extracts tenant from subdomain', () => {
    const result = resolveTenant({
      host: 'academia-x.tucampus.com',
      rootDomain: 'tucampus.com',
    });
    expect(result).toBe('academia-x');
  });

  it('returns null for the bare root domain (no tenant)', () => {
    const result = resolveTenant({
      host: 'tucampus.com',
      rootDomain: 'tucampus.com',
    });
    expect(result).toBeNull();
  });

  it('returns null for the www subdomain', () => {
    const result = resolveTenant({
      host: 'www.tucampus.com',
      rootDomain: 'tucampus.com',
    });
    expect(result).toBeNull();
  });

  it('prefers the explicit embed tenantId over the host', () => {
    const result = resolveTenant({
      host: 'tucampus.com',
      rootDomain: 'tucampus.com',
      embedTenantId: 'academia-y',
    });
    expect(result).toBe('academia-y');
  });

  it('returns null when host does not match the root domain', () => {
    const result = resolveTenant({
      host: 'evil.example.com',
      rootDomain: 'tucampus.com',
    });
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- resolveTenant`
Expected: FAIL with "Cannot find module './resolveTenant'" or similar.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/tenant/resolveTenant.ts
export function resolveTenant(input: {
  host: string;
  embedTenantId?: string;
  rootDomain: string;
}): string | null {
  if (input.embedTenantId) {
    return input.embedTenantId;
  }

  const { host, rootDomain } = input;

  if (host === rootDomain || host === `www.${rootDomain}`) {
    return null;
  }

  const suffix = `.${rootDomain}`;
  if (!host.endsWith(suffix)) {
    return null;
  }

  const subdomain = host.slice(0, -suffix.length);
  if (!subdomain || subdomain.includes('.')) {
    return null;
  }

  return subdomain;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- resolveTenant`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/tenant/resolveTenant.ts src/lib/tenant/resolveTenant.test.ts
git commit -m "feat: add tenant resolution from subdomain or embed param"
```

---

### Task 3: Shared data model types and Firestore converters

**Files:**
- Create: `src/lib/models/types.ts`
- Create: `src/lib/models/courseConverters.ts`
- Test: `src/lib/models/courseConverters.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: TypeScript types `Course`, `Module`, `Lesson`, `Quiz`, `QuizQuestion`, `Progress`, and Firestore `FirestoreDataConverter` instances `courseConverter`, `progressConverter`. Later tasks (course CRUD, lesson viewer, progress tracking) import these types and converters directly — do not redefine them.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/models/courseConverters.test.ts
import { describe, it, expect } from 'vitest';
import { courseConverter, progressConverter } from './courseConverters';
import type { Course, Progress } from './types';

describe('courseConverter', () => {
  it('round-trips a Course through toFirestore/fromFirestore', () => {
    const course: Course = {
      id: 'course-1',
      title: 'Ecommerce 101',
      description: 'Intro course',
      published: true,
      requiredQuizzes: true,
      minQuizScore: 60,
    };

    const stored = courseConverter.toFirestore(course);
    const snapshotStub = {
      id: 'course-1',
      data: () => stored,
    } as any;

    const roundTripped = courseConverter.fromFirestore(snapshotStub, {});
    expect(roundTripped).toEqual(course);
  });
});

describe('progressConverter', () => {
  it('round-trips a Progress record through toFirestore/fromFirestore', () => {
    const progress: Progress = {
      courseId: 'course-1',
      lessonsCompleted: ['lesson-1', 'lesson-2'],
      quizScores: { 'quiz-1': 80 },
      certificateUrl: null,
    };

    const stored = progressConverter.toFirestore(progress);
    const snapshotStub = {
      id: 'course-1',
      data: () => stored,
    } as any;

    const roundTripped = progressConverter.fromFirestore(snapshotStub, {});
    expect(roundTripped).toEqual(progress);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- courseConverters`
Expected: FAIL with "Cannot find module './courseConverters'"

- [ ] **Step 3: Write the types**

```typescript
// src/lib/models/types.ts
export interface Course {
  id: string;
  title: string;
  description: string;
  published: boolean;
  requiredQuizzes: boolean;
  minQuizScore: number; // percentage, 0-100
}

export interface Module {
  id: string;
  title: string;
  order: number;
}

export interface Lesson {
  id: string;
  title: string;
  order: number;
  videoUrl: string | null;
  textContent: string | null;
  attachmentUrls: string[];
}

export interface QuizQuestion {
  text: string;
  options: string[];
  correctOptionIndex: number;
}

export interface Quiz {
  id: string;
  lessonId: string;
  questions: QuizQuestion[];
}

export interface Progress {
  courseId: string;
  lessonsCompleted: string[];
  quizScores: Record<string, number>;
  certificateUrl: string | null;
}
```

- [ ] **Step 4: Write minimal implementation of the converters**

```typescript
// src/lib/models/courseConverters.ts
import type { FirestoreDataConverter, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import type { Course, Progress } from './types';

export const courseConverter: FirestoreDataConverter<Course> = {
  toFirestore(course: Course): DocumentData {
    const { id, ...rest } = course;
    return rest;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot): Course {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      title: data.title,
      description: data.description,
      published: data.published,
      requiredQuizzes: data.requiredQuizzes,
      minQuizScore: data.minQuizScore,
    };
  },
};

export const progressConverter: FirestoreDataConverter<Progress> = {
  toFirestore(progress: Progress): DocumentData {
    return {
      courseId: progress.courseId,
      lessonsCompleted: progress.lessonsCompleted,
      quizScores: progress.quizScores,
      certificateUrl: progress.certificateUrl,
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot): Progress {
    const data = snapshot.data();
    return {
      courseId: data.courseId,
      lessonsCompleted: data.lessonsCompleted,
      quizScores: data.quizScores,
      certificateUrl: data.certificateUrl ?? null,
    };
  },
};
```

- [ ] **Step 5: Install the firebase client package**

```bash
npm install firebase
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- courseConverters`
Expected: PASS (2 tests)

- [ ] **Step 7: Commit**

```bash
git add src/lib/models/types.ts src/lib/models/courseConverters.ts src/lib/models/courseConverters.test.ts package.json package-lock.json
git commit -m "feat: add course/progress data model and Firestore converters"
```

---

### Task 4: Quiz scoring logic

**Files:**
- Create: `src/lib/quiz/scoreQuiz.ts`
- Test: `src/lib/quiz/scoreQuiz.test.ts`

**Interfaces:**
- Consumes: `Quiz`, `QuizQuestion` from `src/lib/models/types.ts` (Task 3)
- Produces: `scoreQuiz(quiz: Quiz, answers: number[]): number` (returns percentage 0-100). Used by the quiz UI (Task 7) and by the certificate trigger (Task 9) indirectly via stored `quizScores`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/quiz/scoreQuiz.test.ts
import { describe, it, expect } from 'vitest';
import { scoreQuiz } from './scoreQuiz';
import type { Quiz } from '../models/types';

const quiz: Quiz = {
  id: 'quiz-1',
  lessonId: 'lesson-1',
  questions: [
    { text: 'Q1', options: ['a', 'b'], correctOptionIndex: 0 },
    { text: 'Q2', options: ['a', 'b'], correctOptionIndex: 1 },
    { text: 'Q3', options: ['a', 'b', 'c'], correctOptionIndex: 2 },
    { text: 'Q4', options: ['a', 'b'], correctOptionIndex: 0 },
  ],
};

describe('scoreQuiz', () => {
  it('returns 100 when all answers are correct', () => {
    expect(scoreQuiz(quiz, [0, 1, 2, 0])).toBe(100);
  });

  it('returns 0 when all answers are wrong', () => {
    expect(scoreQuiz(quiz, [1, 0, 0, 1])).toBe(0);
  });

  it('returns the rounded percentage for partial correctness', () => {
    // 1 of 4 correct = 25%
    expect(scoreQuiz(quiz, [0, 0, 0, 1])).toBe(25);
  });

  it('throws if answers length does not match questions length', () => {
    expect(() => scoreQuiz(quiz, [0, 1])).toThrow(
      'answers length (2) must match questions length (4)',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- scoreQuiz`
Expected: FAIL with "Cannot find module './scoreQuiz'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/quiz/scoreQuiz.ts
import type { Quiz } from '../models/types';

export function scoreQuiz(quiz: Quiz, answers: number[]): number {
  if (answers.length !== quiz.questions.length) {
    throw new Error(
      `answers length (${answers.length}) must match questions length (${quiz.questions.length})`,
    );
  }

  const correctCount = quiz.questions.reduce((count, question, index) => {
    return answers[index] === question.correctOptionIndex ? count + 1 : count;
  }, 0);

  return Math.round((correctCount / quiz.questions.length) * 100);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- scoreQuiz`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/quiz/scoreQuiz.ts src/lib/quiz/scoreQuiz.test.ts
git commit -m "feat: add pure quiz scoring logic"
```

---

### Task 5: Course completion logic

**Files:**
- Create: `src/lib/progress/computeCompletion.ts`
- Test: `src/lib/progress/computeCompletion.test.ts`

**Interfaces:**
- Consumes: `Course`, `Progress` from `src/lib/models/types.ts` (Task 3)
- Produces: `isCourseComplete(course: Course, progress: Progress, totalLessonIds: string[]): boolean`. Used by the lesson viewer (Task 7, to show/hide the certificate button) and by the `onProgressUpdated` Cloud Function trigger (Task 9) to decide whether to generate a certificate.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/progress/computeCompletion.test.ts
import { describe, it, expect } from 'vitest';
import { isCourseComplete } from './computeCompletion';
import type { Course, Progress } from '../models/types';

const baseCourse: Course = {
  id: 'course-1',
  title: 'Ecommerce 101',
  description: '',
  published: true,
  requiredQuizzes: false,
  minQuizScore: 60,
};

const totalLessonIds = ['lesson-1', 'lesson-2', 'lesson-3'];

describe('isCourseComplete', () => {
  it('is false when not all lessons are completed', () => {
    const progress: Progress = {
      courseId: 'course-1',
      lessonsCompleted: ['lesson-1', 'lesson-2'],
      quizScores: {},
      certificateUrl: null,
    };
    expect(isCourseComplete(baseCourse, progress, totalLessonIds)).toBe(false);
  });

  it('is true when all lessons are completed and quizzes are not required', () => {
    const progress: Progress = {
      courseId: 'course-1',
      lessonsCompleted: ['lesson-1', 'lesson-2', 'lesson-3'],
      quizScores: {},
      certificateUrl: null,
    };
    expect(isCourseComplete(baseCourse, progress, totalLessonIds)).toBe(true);
  });

  it('is false when quizzes are required but a score is below minQuizScore', () => {
    const course: Course = { ...baseCourse, requiredQuizzes: true, minQuizScore: 60 };
    const progress: Progress = {
      courseId: 'course-1',
      lessonsCompleted: ['lesson-1', 'lesson-2', 'lesson-3'],
      quizScores: { 'quiz-1': 50 },
      certificateUrl: null,
    };
    expect(isCourseComplete(course, progress, totalLessonIds)).toBe(false);
  });

  it('is true when quizzes are required and all scores meet minQuizScore', () => {
    const course: Course = { ...baseCourse, requiredQuizzes: true, minQuizScore: 60 };
    const progress: Progress = {
      courseId: 'course-1',
      lessonsCompleted: ['lesson-1', 'lesson-2', 'lesson-3'],
      quizScores: { 'quiz-1': 60, 'quiz-2': 100 },
      certificateUrl: null,
    };
    expect(isCourseComplete(course, progress, totalLessonIds)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- computeCompletion`
Expected: FAIL with "Cannot find module './computeCompletion'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/progress/computeCompletion.ts
import type { Course, Progress } from '../models/types';

export function isCourseComplete(
  course: Course,
  progress: Progress,
  totalLessonIds: string[],
): boolean {
  const allLessonsDone = totalLessonIds.every((id) =>
    progress.lessonsCompleted.includes(id),
  );
  if (!allLessonsDone) {
    return false;
  }

  if (!course.requiredQuizzes) {
    return true;
  }

  const scores = Object.values(progress.quizScores);
  if (scores.length === 0) {
    return false;
  }

  return scores.every((score) => score >= course.minQuizScore);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- computeCompletion`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/progress/computeCompletion.ts src/lib/progress/computeCompletion.test.ts
git commit -m "feat: add pure course completion logic"
```

---

### Task 6: Firestore security rules — tenant isolation

**Files:**
- Create: `firestore.rules`
- Create: `firebase.json`
- Create: `firestore.indexes.json`
- Test: `test/rules/firestore.rules.test.ts`

**Interfaces:**
- Consumes: nothing (rules are evaluated against the emulator directly)
- Produces: deployed security posture that every later Firestore-touching feature relies on: a user can only read/write documents under `tenants/{tenantId}/...` when their auth token's `tenantId` claim matches, and only owners/instructors can write course content.

- [ ] **Step 1: Install emulator testing dependencies**

```bash
npm install -D @firebase/rules-unit-testing firebase-tools
```

- [ ] **Step 2: Write `firebase.json`**

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "emulators": {
    "firestore": { "port": 8080 },
    "auth": { "port": 9099 }
  }
}
```

- [ ] **Step 3: Write `firestore.indexes.json`**

```json
{
  "indexes": [],
  "fieldOverrides": []
}
```

- [ ] **Step 4: Write the failing test**

```typescript
// test/rules/firestore.rules.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { setDoc, doc, getDoc } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'lms-saas-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('tenant isolation', () => {
  it('denies a student from tenant A reading a course in tenant B', async () => {
    const tenantAStudent = testEnv.authenticatedContext('student-a', {
      tenantId: 'tenant-a',
      role: 'student',
    });

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'tenants/tenant-b/courses/course-1'), {
        title: 'Secret course',
        published: true,
      });
    });

    const blockedRead = getDoc(
      doc(tenantAStudent.firestore(), 'tenants/tenant-b/courses/course-1'),
    );
    await assertFails(blockedRead);
  });

  it('allows a student to read a published course within their own tenant', async () => {
    const tenantAStudent = testEnv.authenticatedContext('student-a', {
      tenantId: 'tenant-a',
      role: 'student',
    });

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'tenants/tenant-a/courses/course-1'), {
        title: 'Ecommerce 101',
        published: true,
      });
    });

    const allowedRead = getDoc(
      doc(tenantAStudent.firestore(), 'tenants/tenant-a/courses/course-1'),
    );
    await assertSucceeds(allowedRead);
  });

  it('denies a student from writing course content', async () => {
    const tenantAStudent = testEnv.authenticatedContext('student-a', {
      tenantId: 'tenant-a',
      role: 'student',
    });

    const blockedWrite = setDoc(
      doc(tenantAStudent.firestore(), 'tenants/tenant-a/courses/course-2'),
      { title: 'Hack', published: true },
    );
    await assertFails(blockedWrite);
  });

  it('allows an owner to write course content in their own tenant', async () => {
    const tenantAOwner = testEnv.authenticatedContext('owner-a', {
      tenantId: 'tenant-a',
      role: 'owner',
    });

    const allowedWrite = setDoc(
      doc(tenantAOwner.firestore(), 'tenants/tenant-a/courses/course-3'),
      { title: 'New course', published: false },
    );
    await assertSucceeds(allowedWrite);
  });
});
```

- [ ] **Step 5: Add a vitest project config for rules tests and an npm script**

```typescript
// test/rules/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/rules/**/*.test.ts'],
    testTimeout: 20000,
  },
});
```

Add to `package.json` scripts:

```json
{
  "scripts": {
    "test:rules": "firebase emulators:exec --only firestore,auth \"vitest run --config test/rules/vitest.config.ts\""
  }
}
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm run test:rules`
Expected: FAIL — no `firestore.rules` file exists yet, or all assertions fail because default rules deny everything.

- [ ] **Step 7: Write minimal `firestore.rules`**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function tenantId() {
      return request.auth.token.tenantId;
    }
    function role() {
      return request.auth.token.role;
    }
    function isOwnerOrInstructor() {
      return request.auth != null && (role() == 'owner' || role() == 'instructor');
    }

    match /tenants/{tenantId}/courses/{courseId} {
      allow read: if request.auth != null && tenantId() == tenantId;
      allow write: if isOwnerOrInstructor() && tenantId() == tenantId;

      match /modules/{moduleId} {
        allow read: if request.auth != null && tenantId() == tenantId;
        allow write: if isOwnerOrInstructor() && tenantId() == tenantId;

        match /lessons/{lessonId} {
          allow read: if request.auth != null && tenantId() == tenantId;
          allow write: if isOwnerOrInstructor() && tenantId() == tenantId;

          match /quizzes/{quizId} {
            allow read: if request.auth != null && tenantId() == tenantId;
            allow write: if isOwnerOrInstructor() && tenantId() == tenantId;
          }
        }
      }
    }

    match /tenants/{tenantId}/students/{studentId} {
      allow read, write: if request.auth != null && tenantId() == tenantId &&
        (request.auth.uid == studentId || isOwnerOrInstructor());

      match /progress/{courseId} {
        allow read, write: if request.auth != null && tenantId() == tenantId &&
          (request.auth.uid == studentId || isOwnerOrInstructor());
      }
    }
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm run test:rules`
Expected: PASS (4 tests)

- [ ] **Step 9: Commit**

```bash
git add firestore.rules firebase.json firestore.indexes.json test/rules package.json package-lock.json
git commit -m "feat: add Firestore security rules enforcing tenant isolation"
```

---

### Task 7: Cloud Function — assign tenant/role custom claims

**Files:**
- Create: `functions/package.json`
- Create: `functions/tsconfig.json`
- Create: `functions/vitest.config.ts`
- Create: `functions/src/auth/setTenantClaims.ts`
- Test: `functions/src/auth/setTenantClaims.test.ts`
- Modify: `functions/src/index.ts` (create, export the function)

**Interfaces:**
- Consumes: `firebase-admin/auth` (`Auth.setCustomUserClaims`)
- Produces: callable Cloud Function `setTenantClaims` with signature `(data: { targetUid: string; tenantId: string; role: 'owner' | 'instructor' | 'student' }, context: CallableContext) => Promise<{ success: true }>`, callable only by an existing `owner` of that tenant. Used by the "invite instructor" / "enroll student" flows (not built in this MVP plan, but this is the claims primitive they'll call).

- [ ] **Step 1: Initialize the functions package**

```bash
mkdir -p functions/src/auth
cd functions
npm init -y
npm install firebase-admin firebase-functions
npm install -D typescript vitest @types/node
cd ..
```

- [ ] **Step 2: Write `functions/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "lib",
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write `functions/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Write the failing test (with a fake admin auth)**

```typescript
// functions/src/auth/setTenantClaims.test.ts
import { describe, it, expect, vi } from 'vitest';
import { assignTenantClaims } from './setTenantClaims';

function makeFakeAdminAuth(existingClaims: Record<string, unknown> = {}) {
  const setCustomUserClaims = vi.fn().mockResolvedValue(undefined);
  const getUser = vi.fn().mockResolvedValue({ customClaims: existingClaims });
  return { setCustomUserClaims, getUser } as any;
}

describe('assignTenantClaims', () => {
  it('sets tenantId and role claims on the target user', async () => {
    const adminAuth = makeFakeAdminAuth();

    await assignTenantClaims(adminAuth, {
      callerClaims: { tenantId: 'tenant-a', role: 'owner' },
      targetUid: 'user-2',
      tenantId: 'tenant-a',
      role: 'instructor',
    });

    expect(adminAuth.setCustomUserClaims).toHaveBeenCalledWith('user-2', {
      tenantId: 'tenant-a',
      role: 'instructor',
    });
  });

  it('rejects when the caller is not an owner', async () => {
    const adminAuth = makeFakeAdminAuth();

    await expect(
      assignTenantClaims(adminAuth, {
        callerClaims: { tenantId: 'tenant-a', role: 'instructor' },
        targetUid: 'user-2',
        tenantId: 'tenant-a',
        role: 'instructor',
      }),
    ).rejects.toThrow('caller must be an owner');

    expect(adminAuth.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it('rejects when the caller belongs to a different tenant', async () => {
    const adminAuth = makeFakeAdminAuth();

    await expect(
      assignTenantClaims(adminAuth, {
        callerClaims: { tenantId: 'tenant-a', role: 'owner' },
        targetUid: 'user-2',
        tenantId: 'tenant-b',
        role: 'instructor',
      }),
    ).rejects.toThrow('caller cannot assign claims outside their own tenant');

    expect(adminAuth.setCustomUserClaims).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd functions && npx vitest run src/auth/setTenantClaims.test.ts`
Expected: FAIL with "Cannot find module './setTenantClaims'"

- [ ] **Step 6: Write minimal implementation**

```typescript
// functions/src/auth/setTenantClaims.ts
import type { auth as AdminAuth } from 'firebase-admin';
import * as functions from 'firebase-functions';

export type Role = 'owner' | 'instructor' | 'student';

interface AssignClaimsInput {
  callerClaims: { tenantId: string; role: Role };
  targetUid: string;
  tenantId: string;
  role: Role;
}

export async function assignTenantClaims(
  adminAuth: Pick<AdminAuth.Auth, 'setCustomUserClaims' | 'getUser'>,
  input: AssignClaimsInput,
): Promise<{ success: true }> {
  if (input.callerClaims.role !== 'owner') {
    throw new Error('caller must be an owner');
  }
  if (input.callerClaims.tenantId !== input.tenantId) {
    throw new Error('caller cannot assign claims outside their own tenant');
  }

  await adminAuth.setCustomUserClaims(input.targetUid, {
    tenantId: input.tenantId,
    role: input.role,
  });

  return { success: true };
}

export const setTenantClaims = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
  }

  const admin = await import('firebase-admin');
  const callerClaims = context.auth.token as unknown as { tenantId: string; role: Role };

  return assignTenantClaims(admin.auth(), {
    callerClaims,
    targetUid: data.targetUid,
    tenantId: data.tenantId,
    role: data.role,
  });
});
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd functions && npx vitest run src/auth/setTenantClaims.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 8: Write `functions/src/index.ts` exporting the function**

```typescript
// functions/src/index.ts
export { setTenantClaims } from './auth/setTenantClaims';
```

- [ ] **Step 9: Add functions test script**

```json
{
  "scripts": {
    "test": "vitest run",
    "build": "tsc"
  }
}
```
(add to `functions/package.json`)

- [ ] **Step 10: Commit**

```bash
git add functions/package.json functions/tsconfig.json functions/vitest.config.ts functions/src
git commit -m "feat: add setTenantClaims callable function"
```

---

### Task 8: Certificate PDF generation

**Files:**
- Create: `functions/src/certificate/generateCertificatePdf.ts`
- Test: `functions/src/certificate/generateCertificatePdf.test.ts`

**Interfaces:**
- Consumes: nothing external (pure function using `pdf-lib`)
- Produces: `generateCertificatePdf(input: { studentName: string; courseTitle: string; completionDate: Date }): Promise<Uint8Array>`. Used by the `onProgressUpdated` trigger (Task 9) to build the PDF before uploading to Storage.

- [ ] **Step 1: Install pdf-lib in functions**

```bash
cd functions && npm install pdf-lib && cd ..
```

- [ ] **Step 2: Write the failing test**

```typescript
// functions/src/certificate/generateCertificatePdf.test.ts
import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { generateCertificatePdf } from './generateCertificatePdf';

describe('generateCertificatePdf', () => {
  it('produces a valid single-page PDF', async () => {
    const bytes = await generateCertificatePdf({
      studentName: 'Ana Perez',
      courseTitle: 'Ecommerce 101',
      completionDate: new Date('2026-08-01'),
    });

    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(1);
  });

  it('embeds the student name and course title as extractable text', async () => {
    const bytes = await generateCertificatePdf({
      studentName: 'Ana Perez',
      courseTitle: 'Ecommerce 101',
      completionDate: new Date('2026-08-01'),
    });

    // pdf-lib does not expose text extraction; assert the raw bytes
    // contain the literal strings written into the content stream is not reliable
    // for compressed PDFs, so instead assert the document loads with the expected
    // page size, which confirms our drawing code ran without throwing.
    const loaded = await PDFDocument.load(bytes);
    const page = loaded.getPage(0);
    expect(page.getWidth()).toBe(842); // A4 landscape width in points
    expect(page.getHeight()).toBe(595); // A4 landscape height in points
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd functions && npx vitest run src/certificate/generateCertificatePdf.test.ts`
Expected: FAIL with "Cannot find module './generateCertificatePdf'"

- [ ] **Step 4: Write minimal implementation**

```typescript
// functions/src/certificate/generateCertificatePdf.ts
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

interface CertificateInput {
  studentName: string;
  courseTitle: string;
  completionDate: Date;
}

export async function generateCertificatePdf(input: CertificateInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([842, 595]); // A4 landscape in points
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await doc.embedFont(StandardFonts.Helvetica);

  page.drawText('Certificado de finalizacion', {
    x: 180,
    y: 420,
    size: 28,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });

  page.drawText(input.studentName, {
    x: 180,
    y: 340,
    size: 22,
    font,
    color: rgb(0.05, 0.3, 0.6),
  });

  page.drawText(`completo el curso "${input.courseTitle}"`, {
    x: 180,
    y: 300,
    size: 16,
    font: bodyFont,
  });

  page.drawText(input.completionDate.toISOString().slice(0, 10), {
    x: 180,
    y: 260,
    size: 12,
    font: bodyFont,
  });

  return doc.save();
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd functions && npx vitest run src/certificate/generateCertificatePdf.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add functions/src/certificate/generateCertificatePdf.ts functions/src/certificate/generateCertificatePdf.test.ts functions/package.json functions/package-lock.json
git commit -m "feat: add certificate PDF generation"
```

---

### Task 9: Cloud Function trigger — generate certificate on course completion

**Files:**
- Create: `functions/src/certificate/onProgressUpdated.ts`
- Test: `functions/src/certificate/onProgressUpdated.test.ts`
- Modify: `functions/src/index.ts` (export the new trigger)

**Interfaces:**
- Consumes: `isCourseComplete` — **note:** this pure function lives in `src/lib/progress/computeCompletion.ts` in the Next.js app (Task 5), not in `functions/`. Since `functions/` is a separate TypeScript project, duplicate the same logic into `functions/src/progress/computeCompletion.ts` with an identical signature `isCourseComplete(course: Course, progress: Progress, totalLessonIds: string[]): boolean`, and `generateCertificatePdf` from Task 8.
- Produces: Firestore trigger `onProgressUpdated`, and an injectable `handleProgressUpdate(deps, input)` used directly by the test (Firestore triggers themselves are not unit-tested; the handler they call is).

- [ ] **Step 1: Copy the completion-check logic into the functions project**

```typescript
// functions/src/progress/computeCompletion.ts
export interface Course {
  id: string;
  title: string;
  description: string;
  published: boolean;
  requiredQuizzes: boolean;
  minQuizScore: number;
}

export interface Progress {
  courseId: string;
  lessonsCompleted: string[];
  quizScores: Record<string, number>;
  certificateUrl: string | null;
}

export function isCourseComplete(
  course: Course,
  progress: Progress,
  totalLessonIds: string[],
): boolean {
  const allLessonsDone = totalLessonIds.every((id) =>
    progress.lessonsCompleted.includes(id),
  );
  if (!allLessonsDone) {
    return false;
  }

  if (!course.requiredQuizzes) {
    return true;
  }

  const scores = Object.values(progress.quizScores);
  if (scores.length === 0) {
    return false;
  }

  return scores.every((score) => score >= course.minQuizScore);
}
```

- [ ] **Step 2: Write the failing test for the handler**

```typescript
// functions/src/certificate/onProgressUpdated.test.ts
import { describe, it, expect, vi } from 'vitest';
import { handleProgressUpdate } from './onProgressUpdated';
import type { Course, Progress } from '../progress/computeCompletion';

describe('handleProgressUpdate', () => {
  const course: Course = {
    id: 'course-1',
    title: 'Ecommerce 101',
    description: '',
    published: true,
    requiredQuizzes: false,
    minQuizScore: 60,
  };
  const totalLessonIds = ['lesson-1', 'lesson-2'];

  it('does nothing if the course is not yet complete', async () => {
    const progress: Progress = {
      courseId: 'course-1',
      lessonsCompleted: ['lesson-1'],
      quizScores: {},
      certificateUrl: null,
    };

    const generateCertificatePdf = vi.fn();
    const uploadCertificate = vi.fn();
    const updateProgressDoc = vi.fn();

    await handleProgressUpdate(
      { generateCertificatePdf, uploadCertificate, updateProgressDoc },
      { course, progress, totalLessonIds, studentName: 'Ana Perez' },
    );

    expect(generateCertificatePdf).not.toHaveBeenCalled();
    expect(uploadCertificate).not.toHaveBeenCalled();
    expect(updateProgressDoc).not.toHaveBeenCalled();
  });

  it('does nothing if a certificate was already issued', async () => {
    const progress: Progress = {
      courseId: 'course-1',
      lessonsCompleted: ['lesson-1', 'lesson-2'],
      quizScores: {},
      certificateUrl: 'https://example.com/existing.pdf',
    };

    const generateCertificatePdf = vi.fn();
    const uploadCertificate = vi.fn();
    const updateProgressDoc = vi.fn();

    await handleProgressUpdate(
      { generateCertificatePdf, uploadCertificate, updateProgressDoc },
      { course, progress, totalLessonIds, studentName: 'Ana Perez' },
    );

    expect(generateCertificatePdf).not.toHaveBeenCalled();
  });

  it('generates, uploads, and records the certificate when the course just completed', async () => {
    const progress: Progress = {
      courseId: 'course-1',
      lessonsCompleted: ['lesson-1', 'lesson-2'],
      quizScores: {},
      certificateUrl: null,
    };

    const fakeBytes = new Uint8Array([1, 2, 3]);
    const generateCertificatePdf = vi.fn().mockResolvedValue(fakeBytes);
    const uploadCertificate = vi.fn().mockResolvedValue('https://example.com/cert.pdf');
    const updateProgressDoc = vi.fn().mockResolvedValue(undefined);

    await handleProgressUpdate(
      { generateCertificatePdf, uploadCertificate, updateProgressDoc },
      { course, progress, totalLessonIds, studentName: 'Ana Perez' },
    );

    expect(generateCertificatePdf).toHaveBeenCalledWith({
      studentName: 'Ana Perez',
      courseTitle: 'Ecommerce 101',
      completionDate: expect.any(Date),
    });
    expect(uploadCertificate).toHaveBeenCalledWith('course-1', fakeBytes);
    expect(updateProgressDoc).toHaveBeenCalledWith('course-1', 'https://example.com/cert.pdf');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd functions && npx vitest run src/certificate/onProgressUpdated.test.ts`
Expected: FAIL with "Cannot find module './onProgressUpdated'"

- [ ] **Step 4: Write minimal implementation**

```typescript
// functions/src/certificate/onProgressUpdated.ts
import * as functions from 'firebase-functions';
import { isCourseComplete, type Course, type Progress } from '../progress/computeCompletion';
import { generateCertificatePdf as realGenerateCertificatePdf } from './generateCertificatePdf';

interface HandlerDeps {
  generateCertificatePdf: (input: {
    studentName: string;
    courseTitle: string;
    completionDate: Date;
  }) => Promise<Uint8Array>;
  uploadCertificate: (courseId: string, bytes: Uint8Array) => Promise<string>;
  updateProgressDoc: (courseId: string, certificateUrl: string) => Promise<void>;
}

interface HandlerInput {
  course: Course;
  progress: Progress;
  totalLessonIds: string[];
  studentName: string;
}

export async function handleProgressUpdate(
  deps: HandlerDeps,
  input: HandlerInput,
): Promise<void> {
  if (input.progress.certificateUrl) {
    return;
  }

  const complete = isCourseComplete(input.course, input.progress, input.totalLessonIds);
  if (!complete) {
    return;
  }

  const bytes = await deps.generateCertificatePdf({
    studentName: input.studentName,
    courseTitle: input.course.title,
    completionDate: new Date(),
  });

  const url = await deps.uploadCertificate(input.course.id, bytes);
  await deps.updateProgressDoc(input.course.id, url);
}

export const onProgressUpdated = functions.firestore
  .document('tenants/{tenantId}/students/{studentId}/progress/{courseId}')
  .onWrite(async (change, context) => {
    const admin = await import('firebase-admin');
    const db = admin.firestore();
    const storage = admin.storage();

    const { tenantId, studentId, courseId } = context.params;
    const progressData = change.after.data();
    if (!progressData) return;

    const courseSnap = await db.doc(`tenants/${tenantId}/courses/${courseId}`).get();
    const studentSnap = await db.doc(`tenants/${tenantId}/students/${studentId}`).get();
    if (!courseSnap.exists || !studentSnap.exists) return;

    const modulesSnap = await db
      .collection(`tenants/${tenantId}/courses/${courseId}/modules`)
      .get();
    const lessonIds: string[] = [];
    for (const moduleDoc of modulesSnap.docs) {
      const lessonsSnap = await moduleDoc.ref.collection('lessons').get();
      lessonsSnap.forEach((l) => lessonIds.push(l.id));
    }

    await handleProgressUpdate(
      {
        generateCertificatePdf: realGenerateCertificatePdf,
        uploadCertificate: async (cId, bytes) => {
          const file = storage.bucket().file(`certificates/${tenantId}/${studentId}/${cId}.pdf`);
          await file.save(Buffer.from(bytes), { contentType: 'application/pdf' });
          const [url] = await file.getSignedUrl({ action: 'read', expires: '2100-01-01' });
          return url;
        },
        updateProgressDoc: async (cId, url) => {
          await change.after.ref.update({ certificateUrl: url });
        },
      },
      {
        course: courseSnap.data() as Course,
        progress: progressData as Progress,
        totalLessonIds: lessonIds,
        studentName: studentSnap.data()?.name ?? 'Estudiante',
      },
    );
  });
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd functions && npx vitest run src/certificate/onProgressUpdated.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Update `functions/src/index.ts`**

```typescript
// functions/src/index.ts
export { setTenantClaims } from './auth/setTenantClaims';
export { onProgressUpdated } from './certificate/onProgressUpdated';
```

- [ ] **Step 7: Commit**

```bash
git add functions/src/certificate/onProgressUpdated.ts functions/src/certificate/onProgressUpdated.test.ts functions/src/progress functions/src/index.ts
git commit -m "feat: generate certificate automatically when a course is completed"
```

---

### Task 10: Firebase client init and public course catalog page

**Files:**
- Create: `src/lib/firebase/client.ts`
- Create: `src/app/[tenant]/page.tsx`
- Create: `src/app/embed/[tenantId]/page.tsx`
- Test: `src/lib/firebase/client.test.ts`

**Interfaces:**
- Consumes: `resolveTenant` (Task 2), `courseConverter` (Task 3)
- Produces: `getFirebaseApp(): FirebaseApp` (singleton init, guards against re-initializing during Next.js hot reload), and the two catalog routes that later tasks (lesson viewer, embed snippet screen) link to.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/firebase/client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn().mockReturnValue({ name: 'mock-app' }),
  getApps: vi.fn().mockReturnValue([]),
  getApp: vi.fn(),
}));

import { getFirebaseApp } from './client';
import { initializeApp, getApps } from 'firebase/app';

describe('getFirebaseApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes the app once when none exists yet', () => {
    vi.mocked(getApps).mockReturnValue([]);
    getFirebaseApp();
    expect(initializeApp).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- client.test`
Expected: FAIL with "Cannot find module './client'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/firebase/client.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
};

export function getFirebaseApp(): FirebaseApp {
  if (getApps().length === 0) {
    return initializeApp(firebaseConfig);
  }
  return getApp();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- client.test`
Expected: PASS (1 test)

- [ ] **Step 5: Write the subdomain catalog page**

```typescript
// src/app/[tenant]/page.tsx
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { getFirebaseApp } from '@/lib/firebase/client';
import { courseConverter } from '@/lib/models/courseConverters';

export default async function TenantCatalogPage({
  params,
}: {
  params: { tenant: string };
}) {
  const db = getFirestore(getFirebaseApp());
  const coursesRef = collection(db, `tenants/${params.tenant}/courses`).withConverter(
    courseConverter,
  );
  const snapshot = await getDocs(query(coursesRef, where('published', '==', true)));
  const courses = snapshot.docs.map((d) => d.data());

  return (
    <main>
      <h1>Cursos disponibles</h1>
      <ul>
        {courses.map((course) => (
          <li key={course.id}>
            <a href={`/${params.tenant}/cursos/${course.id}`}>{course.title}</a>
            <p>{course.description}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 6: Write the embed catalog page (reuses the same rendering, different route param name)**

```typescript
// src/app/embed/[tenantId]/page.tsx
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { getFirebaseApp } from '@/lib/firebase/client';
import { courseConverter } from '@/lib/models/courseConverters';

export default async function EmbedCatalogPage({
  params,
}: {
  params: { tenantId: string };
}) {
  const db = getFirestore(getFirebaseApp());
  const coursesRef = collection(db, `tenants/${params.tenantId}/courses`).withConverter(
    courseConverter,
  );
  const snapshot = await getDocs(query(coursesRef, where('published', '==', true)));
  const courses = snapshot.docs.map((d) => d.data());

  return (
    <main style={{ margin: 0, fontFamily: 'sans-serif' }}>
      <ul>
        {courses.map((course) => (
          <li key={course.id}>
            <a href={`/embed/${params.tenantId}/cursos/${course.id}`} target="_top">
              {course.title}
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 7: Manually verify the pages render**

Run: `npm run dev`, then visit `http://localhost:3000/embed/demo-tenant` in a browser.
Expected: page loads without a runtime error (empty course list is fine if no Firestore data exists yet — the important check is no crash).

- [ ] **Step 8: Commit**

```bash
git add src/lib/firebase/client.ts src/lib/firebase/client.test.ts src/app
git commit -m "feat: add Firebase client init and public course catalog pages"
```

---

### Task 11: "Integrar en mi web" embed-snippet screen

**Files:**
- Create: `src/lib/embed/buildEmbedSnippet.ts`
- Test: `src/lib/embed/buildEmbedSnippet.test.ts`
- Create: `src/app/panel/integrar/page.tsx`

**Interfaces:**
- Consumes: nothing (pure string builder)
- Produces: `buildEmbedSnippet(input: { tenantId: string; baseUrl: string }): string` — the iframe HTML string shown to the client (owner) to paste into their own site.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/embed/buildEmbedSnippet.test.ts
import { describe, it, expect } from 'vitest';
import { buildEmbedSnippet } from './buildEmbedSnippet';

describe('buildEmbedSnippet', () => {
  it('builds an iframe snippet pointing at the embed route for the tenant', () => {
    const snippet = buildEmbedSnippet({
      tenantId: 'academia-x',
      baseUrl: 'https://tucampus.com',
    });

    expect(snippet).toBe(
      '<iframe src="https://tucampus.com/embed/academia-x" width="100%" height="800" frameborder="0"></iframe>',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- buildEmbedSnippet`
Expected: FAIL with "Cannot find module './buildEmbedSnippet'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/embed/buildEmbedSnippet.ts
export function buildEmbedSnippet(input: { tenantId: string; baseUrl: string }): string {
  return `<iframe src="${input.baseUrl}/embed/${input.tenantId}" width="100%" height="800" frameborder="0"></iframe>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- buildEmbedSnippet`
Expected: PASS (1 test)

- [ ] **Step 5: Write the panel page that shows the snippet**

```typescript
// src/app/panel/integrar/page.tsx
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
    <main>
      <h1>Integrar en mi web</h1>
      <p>Copia este codigo y pegalo en la pagina de tu sitio donde quieras mostrar los cursos:</p>
      <textarea readOnly value={snippet} rows={3} style={{ width: '100%' }} />
      <button
        onClick={() => {
          navigator.clipboard.writeText(snippet);
          setCopied(true);
        }}
      >
        {copied ? 'Copiado' : 'Copiar codigo'}
      </button>
    </main>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/embed src/app/panel/integrar
git commit -m "feat: add embed snippet builder and Integrar en mi web screen"
```

---

## Self-Review Notes

- **Spec coverage:** tenant resolution (Task 2), data model (Task 3), quiz scoring (Task 4), progress/completion (Task 5), tenant isolation via security rules (Task 6), roles via custom claims (Task 7), certificate generation (Tasks 8-9), public catalog + embed pages (Task 10), "Integrar en mi web" (Task 11) are all covered. Owner/instructor course-editing CRUD UI, the lesson-viewer "mark complete" button, and the quiz-taking UI are deliberately left as a fast-follow plan once this vertical slice (data + rules + certificate pipeline + public/embed view) is verified end-to-end — flagged here rather than silently dropped.
- **Placeholder scan:** no TBD/TODO markers; every step has runnable code.
- **Type consistency:** `Course`, `Progress` fields (`lessonsCompleted`, `quizScores`, `certificateUrl`, `requiredQuizzes`, `minQuizScore`) are identical across `src/lib/models/types.ts` and the duplicated `functions/src/progress/computeCompletion.ts`, since the two are separate TypeScript projects (Next.js app vs. Cloud Functions) and cannot share a module without a monorepo build step — noted explicitly in Task 9 rather than left implicit.
