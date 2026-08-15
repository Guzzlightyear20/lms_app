import { describe, it, expect, vi } from 'vitest';
import {
  createModule,
  updateModule,
  deleteModule,
  reorderModules,
  type ModuleDeps,
} from './moduleOperations';
import type { Module } from '../models/types';

function makeDeps(overrides: Partial<ModuleDeps> = {}): ModuleDeps {
  return {
    createModuleDoc: vi.fn().mockResolvedValue('module-1'),
    updateModuleDoc: vi.fn().mockResolvedValue(undefined),
    deleteModuleDoc: vi.fn().mockResolvedValue(undefined),
    writeModuleOrder: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('createModule', () => {
  it('rejects an empty title', async () => {
    const deps = makeDeps();
    await expect(createModule(deps, 'tenant-a', 'course-1', { title: ' ', order: 0 })).rejects.toThrow(
      'El módulo necesita un título',
    );
    expect(deps.createModuleDoc).not.toHaveBeenCalled();
  });

  it('creates a module with trimmed title', async () => {
    const deps = makeDeps();
    const result = await createModule(deps, 'tenant-a', 'course-1', { title: ' Módulo 1 ', order: 2 });
    expect(deps.createModuleDoc).toHaveBeenCalledWith('tenant-a', 'course-1', {
      title: 'Módulo 1',
      order: 2,
    });
    expect(result).toEqual({ id: 'module-1' });
  });
});

describe('updateModule', () => {
  it('passes through to updateModuleDoc', async () => {
    const deps = makeDeps();
    await updateModule(deps, 'tenant-a', 'course-1', 'module-1', { title: 'Nuevo título' });
    expect(deps.updateModuleDoc).toHaveBeenCalledWith('tenant-a', 'course-1', 'module-1', {
      title: 'Nuevo título',
    });
  });
});

describe('deleteModule', () => {
  it('passes through to deleteModuleDoc', async () => {
    const deps = makeDeps();
    await deleteModule(deps, 'tenant-a', 'course-1', 'module-1');
    expect(deps.deleteModuleDoc).toHaveBeenCalledWith('tenant-a', 'course-1', 'module-1');
  });
});

describe('reorderModules', () => {
  const modules: Module[] = [
    { id: 'm1', title: 'Uno', order: 0 },
    { id: 'm2', title: 'Dos', order: 1 },
    { id: 'm3', title: 'Tres', order: 2 },
  ];

  it('reorders the array and writes the new id order', async () => {
    const deps = makeDeps();
    const result = await reorderModules(deps, 'tenant-a', 'course-1', modules, 0, 2);
    expect(result.map((m) => m.id)).toEqual(['m2', 'm3', 'm1']);
    expect(deps.writeModuleOrder).toHaveBeenCalledWith('tenant-a', 'course-1', ['m2', 'm3', 'm1']);
  });

  it('stamps the returned array order fields to match the new positions', async () => {
    const deps = makeDeps();
    const result = await reorderModules(deps, 'tenant-a', 'course-1', modules, 0, 2);
    expect(result.map((m) => m.order)).toEqual([0, 1, 2]);
  });
});
