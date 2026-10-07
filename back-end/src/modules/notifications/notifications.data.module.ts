import { Module } from '@nestjs/common';
import { NotificationsRepository } from './notifications.repository';

/** Leaf storage module: imports no workflows or HTTP modules. */
@Module({
  providers: [NotificationsRepository],
  exports: [NotificationsRepository],
})
export class NotificationsDataModule {}
