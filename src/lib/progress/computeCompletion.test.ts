import { describe, it, expect } from 'vitest';
import { isCourseComplete } from './computeCompletion';
import type { Course, Progress } from '../models/types';

const baseCourse: Course = {
  id: 'course-1',
  title: 'Ecommerce 101',
  description: '',
  published: true,
  requiredQuizzes: false,
  minQuizScore: 60,
};

const totalLessonIds = ['lesson-1', 'lesson-2', 'lesson-3'];

describe('isCourseComplete', () => {
  it('is false when not all lessons are completed', () => {
    const progress: Progress = {
      courseId: 'course-1',
      lessonsCompleted: ['lesson-1', 'lesson-2'],
      quizScores: {},
      certificateUrl: null,
    };
    expect(isCourseComplete(baseCourse, progress, totalLessonIds)).toBe(false);
  });

  it('is true when all lessons are completed and quizzes are not required', () => {
    const progress: Progress = {
      courseId: 'course-1',
      lessonsCompleted: ['lesson-1', 'lesson-2', 'lesson-3'],
      quizScores: {},
      certificateUrl: null,
    };
    expect(isCourseComplete(baseCourse, progress, totalLessonIds)).toBe(true);
  });

  it('is false when quizzes are required but a score is below minQuizScore', () => {
    const course: Course = { ...baseCourse, requiredQuizzes: true, minQuizScore: 60 };
    const progress: Progress = {
      courseId: 'course-1',
      lessonsCompleted: ['lesson-1', 'lesson-2', 'lesson-3'],
      quizScores: { 'quiz-1': 50 },
      certificateUrl: null,
    };
    expect(isCourseComplete(course, progress, totalLessonIds)).toBe(false);
  });

  it('is true when quizzes are required and all scores meet minQuizScore', () => {
    const course: Course = { ...baseCourse, requiredQuizzes: true, minQuizScore: 60 };
    const progress: Progress = {
      courseId: 'course-1',
      lessonsCompleted: ['lesson-1', 'lesson-2', 'lesson-3'],
      quizScores: { 'quiz-1': 60, 'quiz-2': 100 },
      certificateUrl: null,
    };
    expect(isCourseComplete(course, progress, totalLessonIds)).toBe(true);
  });
});
