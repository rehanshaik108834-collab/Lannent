import { Injectable, Logger } from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationsRepository } from './notifications.repository';

/**
 * NotificationsService — Business Logic Layer
 *
 * Delegates all data-access operations to NotificationsRepository.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly notificationsRepository: NotificationsRepository) {}

  findAll(query?: { userId?: string }) {
    return this.notificationsRepository.findAll(query);
  }

  create(dto: CreateNotificationDto) {
    const notif = {
      id: this.notificationsRepository.generateId(),
      read: false,
      createdAt: new Date().toISOString().slice(0, 10),
      subtext: dto.subtext || '',
      ...dto,
    };
    return this.notificationsRepository.insert(notif);
  }

  /**
   * Tells someone about an action that has already been committed. Clients can
   * no longer write notifications (POST /notifications is retired, so nobody
   * can forge one into another user's inbox); the services that perform an
   * action call this instead. A failure is logged and never undoes the action.
   */
  notify(
    userId: string | null | undefined,
    type: string,
    text: string,
    subtext = '',
  ) {
    if (!userId) return;
    try {
      this.create({ userId, type, text, subtext });
    } catch (e) {
      new Logger('Notifications').warn(
        `could not notify ${userId} (${type}): ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  markAllRead(userId: string) {
    const count = this.notificationsRepository.markAllReadByUserId(userId);
    return { markedRead: count };
  }

  resetToSeed() {
    this.notificationsRepository.resetToSeed();
  }
}
