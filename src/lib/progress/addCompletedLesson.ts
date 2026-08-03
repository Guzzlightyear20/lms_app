export function addCompletedLesson(lessonsCompleted: string[], lessonId: string): string[] {
  if (lessonsCompleted.includes(lessonId)) {
    return lessonsCompleted;
  }
  return [...lessonsCompleted, lessonId];
}
