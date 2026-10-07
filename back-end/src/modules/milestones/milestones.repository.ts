import type { MilestoneRecord } from './milestones.types';
import { Injectable } from '@nestjs/common';
import { SEED_MILESTONES } from '../seed/seed.data';

/**
 * MilestonesRepository — In-Memory Data Access Layer
 *
 * Manages the MILESTONES array and provides low-level CRUD operations.
 * Business logic (submit, approve, task-completion check) belongs in MilestonesService.
 */
@Injectable()
export class MilestonesRepository {
  private milestones: MilestoneRecord[] = structuredClone(SEED_MILESTONES);
  private counter = 100;

  generateId(): string {
    return 'm_' + Date.now() + '_' + this.counter++;
  }

  findAll(query?: { taskId?: string }): MilestoneRecord[] {
    let result = this.milestones;
    if (query?.taskId) result = result.filter((m) => m.taskId === query.taskId);
    return result;
  }

  findById(id: string): MilestoneRecord | null {
    return this.milestones.find((m) => m.id === id) || null;
  }

  insert(milestone: MilestoneRecord): MilestoneRecord {
    this.milestones.push(milestone);
    return milestone;
  }

  update(
    id: string,
    partial: Partial<MilestoneRecord>,
  ): MilestoneRecord | null {
    const idx = this.milestones.findIndex((m) => m.id === id);
    if (idx === -1) return null;
    this.milestones[idx] = { ...this.milestones[idx], ...partial };
    return this.milestones[idx];
  }

  /** Removes every milestone of a project. Used only when an unfunded project is deleted. */
  deleteByTaskId(taskId: string): number {
    const before = this.milestones.length;
    this.milestones = this.milestones.filter((m) => m.taskId !== taskId);
    return before - this.milestones.length;
  }

  filterByTaskId(taskId: string): MilestoneRecord[] {
    return this.milestones.filter((m) => m.taskId === taskId);
  }

  resetToSeed(): void {
    this.milestones = structuredClone(SEED_MILESTONES);
  }
}
