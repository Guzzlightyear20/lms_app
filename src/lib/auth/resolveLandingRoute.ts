export function resolveLandingRoute(claims: { role?: string } | null): string {
  if (claims?.role === 'owner' || claims?.role === 'instructor') {
    return '/panel/inscribir';
  }
  return '/cuenta';
}
