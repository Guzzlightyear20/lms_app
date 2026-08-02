import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn().mockReturnValue({ name: 'mock-app' }),
  getApps: vi.fn().mockReturnValue([]),
  getApp: vi.fn(),
}));

import { getFirebaseApp } from './client';
import { initializeApp, getApps } from 'firebase/app';

describe('getFirebaseApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes the app once when none exists yet', () => {
    vi.mocked(getApps).mockReturnValue([]);
    getFirebaseApp();
    expect(initializeApp).toHaveBeenCalledTimes(1);
  });
});
