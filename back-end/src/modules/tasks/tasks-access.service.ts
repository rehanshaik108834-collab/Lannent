import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TasksRepository } from './tasks.repository';
import { AuditRequestsRepository } from '../audit-requests/audit-requests.repository';
import type { TaskRecord } from './tasks.types';
import type { Actor } from '../../common/decorators/current-actor.decorator';
import { canViewAnyRecord } from '../../common/guards/viewer.util';

/** Shared project queries and internal state writes; no financial/workflow dependencies. */
@Injectable()
export class TasksAccessService {
  constructor(
    private readonly tasks: TasksRepository,
    private readonly engagements: AuditRequestsRepository,
  ) {}
  findById(id: string): TaskRecord {
    const task = this.tasks.findById(id);
    if (!task) throw new NotFoundException(`Task with id "${id}" not found`);
    return task;
  }
  findAll(query?: {
    clientId?: string;
    workerId?: string;
    status?: string;
    viewerId?: string;
  }) {
    const { viewerId, ...filters } = query || {};
    const tasks = this.tasks.findAll(filters);
    if (filters.status || filters.clientId) return tasks;
    return tasks.filter(
      (task) =>
        task.status !== 'draft' || (viewerId && task.clientId === viewerId),
    );
  }
  canView(task: TaskRecord, actor: Actor): boolean {
    return (
      canViewAnyRecord(actor.role) ||
      task.clientId === actor.id ||
      task.workerId === actor.id ||
      task.status === 'open' ||
      this.engagements
        .findAll({ taskId: task.id })
        .some((audit) => audit.expertId === actor.id)
    );
  }
  findByIdFor(id: string, actor: Actor): TaskRecord {
    const task = this.findById(id);
    if (!this.canView(task, actor))
      throw new ForbiddenException('You do not have access to this project.');
    return task;
  }
  update(id: string, changes: Partial<TaskRecord>): TaskRecord {
    const task = this.findById(id);
    if (
      task.status === 'draft' &&
      changes.status &&
      changes.status !== 'draft' &&
      changes.status !== 'cancelled'
    ) {
      throw new BadRequestException(
        'This project is awaiting its technical audit. It goes live once a reviewer accepts the audit.',
      );
    }
    return this.tasks.update(id, changes)!;
  }
  publishDraft(id: string): TaskRecord {
    const task = this.findById(id);
    if (task.status === 'draft') task.status = 'open';
    return task;
  }
}
