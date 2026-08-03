export type Role = 'owner' | 'instructor' | 'student';

export interface EnrollDeps {
  getUserByEmail: (email: string) => Promise<{ uid: string }>;
  setCustomUserClaims: (uid: string, claims: { tenantId: string; role: Role }) => Promise<void>;
  progressExists: (tenantId: string, uid: string, courseId: string) => Promise<boolean>;
  createProgress: (tenantId: string, uid: string, courseId: string) => Promise<void>;
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

  const { uid } = await deps.getUserByEmail(input.email);

  await deps.setCustomUserClaims(uid, { tenantId: input.callerClaims.tenantId, role: 'student' });

  const alreadyEnrolled = await deps.progressExists(input.callerClaims.tenantId, uid, input.courseId);
  if (!alreadyEnrolled) {
    await deps.createProgress(input.callerClaims.tenantId, uid, input.courseId);
  }

  return { success: true, studentUid: uid };
}
