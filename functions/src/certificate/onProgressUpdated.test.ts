// functions/src/certificate/onProgressUpdated.test.ts
import { describe, it, expect, vi } from 'vitest';
import { handleProgressUpdate } from './onProgressUpdated';
import type { Course, Progress } from '../progress/computeCompletion';

describe('handleProgressUpdate', () => {
  const course: Course = {
    id: 'course-1',
    title: 'Ecommerce 101',
    description: '',
    published: true,
    requiredQuizzes: false,
    minQuizScore: 60,
  };
  const totalLessonIds = ['lesson-1', 'lesson-2'];

  it('does nothing if the course is not yet complete', async () => {
    const progress: Progress = {
      courseId: 'course-1',
      lessonsCompleted: ['lesson-1'],
      quizScores: {},
      certificateUrl: null,
    };

    const generateCertificatePdf = vi.fn();
    const uploadCertificate = vi.fn();
    const updateProgressDoc = vi.fn();

    await handleProgressUpdate(
      { generateCertificatePdf, uploadCertificate, updateProgressDoc },
      { course, progress, totalLessonIds, studentName: 'Ana Perez' },
    );

    expect(generateCertificatePdf).not.toHaveBeenCalled();
    expect(uploadCertificate).not.toHaveBeenCalled();
    expect(updateProgressDoc).not.toHaveBeenCalled();
  });

  it('does nothing if a certificate was already issued', async () => {
    const progress: Progress = {
      courseId: 'course-1',
      lessonsCompleted: ['lesson-1', 'lesson-2'],
      quizScores: {},
      certificateUrl: 'https://example.com/existing.pdf',
    };

    const generateCertificatePdf = vi.fn();
    const uploadCertificate = vi.fn();
    const updateProgressDoc = vi.fn();

    await handleProgressUpdate(
      { generateCertificatePdf, uploadCertificate, updateProgressDoc },
      { course, progress, totalLessonIds, studentName: 'Ana Perez' },
    );

    expect(generateCertificatePdf).not.toHaveBeenCalled();
  });

  it('generates, uploads, and records the certificate when the course just completed', async () => {
    const progress: Progress = {
      courseId: 'course-1',
      lessonsCompleted: ['lesson-1', 'lesson-2'],
      quizScores: {},
      certificateUrl: null,
    };

    const fakeBytes = new Uint8Array([1, 2, 3]);
    const generateCertificatePdf = vi.fn().mockResolvedValue(fakeBytes);
    const uploadCertificate = vi.fn().mockResolvedValue('https://example.com/cert.pdf');
    const updateProgressDoc = vi.fn().mockResolvedValue(undefined);

    await handleProgressUpdate(
      { generateCertificatePdf, uploadCertificate, updateProgressDoc },
      { course, progress, totalLessonIds, studentName: 'Ana Perez' },
    );

    expect(generateCertificatePdf).toHaveBeenCalledWith({
      studentName: 'Ana Perez',
      courseTitle: 'Ecommerce 101',
      completionDate: expect.any(Date),
    });
    expect(uploadCertificate).toHaveBeenCalledWith('course-1', fakeBytes);
    expect(updateProgressDoc).toHaveBeenCalledWith('course-1', 'https://example.com/cert.pdf');
  });
});
