import { BadRequestException } from '@nestjs/common';

/**
 * Removes workflow-owned fields from a generic update, refusing any attempt to
 * change them.
 *
 * Generic PATCH routes may edit ordinary metadata only. Status, assignment,
 * balances and similar fields move through named operations that check the
 * actor and the transition. Legacy forms resend whole records, so a field that
 * is present but unchanged is dropped silently; a changed value is rejected.
 *
 * Fields left out of the request are dropped too. Validated DTO instances
 * carry every declared property, with `undefined` for the ones not sent, and
 * repositories merge with a spread, so an `undefined` that survived here used
 * to overwrite the stored value: editing a project's title erased its status
 * and progress.
 *
 * @returns a copy of `input` without the protected fields or omitted fields.
 */
export function stripUnchangedProtectedFields<T extends object>(
  input: T,
  current: Record<string, unknown>,
  fields: readonly string[],
  explain: (field: string) => string,
): Partial<T> {
  const result = { ...input } as Record<string, unknown>;
  for (const key of Object.keys(result)) {
    if (result[key] === undefined) delete result[key];
  }
  for (const field of fields) {
    if (!(field in result)) continue;
    if (!sameValue(result[field], current[field])) {
      throw new BadRequestException(explain(field));
    }
    delete result[field];
  }
  return result as Partial<T>;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == b;
  return JSON.stringify(a) === JSON.stringify(b);
}
