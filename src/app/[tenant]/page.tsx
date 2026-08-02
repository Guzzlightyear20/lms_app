import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { getFirebaseApp } from '@/lib/firebase/client';
import { courseConverter } from '@/lib/models/courseConverters';

export default async function TenantCatalogPage({
  params,
}: {
  params: { tenant: string };
}) {
  const db = getFirestore(getFirebaseApp());
  const coursesRef = collection(db, `tenants/${params.tenant}/courses`).withConverter(
    courseConverter,
  );
  const snapshot = await getDocs(query(coursesRef, where('published', '==', true)));
  const courses = snapshot.docs.map((d) => d.data());

  return (
    <main>
      <h1>Cursos disponibles</h1>
      <ul>
        {courses.map((course) => (
          <li key={course.id}>
            <a href={`/${params.tenant}/cursos/${course.id}`}>{course.title}</a>
            <p>{course.description}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
