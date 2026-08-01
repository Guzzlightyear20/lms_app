# LMS SaaS — Diseño MVP (nivel intermedio)

Fecha: 2026-08-01

## Contexto y propósito

El usuario arma webs para clientes (agencia/freelance). Frecuentemente los clientes piden agregar
un módulo de cursos/capacitación a su web, y hoy no hay nada propio para ofrecer — hay que salir a
buscar plataformas de terceros (Teachable, Thinkific, etc.) e integrarlas a medias.

Objetivo: construir un **LMS propio, multi-tenant, vendible como SaaS a terceros**, que se pueda
activar rápido como "agregado" en cualquier web de cliente (vía iframe embebible o subdominio
propio), sin tener que reconstruir nada por cliente.

No es (todavía) un LMS genérico de nicho definido — el mercado objetivo son los clientes de webs
del usuario que quieren ofrecer cursos/capacitación como parte de su sitio.

## Alcance: nivel "intermedio"

Incluye: cursos con módulos y lecciones (video/texto/PDF), quizzes con nota, tracking de progreso
por alumno, certificado auto-generado al completar el curso, roles (owner/instructor/alumno).

Explícitamente fuera de alcance del MVP:
- Pagos/checkout propio (se resuelve más adelante, posiblemente con link externo o Stripe simple)
- SCORM/xAPI
- Analítica avanzada
- App móvil nativa
- Comentarios/foros entre alumnos

## Enfoque arquitectónico

**Multi-tenant** sobre una sola plataforma (mismo patrón que Kvelle: `tenantId` + custom claims de
Firebase Auth para roles), en vez de clonar/redeployar una instancia por cliente. Un solo codebase
para mantener y mejorar; alta velocidad de onboarding (crear tenant nuevo = activar el agregado
para un cliente).

**Stack**: Next.js (App Router) para frontend/SSR + Firebase (Auth, Firestore, Storage, Cloud
Functions) para backend.

Por qué Next.js y no Flutter (stack usado en Kvelle/KvCare): este producto se embebe o enlaza
dentro de webs de clientes ya existentes (iframe o subdominio), así que necesita ser liviano,
indexable por buscadores y de carga rápida — SSR/SSG le gana a una SPA o a Flutter web para las
páginas públicas de catálogo de cursos.

Resolución de tenant: por subdominio (`cliente.tucampus.com`) o por `tenantId` en la URL cuando se
embebe vía iframe (`tucampus.com/embed/{tenantId}`).

## Roles

- **Owner**: dueño del tenant (el cliente que contrató el módulo). Crea cursos, gestiona
  instructores, ve alumnos y su progreso.
- **Instructor**: crea/edita contenido de sus cursos asignados.
- **Alumno**: se inscribe, consume lecciones, rinde quizzes, descarga certificado.

Implementación: custom claims en Firebase Auth `{ tenantId, role }`, mismo patrón que
`project_vencimientos_multitenant` y `project_kvelle_tenant_gate`.

## Modelo de datos (Firestore)

```
tenants/{tenantId}
  config: { nombre, branding, dominio }

  courses/{courseId}
    title, description, price, published

    modules/{moduleId}
      lessons/{lessonId}
        videoUrl, texto, adjuntos

        quizzes/{quizId}
          preguntas: [ { texto, opciones, correcta } ]

  students/{studentId}
    enrollments: [courseId, ...]

    progress/{courseId}
      lessonsCompleted: [lessonId, ...]
      quizScores: { quizId: nota }
      certificateIssued: boolean | url

  instructors/{instructorId}
    (rol via custom claim, no requiere doc propio necesariamente)
```

## Pantallas principales

1. **Panel Owner/Instructor**: CRUD de cursos → módulos → lecciones, creación de quizzes, listado
   de alumnos y su progreso por curso.
2. **Catálogo público del tenant**: listado de cursos publicados, página SSR (buena indexación si
   el cliente la linkea desde su web).
3. **Vista de curso (alumno)**: sidebar de módulos/lecciones, reproductor de video/visor de
   texto-PDF, botón "marcar lección como completada".
4. **Quiz**: preguntas de opción múltiple, corrección y nota inmediata al enviar.
5. **Certificado**: botón "descargar certificado" habilitado cuando el progreso llega a 100% (y el
   alumno aprobó los quizzes requeridos, si el curso los exige).
6. **"Integrar en mi web"**: pantalla que le da al cliente (owner) el snippet de iframe o el link
   directo con su branding — mismo concepto que `project_kvelle_web_embed`.

## Flujo de progreso y certificado

1. Alumno marca una lección como completada → se actualiza
   `students/{studentId}/progress/{courseId}.lessonsCompleted`.
2. Cuando `lessonsCompleted.length === totalLessons` del curso (y, si aplica, todas las notas de
   quiz superan el mínimo configurado), se dispara una Cloud Function.
3. La función genera el PDF del certificado (nombre del alumno, curso, fecha), lo guarda en
   Storage, y escribe la URL en `progress/{courseId}.certificateIssued`.

## Testing / validación del MVP

Validación manual tipo UAT sobre el circuito completo:
crear curso → inscribir alumno de prueba → completar lecciones → rendir quiz → obtener
certificado → probar el embed (iframe) en una página de prueba fuera del dominio principal.

No se define suite automatizada en este MVP; se evalúa agregarla en una iteración posterior si el
producto avanza a validación con clientes reales.
