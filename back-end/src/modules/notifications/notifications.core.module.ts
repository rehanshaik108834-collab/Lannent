import { Module } from '@nestjs/common';
import { NotificationsDataModule } from './notifications.data.module';
import { NotificationsService } from './notifications.service';
/** Service-only composition, with no HTTP or financial workflow imports. */
@Module({
  imports: [NotificationsDataModule],
  providers: [NotificationsService],
  exports: [NotificationsService, NotificationsDataModule],
})
export class NotificationsCoreModule {}
