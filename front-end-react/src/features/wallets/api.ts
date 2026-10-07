import { api } from '../../shared/api/client';
import type {
  Account,
  DirectoryUser,
  Transaction,
  WalletMovement,
} from '../../shared/types/domain';

/** Wire adapters for accounts and wallets. Balances only move through these ledger operations. */

export const getAccount = (id: string) =>
  api.request<Account>(`/users/${encodeURIComponent(id)}`);

export const listDirectory = (role: string) =>
  api.request<DirectoryUser[]>(`/users?role=${encodeURIComponent(role)}`);

/** Your own history; the server scopes it to the signed-in account. */
export const listTransactions = () =>
  api.request<Transaction[]>('/transactions');

/** Demo top-up: card processing fee is deducted by the server. */
export const deposit = (userId: string, amount: number) =>
  api.request<WalletMovement>(
    `/users/${encodeURIComponent(userId)}/wallet/add`,
    { method: 'POST', body: { amount } },
  );

/** Demo withdrawal: the payout fee is deducted by the server. */
export const withdraw = (userId: string, amount: number) =>
  api.request<WalletMovement>(
    `/users/${encodeURIComponent(userId)}/wallet/withdraw`,
    { method: 'POST', body: { amount } },
  );
