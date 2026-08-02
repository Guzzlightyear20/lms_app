import type { FirestoreDataConverter, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import type { Course, Progress } from './types';

export const courseConverter: FirestoreDataConverter<Course> = {
  toFirestore(course: Course): DocumentData {
    const { id, ...rest } = course;
    return rest;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot): Course {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      title: data.title,
      description: data.description,
      published: data.published,
      requiredQuizzes: data.requiredQuizzes,
      minQuizScore: data.minQuizScore,
    };
  },
};

export const progressConverter: FirestoreDataConverter<Progress> = {
  toFirestore(progress: Progress): DocumentData {
    return {
      courseId: progress.courseId,
      lessonsCompleted: progress.lessonsCompleted,
      quizScores: progress.quizScores,
      certificateUrl: progress.certificateUrl,
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot): Progress {
    const data = snapshot.data();
    return {
      courseId: data.courseId,
      lessonsCompleted: data.lessonsCompleted,
      quizScores: data.quizScores,
      certificateUrl: data.certificateUrl ?? null,
    };
  },
};
