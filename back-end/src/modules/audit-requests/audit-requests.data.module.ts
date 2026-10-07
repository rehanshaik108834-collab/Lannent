import { Module } from '@nestjs/common';
import { AuditRequestsRepository } from './audit-requests.repository';

/** Leaf storage module: imports no workflows or HTTP modules. */
@Module({
  providers: [AuditRequestsRepository],
  exports: [AuditRequestsRepository],
})
export class AuditRequestsDataModule {}
