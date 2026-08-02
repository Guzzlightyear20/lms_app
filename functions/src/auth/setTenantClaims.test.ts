// functions/src/auth/setTenantClaims.test.ts
import { describe, it, expect, vi } from 'vitest';
import { assignTenantClaims } from './setTenantClaims';

function makeFakeAdminAuth(existingClaims: Record<string, unknown> = {}) {
  const setCustomUserClaims = vi.fn().mockResolvedValue(undefined);
  const getUser = vi.fn().mockResolvedValue({ customClaims: existingClaims });
  return { setCustomUserClaims, getUser } as any;
}

describe('assignTenantClaims', () => {
  it('sets tenantId and role claims on the target user', async () => {
    const adminAuth = makeFakeAdminAuth();

    await assignTenantClaims(adminAuth, {
      callerClaims: { tenantId: 'tenant-a', role: 'owner' },
      targetUid: 'user-2',
      tenantId: 'tenant-a',
      role: 'instructor',
    });

    expect(adminAuth.setCustomUserClaims).toHaveBeenCalledWith('user-2', {
      tenantId: 'tenant-a',
      role: 'instructor',
    });
  });

  it('rejects when the caller is not an owner', async () => {
    const adminAuth = makeFakeAdminAuth();

    await expect(
      assignTenantClaims(adminAuth, {
        callerClaims: { tenantId: 'tenant-a', role: 'instructor' },
        targetUid: 'user-2',
        tenantId: 'tenant-a',
        role: 'instructor',
      }),
    ).rejects.toThrow('caller must be an owner');

    expect(adminAuth.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it('rejects when the caller belongs to a different tenant', async () => {
    const adminAuth = makeFakeAdminAuth();

    await expect(
      assignTenantClaims(adminAuth, {
        callerClaims: { tenantId: 'tenant-a', role: 'owner' },
        targetUid: 'user-2',
        tenantId: 'tenant-b',
        role: 'instructor',
      }),
    ).rejects.toThrow('caller cannot assign claims outside their own tenant');

    expect(adminAuth.setCustomUserClaims).not.toHaveBeenCalled();
  });
});
