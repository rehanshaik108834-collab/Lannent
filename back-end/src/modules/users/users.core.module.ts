import { Module } from '@nestjs/common';
import { UsersDataModule } from './users.data.module';
import { UsersService } from './users.service';
/** Service-only composition, with no HTTP or financial workflow imports. */
@Module({
  imports: [UsersDataModule],
  providers: [UsersService],
  exports: [UsersService, UsersDataModule],
})
export class UsersCoreModule {}
