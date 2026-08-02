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
