import { Module } from '@nestjs/common';
import { LedgerDataModule } from './ledger.data.module';
import { UsersCoreModule } from '../users/users.core.module';
import { TransactionsCoreModule } from '../transactions/transactions.core.module';
import { LedgerService } from './ledger.service';
import { LedgerContext } from './ledger-context';
import { WalletOperations } from './wallet-operations';
import { EscrowFundingOperations } from './escrow-funding-operations';
import { PayoutOperations } from './payout-operations';
import { RefundOperations } from './refund-operations';
@Module({
  imports: [LedgerDataModule, UsersCoreModule, TransactionsCoreModule],
  providers: [
    LedgerService,
    LedgerContext,
    WalletOperations,
    EscrowFundingOperations,
    PayoutOperations,
    RefundOperations,
  ],
  exports: [LedgerService, LedgerDataModule],
})
export class LedgerCoreModule {}
