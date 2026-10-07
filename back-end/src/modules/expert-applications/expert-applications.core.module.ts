import { FilesDataModule } from '../files/files.data.module';
import { Module } from '@nestjs/common';
import { ExpertApplicationsService } from './expert-applications.service';
import { ExpertApplicationsDataModule } from '../expert-applications/expert-applications.data.module';
import { UsersCoreModule } from '../users/users.core.module';
import { UnitOfWork } from '../../common/unit-of-work/unit-of-work';
@Module({
  imports: [ExpertApplicationsDataModule, UsersCoreModule, FilesDataModule],
  providers: [ExpertApplicationsService, UnitOfWork],
  exports: [ExpertApplicationsService, ExpertApplicationsDataModule],
})
export class ExpertApplicationsCoreModule {}
