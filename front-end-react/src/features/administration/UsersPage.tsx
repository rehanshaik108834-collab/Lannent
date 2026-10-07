import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { useActor } from '../../shared/api/actor';
import { useStaffData } from './api';
import { ProfileForm, type Profile } from '../profiles/ProfilePage';
import {
  Card,
  Field,
  Notice,
  PageHeader,
  QueryView,
  StatusBadge,
} from '../../shared/ui/ui';
import { ConfirmAction } from '../../shared/ui/ConfirmAction';
import styles from '../../shared/ui/page.module.css';
export function UsersPage() {
  const actor = useActor();
  const cache = useQueryClient();
  const [selected, setSelected] = useState('');
  const [search, setSearch] = useState('');
  const users = useStaffData<Profile[]>('/users');
  const detail = useQuery({
    queryKey: ['staff-account', actor.id, selected],
    queryFn: () => api.request<Profile>(`/users/${selected}`),
    enabled: !!selected,
  });
  const create = useMutation({
    mutationFn: (body: Record<string, string>) =>
      api.request('/users/staff', { method: 'POST', body }),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ['staff'] });
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    create.mutate(
      Object.fromEntries(
        ['name', 'email', 'password', 'role'].map((field) => [
          field,
          String(form.get(field)),
        ]),
      ),
    );
  }
  return (
    <>
      <PageHeader
        title="Manage users"
        subtitle="Edit supported profiles, administer status, and create staff accounts."
      />
      <Card>
        <Field id="user-search" label="Search users">
          <input
            id="user-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </Field>
        <QueryView query={users}>
          {(rows) => (
            <ul className={styles.list}>
              {rows
                .filter((row) =>
                  `${row.name} ${row.email}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((row) => (
                  <UserRow
                    key={row.id}
                    user={row}
                    own={row.id === actor.id}
                    onEdit={() => setSelected(row.id)}
                  />
                ))}
            </ul>
          )}
        </QueryView>
      </Card>
      {selected && (
        <>
          <h2>Edit profile</h2>
          <button onClick={() => setSelected('')}>Close profile editor</button>
          <QueryView query={detail}>
            {(profile) => (
              <ProfileForm
                key={profile.id}
                profile={profile}
                onSaved={() => {
                  void cache.invalidateQueries({ queryKey: ['staff'] });
                }}
              />
            )}
          </QueryView>
        </>
      )}
      <Card>
        <h2>Create staff account</h2>
        <form onSubmit={submit} className={styles.form}>
          <div className={styles.row}>
            {['name', 'email', 'password'].map((field) => (
              <Field
                id={`staff-${field}`}
                key={field}
                label={
                  field === 'name'
                    ? 'Staff name'
                    : field === 'email'
                      ? 'Staff email'
                      : 'Initial password'
                }
              >
                <input
                  id={`staff-${field}`}
                  name={field}
                  type={field === 'name' ? 'text' : field}
                  required
                  autoComplete={field === 'password' ? 'new-password' : 'off'}
                  minLength={field === 'password' ? 8 : undefined}
                />
              </Field>
            ))}
            <Field id="staff-role" label="Staff responsibility">
              <select id="staff-role" name="role">
                <option value="superuser">Operations</option>
                <option value="revenue-admin">Revenue</option>
                <option value="intake-admin">Expert intake</option>
                <option value="compliance-admin">Compliance</option>
              </select>
            </Field>
          </div>
          <Notice
            error={create.error}
            success={create.isSuccess ? 'Staff account created.' : undefined}
          />
          <button disabled={create.isPending}>Create staff account</button>
        </form>
      </Card>
    </>
  );
}
function UserRow({
  user,
  own,
  onEdit,
}: {
  user: Profile;
  own: boolean;
  onEdit: () => void;
}) {
  const cache = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const change = useMutation({
    mutationFn: () =>
      api.request(`/users/${user.id}/status`, {
        method: 'PATCH',
        body: { status: user.status === 'suspended' ? 'active' : 'suspended' },
      }),
    onSuccess: () => {
      setConfirm(false);
      void cache.invalidateQueries({ queryKey: ['staff'] });
    },
  });
  return (
    <li className={styles.item}>
      <div className={styles.itemHead}>
        <h3>{user.name}</h3>
        <StatusBadge status={user.status ?? 'active'} />
      </div>
      <p>
        {user.email} · {user.role}
      </p>
      <div className={styles.inline}>
        <button onClick={onEdit}>Edit {user.name}</button>
        {!own && (
          <ConfirmAction
            label={
              user.status === 'suspended'
                ? 'Activate account'
                : 'Suspend account'
            }
            confirmLabel="Confirm status change"
            explanation="This changes whether the account can sign in and use existing tokens."
            open={confirm}
            onOpenChange={setConfirm}
            pending={change.isPending}
            onConfirm={() => change.mutate()}
            danger={user.status !== 'suspended'}
          />
        )}
      </div>
      <Notice error={change.error} />
    </li>
  );
}
