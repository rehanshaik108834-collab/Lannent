import { MilestonesRepository } from '../milestones/milestones.repository';
import { TasksRepository } from '../tasks/tasks.repository';
import { UsersRepository } from '../users/users.repository';
import { TransactionsRepository } from '../transactions/transactions.repository';
import { LedgerRepository } from './ledger.repository';

/**
 * Every repository a money movement can write to: balances, escrow, revenue,
 * transaction history, and the project/milestone records the movement settles.
 * Pass these (plus any workflow-specific stores) to `UnitOfWork.run`.
 */
export const SETTLEMENT_STORES = [
  MilestonesRepository,
  TasksRepository,
  UsersRepository,
  TransactionsRepository,
  LedgerRepository,
];
