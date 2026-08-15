import { describe, it, expect } from 'vitest';
import { validateQuizQuestion } from './validateQuizQuestion';
import type { QuizQuestion } from '../models/types';

describe('validateQuizQuestion', () => {
  it('accepts a well-formed question', () => {
    const question: QuizQuestion = {
      text: '¿Cuál es la capital de Francia?',
      options: ['Madrid', 'París'],
      correctOptionIndex: 1,
    };
    expect(validateQuizQuestion(question)).toEqual({ valid: true });
  });

  it('rejects an empty question text', () => {
    const question: QuizQuestion = { text: '  ', options: ['a', 'b'], correctOptionIndex: 0 };
    expect(validateQuizQuestion(question).valid).toBe(false);
  });

  it('rejects fewer than 2 non-empty options', () => {
    const question: QuizQuestion = { text: 'Pregunta', options: ['a', '  '], correctOptionIndex: 0 };
    expect(validateQuizQuestion(question).valid).toBe(false);
  });

  it('rejects an out-of-range correctOptionIndex', () => {
    const question: QuizQuestion = { text: 'Pregunta', options: ['a', 'b'], correctOptionIndex: 5 };
    expect(validateQuizQuestion(question).valid).toBe(false);
  });

  it('rejects a correctOptionIndex pointing at an empty option', () => {
    const question: QuizQuestion = { text: 'Pregunta', options: ['a', '  '], correctOptionIndex: 1 };
    expect(validateQuizQuestion(question).valid).toBe(false);
  });
});
