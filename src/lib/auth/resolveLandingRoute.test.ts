import { describe, it, expect } from 'vitest';
import { resolveLandingRoute } from './resolveLandingRoute';

describe('resolveLandingRoute', () => {
  it('sends an owner to the enrollment panel', () => {
    expect(resolveLandingRoute({ role: 'owner' })).toBe('/panel/inscribir');
  });

  it('sends an instructor to the enrollment panel', () => {
    expect(resolveLandingRoute({ role: 'instructor' })).toBe('/panel/inscribir');
  });

  it('sends a student to the account status page', () => {
    expect(resolveLandingRoute({ role: 'student' })).toBe('/cuenta');
  });

  it('sends a user with no claims at all to the account status page', () => {
    expect(resolveLandingRoute(null)).toBe('/cuenta');
  });

  it('sends a user with an empty claims object to the account status page', () => {
    expect(resolveLandingRoute({})).toBe('/cuenta');
  });
});
