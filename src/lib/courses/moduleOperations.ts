import { reorderItems } from './reorderItems';
import type { Module } from '../models/types';

export interface ModuleDeps {
  createModuleDoc: (tenantId: string, courseId: string, module: Omit<Module, 'id'>) => Promise<string>;
  updateModuleDoc: (
    tenantId: string,
    courseId: string,
    moduleId: string,
    updates: Partial<Omit<Module, 'id'>>,
  ) => Promise<void>;
  deleteModuleDoc: (tenantId: string, courseId: string, moduleId: string) => Promise<void>;
  writeModuleOrder: (tenantId: string, courseId: string, orderedIds: string[]) => Promise<void>;
}

export async function createModule(
  deps: ModuleDeps,
  tenantId: string,
  courseId: string,
  input: { title: string; order: number },
): Promise<{ id: string }> {
  const title = input.title.trim();
  if (!title) {
    throw new Error('El módulo necesita un título');
  }
  const id = await deps.createModuleDoc(tenantId, courseId, { title, order: input.order });
  return { id };
}

export async function updateModule(
  deps: ModuleDeps,
  tenantId: string,
  courseId: string,
  moduleId: string,
  updates: Partial<Pick<Module, 'title'>>,
): Promise<void> {
  await deps.updateModuleDoc(tenantId, courseId, moduleId, updates);
}

export async function deleteModule(
  deps: ModuleDeps,
  tenantId: string,
  courseId: string,
  moduleId: string,
): Promise<void> {
  await deps.deleteModuleDoc(tenantId, courseId, moduleId);
}

export async function reorderModules(
  deps: ModuleDeps,
  tenantId: string,
  courseId: string,
  modules: Module[],
  fromIndex: number,
  toIndex: number,
): Promise<Module[]> {
  const reordered = reorderItems(modules, fromIndex, toIndex);
  await deps.writeModuleOrder(
    tenantId,
    courseId,
    reordered.map((m) => m.id),
  );
  return reordered;
}
