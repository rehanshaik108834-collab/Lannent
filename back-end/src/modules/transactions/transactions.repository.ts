import type { TransactionRecord } from './transactions.types';
import { Injectable } from '@nestjs/common';
import { SEED_TRANSACTIONS } from '../seed/seed.data';

/**
 * TransactionsRepository — In-Memory Data Access Layer
 *
 * Manages the TRANSACTIONS array and provides low-level CRUD operations.
 * Business logic belongs in TransactionsService.
 */
@Injectable()
export class TransactionsRepository {
  private transactions: TransactionRecord[] =
    structuredClone(SEED_TRANSACTIONS);
  private counter = 100;

  generateId(): string {
    return 'tx_' + Date.now() + '_' + this.counter++;
  }

  findAll(query?: { userId?: string }): TransactionRecord[] {
    if (query?.userId) {
      return this.transactions.filter(
        (t) => t.fromId === query.userId || t.toId === query.userId,
      );
    }
    return this.transactions;
  }

  insert(transaction: TransactionRecord): TransactionRecord {
    this.transactions.push(transaction);
    return transaction;
  }

  resetToSeed(): void {
    this.transactions = structuredClone(SEED_TRANSACTIONS);
  }
}
