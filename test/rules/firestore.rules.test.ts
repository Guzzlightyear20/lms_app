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
        published: false,
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

  it('denies a student from tenant A reading a nested lesson in tenant B', async () => {
    const tenantAStudent = testEnv.authenticatedContext('student-a', {
      tenantId: 'tenant-a',
      role: 'student',
    });

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(
          context.firestore(),
          'tenants/tenant-b/courses/course-1/modules/module-1/lessons/lesson-1',
        ),
        { title: 'Secret lesson' },
      );
    });

    const blockedRead = getDoc(
      doc(
        tenantAStudent.firestore(),
        'tenants/tenant-b/courses/course-1/modules/module-1/lessons/lesson-1',
      ),
    );
    await assertFails(blockedRead);
  });

  it('denies an owner from tenant A writing course content in tenant B', async () => {
    const tenantAOwner = testEnv.authenticatedContext('owner-a', {
      tenantId: 'tenant-a',
      role: 'owner',
    });

    const blockedWrite = setDoc(
      doc(tenantAOwner.firestore(), 'tenants/tenant-b/courses/course-4'),
      { title: 'Cross-tenant hack', published: false },
    );
    await assertFails(blockedWrite);
  });

  it('allows an unauthenticated visitor to read a published course', async () => {
    const anonymous = testEnv.unauthenticatedContext();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'tenants/tenant-a/courses/course-5'), {
        title: 'Public course',
        published: true,
      });
    });

    const allowedRead = getDoc(doc(anonymous.firestore(), 'tenants/tenant-a/courses/course-5'));
    await assertSucceeds(allowedRead);
  });

  it('denies an unauthenticated visitor from reading an unpublished course', async () => {
    const anonymous = testEnv.unauthenticatedContext();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'tenants/tenant-a/courses/course-6'), {
        title: 'Draft course',
        published: false,
      });
    });

    const blockedRead = getDoc(doc(anonymous.firestore(), 'tenants/tenant-a/courses/course-6'));
    await assertFails(blockedRead);
  });

  it('denies a student from writing certificateUrl directly on their own progress', async () => {
    const tenantAStudent = testEnv.authenticatedContext('student-a', {
      tenantId: 'tenant-a',
      role: 'student',
    });

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), 'tenants/tenant-a/students/student-a/progress/course-1'),
        { courseId: 'course-1', lessonsCompleted: [], quizScores: {}, certificateUrl: null },
      );
    });

    const forgedWrite = setDoc(
      doc(tenantAStudent.firestore(), 'tenants/tenant-a/students/student-a/progress/course-1'),
      { courseId: 'course-1', lessonsCompleted: [], quizScores: {}, certificateUrl: 'https://evil.example/fake.pdf' },
      { merge: true },
    );
    await assertFails(forgedWrite);
  });
});
