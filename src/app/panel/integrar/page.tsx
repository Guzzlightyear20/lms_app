'use client';

import { useState } from 'react';
import { buildEmbedSnippet } from '@/lib/embed/buildEmbedSnippet';

export default function IntegrarPage({
  searchParams,
}: {
  searchParams: { tenantId?: string };
}) {
  const tenantId = searchParams.tenantId ?? '';
  const [copied, setCopied] = useState(false);

  const snippet = buildEmbedSnippet({
    tenantId,
    baseUrl: process.env.NEXT_PUBLIC_APP_BASE_URL ?? 'https://tucampus.com',
  });

  return (
    <main className="page-app">
      <div className="page-app-content">
        <div className="card">
          <h1>Integrar en mi web</h1>
          <p>Copiá este código y pegalo en la página de tu sitio donde quieras mostrar los cursos:</p>
          <textarea
            readOnly
            value={snippet}
            rows={3}
            className="input"
            style={{ fontFamily: 'monospace', resize: 'vertical' }}
          />
          <button
            className="btn btn-primary"
            style={{ marginTop: 12 }}
            onClick={() => {
              navigator.clipboard.writeText(snippet);
              setCopied(true);
            }}
          >
            {copied ? 'Copiado' : 'Copiar código'}
          </button>
        </div>
      </div>
    </main>
  );
}
