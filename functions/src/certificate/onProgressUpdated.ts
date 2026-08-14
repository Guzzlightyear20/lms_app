// functions/src/certificate/onProgressUpdated.ts
import * as functionsV1 from 'firebase-functions/v1/firestore';
import { getFirestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { isCourseComplete, type Course, type Progress } from '../progress/computeCompletion';
import { generateCertificatePdf as realGenerateCertificatePdf } from './generateCertificatePdf';

interface HandlerDeps {
  generateCertificatePdf: (input: {
    studentName: string;
    courseTitle: string;
    completionDate: Date;
  }) => Promise<Uint8Array>;
  uploadCertificate: (courseId: string, bytes: Uint8Array) => Promise<string>;
  updateProgressDoc: (courseId: string, certificateUrl: string) => Promise<void>;
}

interface HandlerInput {
  course: Course;
  progress: Progress;
  totalLessonIds: string[];
  studentName: string;
}

export async function handleProgressUpdate(
  deps: HandlerDeps,
  input: HandlerInput,
): Promise<void> {
  if (input.progress.certificateUrl) {
    return;
  }

  const complete = isCourseComplete(input.course, input.progress, input.totalLessonIds);
  if (!complete) {
    return;
  }

  const bytes = await deps.generateCertificatePdf({
    studentName: input.studentName,
    courseTitle: input.course.title,
    completionDate: new Date(),
  });

  const url = await deps.uploadCertificate(input.course.id, bytes);
  await deps.updateProgressDoc(input.course.id, url);
}

export const onProgressUpdated = functionsV1
  .document('tenants/{tenantId}/students/{studentId}/progress/{courseId}')
  .onWrite(async (change, context) => {
    const db = getFirestore();
    const storage = getStorage();

    const { tenantId, studentId, courseId } = context.params;
    const progressData = change.after.data();
    if (!progressData) return;

    const courseSnap = await db.doc(`tenants/${tenantId}/courses/${courseId}`).get();
    const studentSnap = await db.doc(`tenants/${tenantId}/students/${studentId}`).get();
    if (!courseSnap.exists || !studentSnap.exists) return;

    const modulesSnap = await db
      .collection(`tenants/${tenantId}/courses/${courseId}/modules`)
      .get();
    const lessonIds: string[] = [];
    for (const moduleDoc of modulesSnap.docs) {
      const lessonsSnap = await moduleDoc.ref.collection('lessons').get();
      lessonsSnap.forEach((l: QueryDocumentSnapshot) => lessonIds.push(l.id));
    }

    await handleProgressUpdate(
      {
        generateCertificatePdf: realGenerateCertificatePdf,
        uploadCertificate: async (cId, bytes) => {
          const file = storage.bucket().file(`certificates/${tenantId}/${studentId}/${cId}.pdf`);
          await file.save(Buffer.from(bytes), { contentType: 'application/pdf' });
          const [url] = await file.getSignedUrl({ action: 'read', expires: '2100-01-01' });
          return url;
        },
        updateProgressDoc: async (cId, url) => {
          await change.after.ref.update({ certificateUrl: url });
        },
      },
      {
        course: { ...(courseSnap.data() as Omit<Course, 'id'>), id: courseId },
        progress: progressData as Progress,
        totalLessonIds: lessonIds,
        studentName: studentSnap.data()?.name ?? 'Estudiante',
      },
    );
  });
