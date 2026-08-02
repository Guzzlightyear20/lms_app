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
