// src/app/panel/cursos/[courseId]/lecciones/[lessonId]/page.tsx
'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { updateLesson, type LessonDeps } from '@/lib/courses/lessonOperations';
import {
  createQuiz,
  addQuestion,
  deleteQuestion,
  type QuizDeps,
} from '@/lib/quiz/quizOperations';
import type { Lesson, Quiz, QuizQuestion } from '@/lib/models/types';

export default function LessonEditorPage({
  params,
  searchParams,
}: {
  params: { courseId: string; lessonId: string };
  searchParams: { moduleId?: string };
}) {
  const { claims } = useAuth();
  const tenantId = claims?.tenantId;
  const moduleId = searchParams.moduleId ?? '';
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionOptions, setNewQuestionOptions] = useState(['', '']);
  const [newQuestionCorrect, setNewQuestionCorrect] = useState(0);

  useEffect(() => {
    if (!tenantId || !moduleId) return;
    loadLesson();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, moduleId]);

  function lessonPath(): string {
    return `tenants/${tenantId}/courses/${params.courseId}/modules/${moduleId}/lessons/${params.lessonId}`;
  }

  async function loadLesson() {
    const db = getFirebaseFirestore();
    const lessonSnap = await getDoc(doc(db, lessonPath()));
    if (lessonSnap.exists()) {
      const data = lessonSnap.data();
      setLesson({
        id: lessonSnap.id,
        title: data.title,
        order: data.order,
        videoUrl: data.videoUrl ?? null,
        textContent: data.textContent ?? null,
        attachmentUrls: data.attachmentUrls ?? [],
      });
    }

    const quizzesSnap = await getDocs(collection(db, `${lessonPath()}/quizzes`));
    if (!quizzesSnap.empty) {
      const quizDoc = quizzesSnap.docs[0];
      const quizData = quizDoc.data();
      setQuiz({ id: quizDoc.id, lessonId: params.lessonId, questions: quizData.questions ?? [] });
    }
    setLoading(false);
  }

  function quizDeps(): QuizDeps {
    const db = getFirebaseFirestore();
    return {
      createQuizDoc: async (tId, courseId, modId, lessonId, newQuiz) => {
        const ref = doc(
          collection(
            db,
            `tenants/${tId}/courses/${courseId}/modules/${modId}/lessons/${lessonId}/quizzes`,
          ),
        );
        await setDoc(ref, newQuiz);
        return ref.id;
      },
      updateQuizQuestions: async (tId, courseId, modId, lessonId, quizId, questions) => {
        await updateDoc(
          doc(
            db,
            `tenants/${tId}/courses/${courseId}/modules/${modId}/lessons/${lessonId}/quizzes/${quizId}`,
          ),
          { questions },
        );
      },
    };
  }

  async function handleSaveLesson(event: FormEvent) {
    event.preventDefault();
    if (!tenantId || !lesson) return;
    setSaveError(null);
    const deps: LessonDeps = {
      createLessonDoc: async () => '',
      updateLessonDoc: async (tId, courseId, modId, lessonId, updates) => {
        const db = getFirebaseFirestore();
        await updateDoc(
          doc(db, `tenants/${tId}/courses/${courseId}/modules/${modId}/lessons/${lessonId}`),
          updates,
        );
      },
      deleteLessonDoc: async () => {},
      writeLessonOrder: async () => {},
    };
    try {
      await updateLesson(deps, tenantId, params.courseId, moduleId, params.lessonId, {
        title: lesson.title,
        videoUrl: lesson.videoUrl,
        textContent: lesson.textContent,
      });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo guardar la lección');
    }
  }

  async function handleCreateQuiz() {
    if (!tenantId) return;
    const { id } = await createQuiz(quizDeps(), tenantId, params.courseId, moduleId, params.lessonId);
    setQuiz({ id, lessonId: params.lessonId, questions: [] });
  }

  async function handleAddQuestion(event: FormEvent) {
    event.preventDefault();
    if (!tenantId || !quiz) return;
    setSaveError(null);
    const question: QuizQuestion = {
      text: newQuestionText,
      options: newQuestionOptions,
      correctOptionIndex: newQuestionCorrect,
    };
    try {
      const updated = await addQuestion(
        quizDeps(),
        tenantId,
        params.courseId,
        moduleId,
        params.lessonId,
        quiz.id,
        quiz.questions,
        question,
      );
      setQuiz({ ...quiz, questions: updated });
      setNewQuestionText('');
      setNewQuestionOptions(['', '']);
      setNewQuestionCorrect(0);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo agregar la pregunta');
    }
  }

  async function handleDeleteQuestion(index: number) {
    if (!tenantId || !quiz) return;
    const updated = await deleteQuestion(
      quizDeps(),
      tenantId,
      params.courseId,
      moduleId,
      params.lessonId,
      quiz.id,
      quiz.questions,
      index,
    );
    setQuiz({ ...quiz, questions: updated });
  }

  if (loading || !lesson) {
    return (
      <main className="page-app">
        <div className="page-app-content">
          <p>Cargando...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="page-app">
      <div className="page-app-content">
        <div className="card">
          <h1>Editar lección</h1>
          <form onSubmit={handleSaveLesson}>
            <label className="field">
              <span className="field-label">Título</span>
              <input
                className="input"
                value={lesson.title}
                onChange={(e) => setLesson({ ...lesson, title: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">Contenido de texto</span>
              <textarea
                className="input"
                rows={6}
                value={lesson.textContent ?? ''}
                onChange={(e) => setLesson({ ...lesson, textContent: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">URL de video</span>
              <input
                className="input"
                value={lesson.videoUrl ?? ''}
                onChange={(e) => setLesson({ ...lesson, videoUrl: e.target.value })}
              />
            </label>
            {saveError && (
              <p className="alert alert-error" role="alert">
                {saveError}
              </p>
            )}
            <button type="submit" className="btn btn-primary">
              Guardar
            </button>
          </form>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <h2>Quiz</h2>
          {!quiz ? (
            <button className="btn btn-primary" onClick={handleCreateQuiz}>
              Agregar quiz
            </button>
          ) : (
            <>
              <ul>
                {quiz.questions.map((q, index) => (
                  <li key={index} style={{ marginBottom: 12 }}>
                    <p>
                      <strong>{q.text}</strong>
                    </p>
                    <ul>
                      {q.options.map((opt, optIndex) => (
                        <li key={optIndex}>
                          {optIndex === q.correctOptionIndex ? '✓ ' : ''}
                          {opt}
                        </li>
                      ))}
                    </ul>
                    <button className="btn btn-secondary" onClick={() => handleDeleteQuestion(index)}>
                      Borrar pregunta
                    </button>
                  </li>
                ))}
              </ul>

              <form onSubmit={handleAddQuestion}>
                <label className="field">
                  <span className="field-label">Pregunta</span>
                  <input
                    className="input"
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                  />
                </label>
                {newQuestionOptions.map((opt, index) => (
                  <div className="field" key={index}>
                    <span className="field-label">Opción {index + 1}</span>
                    <input
                      className="input"
                      value={opt}
                      onChange={(e) => {
                        const updated = [...newQuestionOptions];
                        updated[index] = e.target.value;
                        setNewQuestionOptions(updated);
                      }}
                    />
                    <label>
                      <input
                        type="radio"
                        name="correct-option"
                        checked={newQuestionCorrect === index}
                        onChange={() => setNewQuestionCorrect(index)}
                      />{' '}
                      Correcta
                    </label>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setNewQuestionOptions([...newQuestionOptions, ''])}
                >
                  + Opción
                </button>
                <button type="submit" className="btn btn-primary">
                  Agregar pregunta
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
