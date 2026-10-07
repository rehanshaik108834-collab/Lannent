import type { TaskRecord } from './tasks.types';
import { Injectable } from '@nestjs/common';
import { SEED_TASKS } from '../seed/seed.data';

/**
 * TasksRepository — In-Memory Data Access Layer
 *
 * Manages the TASKS array and provides low-level CRUD operations.
 * Business logic (validation, error throwing) belongs in TasksService.
 */
@Injectable()
export class TasksRepository {
  private tasks: TaskRecord[] = structuredClone(SEED_TASKS);
  private counter = 100;

  generateId(): string {
    return 't_' + Date.now() + '_' + this.counter++;
  }

  findAll(query?: {
    clientId?: string;
    workerId?: string;
    status?: string;
  }): TaskRecord[] {
    let result = this.tasks;
    if (query?.clientId)
      result = result.filter((t) => t.clientId === query.clientId);
    if (query?.workerId)
      result = result.filter((t) => t.workerId === query.workerId);
    if (query?.status) result = result.filter((t) => t.status === query.status);
    return result;
  }

  findById(id: string): TaskRecord | null {
    return this.tasks.find((t) => t.id === id) || null;
  }

  insert(task: TaskRecord): TaskRecord {
    this.tasks.push(task);
    return task;
  }

  update(id: string, partial: Partial<TaskRecord>): TaskRecord | null {
    const idx = this.tasks.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    this.tasks[idx] = { ...this.tasks[idx], ...partial };
    return this.tasks[idx];
  }

  deleteById(id: string): boolean {
    const idx = this.tasks.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    this.tasks.splice(idx, 1);
    return true;
  }

  resetToSeed(): void {
    this.tasks = structuredClone(SEED_TASKS);
  }
}
