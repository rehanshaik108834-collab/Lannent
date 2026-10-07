import { useQueryClient } from '@tanstack/react-query';

/**
 * Refreshes every cached query whose key starts with one of `prefixes`.
 * Called only after the server confirms a mutation — nothing is optimistic.
 *
 * Deliberately not awaited: if a mutation's onSuccess returned this promise,
 * TanStack Query would wait for the refetch before running per-call
 * callbacks, and a refetch that unmounts the calling component (e.g. a hired
 * project leaving the "open" list) would swallow its confirmation message.
 */
export function useInvalidate() {
  const client = useQueryClient();
  return (prefixes: readonly string[]): void => {
    void client.invalidateQueries({
      predicate: (query) => prefixes.includes(String(query.queryKey[0])),
    });
  };
}
