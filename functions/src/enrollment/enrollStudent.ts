// functions/src/enrollment/enrollStudent.ts
import * as functionsV1 from 'firebase-functions/v1';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { assignEnrollment, type Role } from './assignEnrollment';

export const enrollStudent = functionsV1.https.onCall(async (data, context) => {
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

  const auth = getAuth();
  const db = getFirestore();

  return assignEnrollment(
    {
      getUserByEmail: async (email) => {
        const userRecord = await auth.getUserByEmail(email);
        return { uid: userRecord.uid };
      },
      setCustomUserClaims: (uid, claims) => auth.setCustomUserClaims(uid, claims),
      progressExists: async (tenantId, uid, courseId) => {
        const snap = await db
          .doc(`tenants/${tenantId}/students/${uid}/progress/${courseId}`)
          .get();
        return snap.exists;
      },
      createProgress: async (tenantId, uid, courseId) => {
        await db.doc(`tenants/${tenantId}/students/${uid}/progress/${courseId}`).set({
          courseId,
          lessonsCompleted: [],
          quizScores: {},
          certificateUrl: null,
        });
      },
    },
    {
      callerClaims,
      email: data.email,
      courseId: data.courseId,
    },
  );
});
