export function buildEmbedSnippet(input: { tenantId: string; baseUrl: string }): string {
  return `<iframe src="${input.baseUrl}/embed/${input.tenantId}" width="100%" height="800" frameborder="0"></iframe>`;
}
