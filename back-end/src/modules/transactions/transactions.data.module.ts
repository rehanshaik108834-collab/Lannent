import { Module } from '@nestjs/common';
import { TransactionsRepository } from './transactions.repository';

/** Leaf storage module: imports no workflows or HTTP modules. */
@Module({
  providers: [TransactionsRepository],
  exports: [TransactionsRepository],
})
export class TransactionsDataModule {}
