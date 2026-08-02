import { describe, it, expect } from 'vitest';
import { buildEmbedSnippet } from './buildEmbedSnippet';

describe('buildEmbedSnippet', () => {
  it('builds an iframe snippet pointing at the embed route for the tenant', () => {
    const snippet = buildEmbedSnippet({
      tenantId: 'academia-x',
      baseUrl: 'https://tucampus.com',
    });

    expect(snippet).toBe(
      '<iframe src="https://tucampus.com/embed/academia-x" width="100%" height="800" frameborder="0"></iframe>',
    );
  });
});
