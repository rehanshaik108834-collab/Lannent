import { Module } from '@nestjs/common';
import { TransactionsDataModule } from './transactions.data.module';
import { TransactionsService } from './transactions.service';
/** Service-only composition, with no HTTP or financial workflow imports. */
@Module({
  imports: [TransactionsDataModule],
  providers: [TransactionsService],
  exports: [TransactionsService, TransactionsDataModule],
})
export class TransactionsCoreModule {}
