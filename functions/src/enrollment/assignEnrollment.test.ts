import { describe, it, expect, vi } from 'vitest';
import { assignEnrollment } from './assignEnrollment';

function makeDeps(overrides: Partial<{
  getUserByEmail: ReturnType<typeof vi.fn>;
  courseExists: ReturnType<typeof vi.fn>;
  setCustomUserClaims: ReturnType<typeof vi.fn>;
  progressExists: ReturnType<typeof vi.fn>;
  createProgress: ReturnType<typeof vi.fn>;
}> = {}) {
  return {
    getUserByEmail: vi.fn().mockResolvedValue({
      uid: 'student-uid-1',
      email: 'alumno@example.com',
      displayName: 'Alumno Uno',
      existingClaims: null,
    }),
    courseExists: vi.fn().mockResolvedValue(true),
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

  it('resolves the student by email, assigns claims, creates the parent student doc and a new progress record', async () => {
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
    expect(deps.createProgress).toHaveBeenCalledWith('tenant-a', 'student-uid-1', 'course-1', {
      email: 'alumno@example.com',
      displayName: 'Alumno Uno',
    });
    expect(result).toEqual({ success: true, studentUid: 'student-uid-1' });
  });

  it('rejects enrollment when the course does not exist', async () => {
    const deps = makeDeps({ courseExists: vi.fn().mockResolvedValue(false) });

    await expect(
      assignEnrollment(deps, {
        callerClaims: { tenantId: 'tenant-a', role: 'owner' },
        email: 'alumno@example.com',
        courseId: 'nonexistent-course',
      }),
    ).rejects.toThrow('course not found');

    expect(deps.setCustomUserClaims).not.toHaveBeenCalled();
    expect(deps.createProgress).not.toHaveBeenCalled();
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

  it('rejects enrolling a target user who is already an owner', async () => {
    const deps = makeDeps({
      getUserByEmail: vi.fn().mockResolvedValue({
        uid: 'owner-uid-1',
        email: 'owner@example.com',
        displayName: 'Owner',
        existingClaims: { tenantId: 'tenant-a', role: 'owner' },
      }),
    });

    await expect(
      assignEnrollment(deps, {
        callerClaims: { tenantId: 'tenant-a', role: 'instructor' },
        email: 'owner@example.com',
        courseId: 'course-1',
      }),
    ).rejects.toThrow('target user is an owner or instructor and cannot be enrolled as a student');

    expect(deps.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it('rejects enrolling a target user who is already an instructor', async () => {
    const deps = makeDeps({
      getUserByEmail: vi.fn().mockResolvedValue({
        uid: 'instructor-uid-1',
        email: 'instructor@example.com',
        displayName: 'Instructor',
        existingClaims: { tenantId: 'tenant-a', role: 'instructor' },
      }),
    });

    await expect(
      assignEnrollment(deps, {
        callerClaims: { tenantId: 'tenant-a', role: 'owner' },
        email: 'instructor@example.com',
        courseId: 'course-1',
      }),
    ).rejects.toThrow('target user is an owner or instructor and cannot be enrolled as a student');
  });

  it('rejects enrolling a target user who belongs to a different tenant', async () => {
    const deps = makeDeps({
      getUserByEmail: vi.fn().mockResolvedValue({
        uid: 'other-tenant-uid',
        email: 'otro@example.com',
        displayName: null,
        existingClaims: { tenantId: 'tenant-b', role: 'student' },
      }),
    });

    await expect(
      assignEnrollment(deps, {
        callerClaims: { tenantId: 'tenant-a', role: 'owner' },
        email: 'otro@example.com',
        courseId: 'course-1',
      }),
    ).rejects.toThrow('target user belongs to a different tenant');

    expect(deps.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it('skips the redundant claims write when the student already has the correct claims', async () => {
    const deps = makeDeps({
      getUserByEmail: vi.fn().mockResolvedValue({
        uid: 'student-uid-1',
        email: 'alumno@example.com',
        displayName: 'Alumno Uno',
        existingClaims: { tenantId: 'tenant-a', role: 'student' },
      }),
    });

    await assignEnrollment(deps, {
      callerClaims: { tenantId: 'tenant-a', role: 'owner' },
      email: 'alumno@example.com',
      courseId: 'course-1',
    });

    expect(deps.setCustomUserClaims).not.toHaveBeenCalled();
  });
});
