import { describe, it, expect, vi } from 'vitest';
import { assignEnrollment } from './assignEnrollment';

function makeDeps(overrides: Partial<{
  getUserByEmail: ReturnType<typeof vi.fn>;
  setCustomUserClaims: ReturnType<typeof vi.fn>;
  progressExists: ReturnType<typeof vi.fn>;
  createProgress: ReturnType<typeof vi.fn>;
}> = {}) {
  return {
    getUserByEmail: vi.fn().mockResolvedValue({ uid: 'student-uid-1' }),
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

  it('resolves the student by email, assigns claims, and creates a new progress record', async () => {
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
    expect(deps.createProgress).toHaveBeenCalledWith('tenant-a', 'student-uid-1', 'course-1');
    expect(result).toEqual({ success: true, studentUid: 'student-uid-1' });
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
});
