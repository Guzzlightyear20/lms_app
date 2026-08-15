export default function HomePage() {
  return (
    <div className="page-hero">
      <p className="page-hero-title">LMS SaaS</p>
      <div className="card">
        <h2>Plataforma de cursos</h2>
        <p style={{ marginBottom: 20 }}>
          Gestioná cursos, alumnos y certificados desde un solo lugar.
        </p>
        <a href="/login" className="btn btn-primary btn-block">
          Iniciar sesión
        </a>
        <div style={{ height: 12 }} />
        <a href="/registro" className="btn btn-secondary btn-block">
          Crear cuenta
        </a>
      </div>
    </div>
  );
}
