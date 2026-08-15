import { collection, query, where, getDocs } from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase/client';
import { courseConverter } from '@/lib/models/courseConverters';

export default async function TenantCatalogPage({
  params,
}: {
  params: { tenant: string };
}) {
  const db = getFirebaseFirestore();
  const coursesRef = collection(db, `tenants/${params.tenant}/courses`).withConverter(
    courseConverter,
  );
  const snapshot = await getDocs(query(coursesRef, where('published', '==', true)));
  const courses = snapshot.docs.map((d) => d.data());

  return (
    <main className="page-hero">
      <p className="page-hero-title">LMS SaaS</p>
      <div className="card card--wide">
        <h1>Cursos disponibles</h1>
        <ul className="course-list">
          {courses.map((course) => (
            <li key={course.id} className="course-card">
              <a href={`/${params.tenant}/cursos/${course.id}`}>{course.title}</a>
              <p>{course.description}</p>
            </li>
          ))}
        </ul>
        {courses.length === 0 && <p>Todavía no hay cursos publicados.</p>}
      </div>
    </main>
  );
}
