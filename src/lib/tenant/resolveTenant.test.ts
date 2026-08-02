import { describe, it, expect } from 'vitest';
import { resolveTenant } from './resolveTenant';

describe('resolveTenant', () => {
  it('extracts tenant from subdomain', () => {
    const result = resolveTenant({
      host: 'academia-x.tucampus.com',
      rootDomain: 'tucampus.com',
    });
    expect(result).toBe('academia-x');
  });

  it('returns null for the bare root domain (no tenant)', () => {
    const result = resolveTenant({
      host: 'tucampus.com',
      rootDomain: 'tucampus.com',
    });
    expect(result).toBeNull();
  });

  it('returns null for the www subdomain', () => {
    const result = resolveTenant({
      host: 'www.tucampus.com',
      rootDomain: 'tucampus.com',
    });
    expect(result).toBeNull();
  });

  it('prefers the explicit embed tenantId over the host', () => {
    const result = resolveTenant({
      host: 'tucampus.com',
      rootDomain: 'tucampus.com',
      embedTenantId: 'academia-y',
    });
    expect(result).toBe('academia-y');
  });

  it('returns null when host does not match the root domain', () => {
    const result = resolveTenant({
      host: 'evil.example.com',
      rootDomain: 'tucampus.com',
    });
    expect(result).toBeNull();
  });
});
