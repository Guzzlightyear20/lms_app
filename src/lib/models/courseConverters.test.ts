import { describe, it, expect } from 'vitest';
import { courseConverter, progressConverter } from './courseConverters';
import type { Course, Progress } from './types';

describe('courseConverter', () => {
  it('round-trips a Course through toFirestore/fromFirestore', () => {
    const course: Course = {
      id: 'course-1',
      title: 'Ecommerce 101',
      description: 'Intro course',
      published: true,
      requiredQuizzes: true,
      minQuizScore: 60,
    };

    const stored = courseConverter.toFirestore(course);
    const snapshotStub = {
      id: 'course-1',
      data: () => stored,
    } as any;

    const roundTripped = courseConverter.fromFirestore(snapshotStub, {});
    expect(roundTripped).toEqual(course);
  });
});

describe('progressConverter', () => {
  it('round-trips a Progress record through toFirestore/fromFirestore', () => {
    const progress: Progress = {
      courseId: 'course-1',
      lessonsCompleted: ['lesson-1', 'lesson-2'],
      quizScores: { 'quiz-1': 80 },
      certificateUrl: null,
    };

    const stored = progressConverter.toFirestore(progress);
    const snapshotStub = {
      id: 'course-1',
      data: () => stored,
    } as any;

    const roundTripped = progressConverter.fromFirestore(snapshotStub, {});
    expect(roundTripped).toEqual(progress);
  });
});
