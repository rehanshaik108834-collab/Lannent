import { Module } from '@nestjs/common';
import { ExpertApplicationsRepository } from './expert-applications.repository';

/** Leaf storage module: imports no workflows or HTTP modules. */
@Module({
  providers: [ExpertApplicationsRepository],
  exports: [ExpertApplicationsRepository],
})
export class ExpertApplicationsDataModule {}
