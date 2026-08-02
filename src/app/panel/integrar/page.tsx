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
    <main>
      <h1>Integrar en mi web</h1>
      <p>Copia este codigo y pegalo en la pagina de tu sitio donde quieras mostrar los cursos:</p>
      <textarea readOnly value={snippet} rows={3} style={{ width: '100%' }} />
      <button
        onClick={() => {
          navigator.clipboard.writeText(snippet);
          setCopied(true);
        }}
      >
        {copied ? 'Copiado' : 'Copiar codigo'}
      </button>
    </main>
  );
}
