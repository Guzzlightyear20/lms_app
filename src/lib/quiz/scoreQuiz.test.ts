import { describe, it, expect } from 'vitest';
import { scoreQuiz } from './scoreQuiz';
import type { Quiz } from '../models/types';

const quiz: Quiz = {
  id: 'quiz-1',
  lessonId: 'lesson-1',
  questions: [
    { text: 'Q1', options: ['a', 'b'], correctOptionIndex: 0 },
    { text: 'Q2', options: ['a', 'b'], correctOptionIndex: 1 },
    { text: 'Q3', options: ['a', 'b', 'c'], correctOptionIndex: 2 },
    { text: 'Q4', options: ['a', 'b'], correctOptionIndex: 0 },
  ],
};

describe('scoreQuiz', () => {
  it('returns 100 when all answers are correct', () => {
    expect(scoreQuiz(quiz, [0, 1, 2, 0])).toBe(100);
  });

  it('returns 0 when all answers are wrong', () => {
    expect(scoreQuiz(quiz, [1, 0, 0, 1])).toBe(0);
  });

  it('returns the rounded percentage for partial correctness', () => {
    // 1 of 4 correct = 25%
    expect(scoreQuiz(quiz, [0, 0, 0, 1])).toBe(25);
  });

  it('throws if answers length does not match questions length', () => {
    expect(() => scoreQuiz(quiz, [0, 1])).toThrow(
      'answers length (2) must match questions length (4)',
    );
  });
});
