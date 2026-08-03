import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { getFirebaseApp } from '@/lib/firebase/client';
import { courseConverter } from '@/lib/models/courseConverters';

export default async function EmbedCatalogPage({
  params,
}: {
  params: { tenantId: string };
}) {
  const db = getFirestore(getFirebaseApp());
  const coursesRef = collection(db, `tenants/${params.tenantId}/courses`).withConverter(
    courseConverter,
  );
  const snapshot = await getDocs(query(coursesRef, where('published', '==', true)));
  const courses = snapshot.docs.map((d) => d.data());

  return (
    <main style={{ margin: 0, fontFamily: 'sans-serif' }}>
      <ul>
        {courses.map((course) => (
          <li key={course.id}>
            <a href={`/${params.tenantId}/cursos/${course.id}`} target="_top">
              {course.title}
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
