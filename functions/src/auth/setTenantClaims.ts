// functions/src/auth/setTenantClaims.ts
import * as functionsV1 from 'firebase-functions/v1';
import { getAuth, type Auth } from 'firebase-admin/auth';

export type Role = 'owner' | 'instructor' | 'student';

interface AssignClaimsInput {
  callerClaims: { tenantId: string; role: Role };
  targetUid: string;
  tenantId: string;
  role: Role;
}

export async function assignTenantClaims(
  adminAuth: Pick<Auth, 'setCustomUserClaims' | 'getUser'>,
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

export const setTenantClaims = functionsV1.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functionsV1.https.HttpsError('unauthenticated', 'Must be signed in');
  }

  const token = context.auth.token as Record<string, unknown>;
  if (typeof token.tenantId !== 'string' || typeof token.role !== 'string') {
    throw new functionsV1.https.HttpsError(
      'failed-precondition',
      'Caller is missing tenantId/role claims',
    );
  }
  const callerClaims = { tenantId: token.tenantId, role: token.role as Role };

  return assignTenantClaims(getAuth(), {
    callerClaims,
    targetUid: data.targetUid,
    tenantId: data.tenantId,
    role: data.role,
  });
});
