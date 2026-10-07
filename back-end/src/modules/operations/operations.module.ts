import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { OperationsService } from './operations.service';
import { OperationsController } from './operations.controller';
import { TasksCoreModule } from '../tasks/tasks.core.module';
import { MilestonesCoreModule } from '../milestones/milestones.core.module';
import { AuditRequestsCoreModule } from '../audit-requests/audit-requests.core.module';
import { DisputesDataModule } from '../disputes/disputes.data.module';
import { UsersCoreModule } from '../users/users.core.module';
import { UnitOfWork } from '../../common/unit-of-work/unit-of-work';
import { RequireAuthMiddleware } from '../../common/middleware/require-auth.middleware';
import { AdminAuditMiddleware } from '../../common/middleware/admin-audit.middleware';
@Module({
  imports: [
    TasksCoreModule,
    MilestonesCoreModule,
    AuditRequestsCoreModule,
    DisputesDataModule,
    UsersCoreModule,
  ],
  providers: [OperationsService, UnitOfWork],
  controllers: [OperationsController],
})
export class OperationsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequireAuthMiddleware, AdminAuditMiddleware)
      .forRoutes(OperationsController);
  }
}
