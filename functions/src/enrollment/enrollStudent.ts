// functions/src/enrollment/enrollStudent.ts
import * as functionsV1 from 'firebase-functions/v1/https';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { assignEnrollment, type Role } from './assignEnrollment';

export const enrollStudent = functionsV1.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functionsV1.HttpsError('unauthenticated', 'Must be signed in');
  }

  const token = context.auth.token as Record<string, unknown>;
  if (typeof token.tenantId !== 'string' || typeof token.role !== 'string') {
    throw new functionsV1.HttpsError(
      'failed-precondition',
      'Caller is missing tenantId/role claims',
    );
  }
  const callerClaims = { tenantId: token.tenantId, role: token.role as Role };

  if (typeof data.email !== 'string' || data.email.trim() === '') {
    throw new functionsV1.HttpsError('invalid-argument', 'email is required');
  }
  if (typeof data.courseId !== 'string' || data.courseId.trim() === '') {
    throw new functionsV1.HttpsError('invalid-argument', 'courseId is required');
  }

  const auth = getAuth();
  const db = getFirestore();

  try {
    return await assignEnrollment(
      {
        getUserByEmail: async (email) => {
          const userRecord = await auth.getUserByEmail(email);
          return {
            uid: userRecord.uid,
            email: userRecord.email ?? email,
            displayName: userRecord.displayName ?? null,
            existingClaims: (userRecord.customClaims as { tenantId?: string; role?: Role } | undefined) ?? null,
          };
        },
        courseExists: async (tenantId, courseId) => {
          const snap = await db.doc(`tenants/${tenantId}/courses/${courseId}`).get();
          return snap.exists;
        },
        setCustomUserClaims: (uid, claims) => auth.setCustomUserClaims(uid, claims),
        progressExists: async (tenantId, uid, courseId) => {
          const snap = await db
            .doc(`tenants/${tenantId}/students/${uid}/progress/${courseId}`)
            .get();
          return snap.exists;
        },
        createProgress: async (tenantId, uid, courseId, studentInfo) => {
          await db.doc(`tenants/${tenantId}/students/${uid}`).set(
            { name: studentInfo.displayName ?? studentInfo.email, email: studentInfo.email },
            { merge: true },
          );
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
  } catch (err) {
    if (err instanceof Error && /there is no user record/i.test(err.message)) {
      throw new functionsV1.HttpsError(
        'not-found',
        'No existe una cuenta con ese email. El alumno debe registrarse primero.',
      );
    }
    if (err instanceof Error && err.message === 'course not found') {
      throw new functionsV1.HttpsError('not-found', 'El curso seleccionado no existe.');
    }
    if (err instanceof Error) {
      throw new functionsV1.HttpsError('failed-precondition', err.message);
    }
    throw err;
  }
});
