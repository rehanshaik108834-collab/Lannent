import { Global, Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditDataModule } from './audit.data.module';

/**
 * Global so the middleware that already observes every request can record
 * without each feature module importing this one.
 */
@Global()
@Module({
  imports: [AuditDataModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
