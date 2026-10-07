import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessagesRepository } from './messages.repository';
import { TasksRepository } from '../tasks/tasks.repository';
import { UsersRepository } from '../users/users.repository';
import { ProposalsRepository } from '../proposals/proposals.repository';
import { AuditRequestsRepository } from '../audit-requests/audit-requests.repository';
import { canViewAnyRecord } from '../../common/guards/viewer.util';
import type { Actor } from '../../common/decorators/current-actor.decorator';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Project conversations.
 *
 * A message belongs to a project and travels between two of its participants:
 * the client, the hired worker, a worker with a proposal or invitation on it,
 * or a reviewer engaged on it. The sender is always the signed-in account.
 */
@Injectable()
export class MessagesService {
  constructor(
    private readonly notifier: NotificationsService,
    private readonly messagesRepository: MessagesRepository,
    private readonly users: UsersRepository,
    private readonly tasks: TasksRepository,
    private readonly proposals: ProposalsRepository,
    private readonly engagements: AuditRequestsRepository,
  ) {}

  /** Your own conversations; oversight roles may read any. Filters narrow, never widen. */
  findAllFor(actor: Actor, query: { taskId?: string; userId?: string }) {
    const visible = canViewAnyRecord(actor.role)
      ? this.messagesRepository.findAll()
      : this.messagesRepository.findAll({ userId: actor.id });
    return visible.filter(
      (m: any) =>
        (!query.taskId || m.taskId === query.taskId) &&
        (!query.userId ||
          m.senderId === query.userId ||
          m.receiverId === query.userId),
    );
  }

  create(dto: CreateMessageDto, actor: Actor) {
    if (dto.senderId && dto.senderId !== actor.id) {
      throw new BadRequestException('senderId must be your own account.');
    }
    if (dto.receiverId === actor.id)
      throw new BadRequestException('You cannot message yourself.');

    const participants = this.participantsOf(dto.taskId);
    if (!participants.has(actor.id)) {
      throw new ForbiddenException(
        'Only people working on this project can message about it.',
      );
    }
    if (!participants.has(dto.receiverId)) {
      throw new BadRequestException(
        'The recipient is not part of this project.',
      );
    }

    const sender = this.users.findById(actor.id);
    const message = this.messagesRepository.insert({
      content: dto.content,
      taskId: dto.taskId,
      receiverId: dto.receiverId,
      id: this.messagesRepository.generateId(),
      createdAt: new Date().toISOString(),
      senderId: actor.id,
      senderName: sender?.name,
      senderAvatar: sender?.avatar,
      senderAvatarColor: sender?.avatarColor,
    });
    const content = dto.content || '';
    this.notifier.notify(
      dto.receiverId,
      'message',
      `New message from ${sender?.name || 'Someone'}`,
      content.length > 50 ? content.substring(0, 50) + '...' : content,
    );
    return message;
  }

  private participantsOf(taskId: string): Set<string> {
    const task = this.tasks.findById(taskId);
    if (!task)
      throw new NotFoundException(`Task with id "${taskId}" not found`);
    const ids = [task.clientId, task.workerId];
    for (const p of this.proposals.findAll({ taskId })) {
      ids.push(p.workerId);
    }
    for (const a of this.engagements.findAll({ taskId })) {
      ids.push(a.expertId);
    }
    return new Set(
      ids.filter((id): id is string => typeof id === 'string' && !!id),
    );
  }

  resetToSeed() {
    this.messagesRepository.resetToSeed();
  }
}
