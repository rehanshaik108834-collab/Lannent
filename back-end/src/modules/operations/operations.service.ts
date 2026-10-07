import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Actor } from '../../common/decorators/current-actor.decorator';
import { UnitOfWork } from '../../common/unit-of-work/unit-of-work';
import { toPaise, CURRENCY } from '../../common/money/inr';
import { TasksService } from '../tasks/tasks.service';
import { TasksRepository } from '../tasks/tasks.repository';
import { MilestonesService } from '../milestones/milestones.service';
import { MilestonesRepository } from '../milestones/milestones.repository';
import { AuditRequestsService } from '../audit-requests/audit-requests.service';
import { AuditRequestsRepository } from '../audit-requests/audit-requests.repository';
import { DisputesRepository } from '../disputes/disputes.repository';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateProjectForClientDto,
  EditOperationsProjectDto,
} from './operations.dto';

/** Operations acts under its own identity, with an explicit client/reviewer target. */
@Injectable()
export class OperationsService {
  constructor(
    private readonly tasks: TasksService,
    private readonly milestones: MilestonesService,
    private readonly engagements: AuditRequestsService,
    private readonly audits: AuditRequestsRepository,
    private readonly disputes: DisputesRepository,
    private readonly users: UsersService,
    private readonly trail: AuditService,
    private readonly uow: UnitOfWork,
  ) {}
  private requireOperations(actor: Actor) {
    if (actor.role !== 'superuser')
      throw new ForbiddenException('This action belongs to operations.');
  }
  createProject(input: CreateProjectForClientDto, actor: Actor) {
    this.requireOperations(actor);
    const client = this.users.findById(input.clientId);
    if (client.role !== 'client' || client.status !== 'active')
      throw new BadRequestException('Select an active client.');
    if (input.currency && input.currency !== CURRENCY)
      throw new BadRequestException('INR only.');
    const initial = input.milestones ?? [];
    if (
      !initial.length ||
      initial.reduce((sum, row) => sum + toPaise(row.budget), 0) !==
        toPaise(input.budget)
    )
      throw new BadRequestException(
        'Initial milestones must allocate the complete project budget.',
      );
    const fields = { ...input };
    delete fields.milestones;
    const result = this.uow.run(
      [TasksRepository, MilestonesRepository, AuditRequestsRepository],
      () => {
        const project = this.tasks.create({
          ...fields,
          clientId: client.id,
          currency: CURRENCY,
        });
        if (!project) throw new NotFoundException('Project creation failed.');
        const milestones = initial.map((row) =>
          this.milestones.create({ ...row, taskId: project.id }),
        );
        return { ...project, milestones };
      },
    );
    this.trail.record({
      kind: 'operations.project.create',
      actorId: actor.id,
      actorRole: actor.role,
      outcome: 'ok',
      detail: { taskId: result.id, clientId: client.id },
    });
    return result;
  }
  editProject(id: string, input: EditOperationsProjectDto, actor: Actor) {
    this.requireOperations(actor);
    const project = this.tasks.findById(id);
    const before = { title: project.title, description: project.description };
    const updated = this.tasks.update(id, {
      title: input.title.trim(),
      description: input.description.trim(),
    });
    this.trail.record({
      kind: 'operations.project.edit',
      actorId: actor.id,
      actorRole: actor.role,
      outcome: 'ok',
      detail: {
        taskId: id,
        before,
        after: { title: updated.title, description: updated.description },
      },
    });
    return updated;
  }

  assignReviewer(id: string, expertId: string, actor: Actor) {
    this.requireOperations(actor);
    const dispute = this.disputes.findById(id);
    if (!dispute) throw new NotFoundException('Dispute not found.');
    if (dispute.status === 'resolved')
      throw new ConflictException('Resolved cases cannot be reassigned.');
    const project = this.tasks.findById(dispute.taskId);
    this.engagements.assertAssignableExpert(expertId, project.category);
    if (expertId === project.clientId || expertId === project.workerId)
      throw new BadRequestException(
        'A project party cannot arbitrate its dispute.',
      );
    if (dispute.expertId === expertId) return dispute;
    const engagement = this.audits
      .findAll({ taskId: project.id, kind: 'dispute-audit' })
      .find((row) => row.disputeId === id);
    if (
      engagement &&
      (engagement.feePaid ||
        !['preview-sent', 'negotiating', 'agreed'].includes(engagement.status))
    )
      throw new ConflictException(
        'A funded or accepted reviewer cannot be replaced.',
      );
    const result = this.uow.run(
      [DisputesRepository, AuditRequestsRepository],
      () => {
        if (engagement)
          this.audits.update(engagement.id, {
            expertId,
            status: 'preview-sent',
            agreedAmount: null,
            offers: [],
          });
        else
          this.engagements.create({
            taskId: project.id,
            clientId: project.clientId,
            workerId: project.workerId || undefined,
            milestoneId: dispute.milestoneId || undefined,
            disputeId: id,
            kind: 'dispute-audit',
            expertId,
            category: project.category,
            project: project.title,
          });
        return this.disputes.update(id, { expertId });
      },
    );
    this.trail.record({
      kind: 'operations.reviewer.assign',
      actorId: actor.id,
      actorRole: actor.role,
      outcome: 'ok',
      detail: { disputeId: id, expertId },
    });
    return result;
  }
}
