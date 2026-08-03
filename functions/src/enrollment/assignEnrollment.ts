export type Role = 'owner' | 'instructor' | 'student';

export interface EnrollDeps {
  getUserByEmail: (email: string) => Promise<{
    uid: string;
    email: string;
    displayName: string | null;
    existingClaims: { tenantId?: string; role?: Role } | null;
  }>;
  setCustomUserClaims: (uid: string, claims: { tenantId: string; role: Role }) => Promise<void>;
  progressExists: (tenantId: string, uid: string, courseId: string) => Promise<boolean>;
  createProgress: (
    tenantId: string,
    uid: string,
    courseId: string,
    studentInfo: { email: string; displayName: string | null },
  ) => Promise<void>;
}

export interface EnrollInput {
  callerClaims: { tenantId: string; role: Role };
  email: string;
  courseId: string;
}

export async function assignEnrollment(
  deps: EnrollDeps,
  input: EnrollInput,
): Promise<{ success: true; studentUid: string }> {
  if (input.callerClaims.role !== 'owner' && input.callerClaims.role !== 'instructor') {
    throw new Error('caller must be an owner or instructor');
  }

  const student = await deps.getUserByEmail(input.email);

  if (student.existingClaims?.role === 'owner' || student.existingClaims?.role === 'instructor') {
    throw new Error('target user is an owner or instructor and cannot be enrolled as a student');
  }
  if (student.existingClaims?.tenantId && student.existingClaims.tenantId !== input.callerClaims.tenantId) {
    throw new Error('target user belongs to a different tenant');
  }

  const alreadyHasCorrectClaims =
    student.existingClaims?.tenantId === input.callerClaims.tenantId &&
    student.existingClaims?.role === 'student';
  if (!alreadyHasCorrectClaims) {
    await deps.setCustomUserClaims(student.uid, { tenantId: input.callerClaims.tenantId, role: 'student' });
  }

  const alreadyEnrolled = await deps.progressExists(input.callerClaims.tenantId, student.uid, input.courseId);
  if (!alreadyEnrolled) {
    await deps.createProgress(input.callerClaims.tenantId, student.uid, input.courseId, {
      email: student.email,
      displayName: student.displayName,
    });
  }

  return { success: true, studentUid: student.uid };
}
