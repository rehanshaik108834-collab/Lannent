import { useMutation, useQuery } from '@tanstack/react-query';
import { useActor } from '../../shared/api/actor';
import { useInvalidate } from '../../shared/api/invalidate';
import { keys } from '../../shared/api/keys';
import {
  deposit,
  getAccount,
  listDirectory,
  listTransactions,
  withdraw,
} from './api';

/** The signed-in account's own record, including wallet balance. */
export function useAccount() {
  const actor = useActor();
  return useQuery({
    queryKey: keys.account(actor.id),
    queryFn: () => getAccount(actor.id),
  });
}

export function useDirectory(role: 'worker' | 'client' | 'expert') {
  const actor = useActor();
  return useQuery({
    queryKey: keys.directory(actor.id, role),
    queryFn: () => listDirectory(role),
  });
}

export function useTransactions() {
  const actor = useActor();
  return useQuery({
    queryKey: keys.transactions(actor.id),
    queryFn: listTransactions,
  });
}

export function useWalletMovement(kind: 'deposit' | 'withdraw') {
  const actor = useActor();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (amount: number) =>
      kind === 'deposit'
        ? deposit(actor.id, amount)
        : withdraw(actor.id, amount),
    onSuccess: () => invalidate(['account', 'transactions']),
  });
}

/** Another account's directory entry (or your own full account). */
export function useUser(id: string | null | undefined) {
  const actor = useActor();
  return useQuery({
    queryKey: ['user', actor.id, id ?? ''],
    queryFn: () => getAccount(id!),
    enabled: !!id,
  });
}
