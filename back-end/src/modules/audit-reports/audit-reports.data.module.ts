import { Module } from '@nestjs/common';
import { AuditReportsRepository } from './audit-reports.repository';

/** Leaf storage module: imports no workflows or HTTP modules. */
@Module({
  providers: [AuditReportsRepository],
  exports: [AuditReportsRepository],
})
export class AuditReportsDataModule {}
