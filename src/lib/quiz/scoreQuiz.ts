import type { Quiz } from '../models/types';

export function scoreQuiz(quiz: Quiz, answers: number[]): number {
  if (answers.length !== quiz.questions.length) {
    throw new Error(
      `answers length (${answers.length}) must match questions length (${quiz.questions.length})`,
    );
  }

  const correctCount = quiz.questions.reduce((count, question, index) => {
    return answers[index] === question.correctOptionIndex ? count + 1 : count;
  }, 0);

  return Math.round((correctCount / quiz.questions.length) * 100);
}
