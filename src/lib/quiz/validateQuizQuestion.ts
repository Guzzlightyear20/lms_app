import type { QuizQuestion } from '../models/types';

export function validateQuizQuestion(question: QuizQuestion): { valid: boolean; error?: string } {
  if (question.text.trim() === '') {
    return { valid: false, error: 'La pregunta necesita un enunciado' };
  }

  const nonEmptyOptions = question.options.filter((opt) => opt.trim() !== '');
  if (nonEmptyOptions.length < 2) {
    return { valid: false, error: 'La pregunta necesita al menos 2 opciones' };
  }

  const correctOption = question.options[question.correctOptionIndex];
  if (
    question.correctOptionIndex < 0 ||
    question.correctOptionIndex >= question.options.length ||
    !correctOption ||
    correctOption.trim() === ''
  ) {
    return { valid: false, error: 'Marcá cuál opción es la correcta' };
  }

  return { valid: true };
}
