import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { useActor } from '../../shared/api/actor';
import { keys } from '../../shared/api/keys';
import { useAuth } from '../auth/auth-context';
import type { Account } from '../../shared/types/domain';
import { Card, Field, Notice, PageHeader, QueryView } from '../../shared/ui/ui';
import styles from '../../shared/ui/page.module.css';

type Portfolio = {
  id: string;
  title: string;
  description?: string;
  url?: string;
  thumbnail?: string;
};
export interface Profile extends Account {
  phone?: string;
  phoneCountryCode?: string;
  bio?: string;
  avatar?: string;
  companyDetails?: {
    name?: string;
    industry?: string;
    website?: string;
    size?: string;
    location?: string;
  };
  jobTitle?: string;
  experienceLevel?: string;
  languages?: string[];
  portfolioProjects?: Portfolio[];
  specialization?: string;
  auditDomains?: string[];
  availability?: string | { status?: string; maxCases?: string; type?: string };
}
const domains = [
  'frontend',
  'backend',
  'mobile',
  'devops',
  'database',
  'security',
  'ai',
  'sysdesign',
];
const list = (value: FormDataEntryValue | null) =>
  String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

/** Only supported editable fields cross this boundary; identity and balances never do. */
export function profileInput(
  form: FormData,
  role: string,
  portfolio: Portfolio[],
) {
  const text = (name: string) => String(form.get(name) ?? '').trim();
  const shared = {
    name: text('name'),
    avatar: text('avatar'),
    avatarColor: text('avatarColor'),
    phone: text('phone'),
    phoneCountryCode: text('phoneCountryCode'),
    bio: text('bio'),
  };
  if (role === 'client')
    return {
      ...shared,
      company: text('company'),
      location: text('location'),
      companyDetails: {
        name: text('company'),
        industry: text('industry'),
        website: text('website'),
        size: text('size'),
        location: text('companyLocation'),
      },
    };
  if (role === 'worker')
    return {
      ...shared,
      location: text('location'),
      jobTitle: text('jobTitle'),
      experienceLevel: text('experienceLevel'),
      hourlyRate: Number(text('hourlyRate')),
      availability: text('availability'),
      skills: list(form.get('skills')),
      languages: list(form.get('languages')),
      portfolioProjects: portfolio.map((row) => ({
        ...row,
        url: row.url?.trim() || undefined,
        thumbnail: row.thumbnail?.trim() || undefined,
      })),
    };
  if (role === 'expert')
    return {
      ...shared,
      location: text('location'),
      specialization: text('specialization'),
      hourlyRate: Number(text('hourlyRate')),
      availability: {
        status: text('availabilityStatus'),
        maxCases: text('maxCases'),
        type: text('availabilityType'),
      },
      auditDomains: form.getAll('auditDomains').map(String),
    };
  return shared;
}
export function ProfilePage() {
  const actor = useActor();
  const query = useQuery({
    queryKey: keys.account(actor.id),
    queryFn: () => api.request<Profile>(`/users/${actor.id}`),
  });
  return (
    <>
      <PageHeader
        title="Profile settings"
        subtitle="Save your supported profile details. Account email and role are read-only."
      />
      <QueryView query={query}>
        {(profile) => <ProfileForm key={profile.id} profile={profile} />}
      </QueryView>
    </>
  );
}
export function ProfileForm({
  profile,
  onSaved,
}: {
  profile: Profile;
  onSaved?: () => void;
}) {
  const actor = useActor();
  const auth = useAuth();
  const cache = useQueryClient();
  const [portfolio, setPortfolio] = useState(profile.portfolioProjects ?? []);
  const mutation = useMutation({
    mutationFn: (body: ReturnType<typeof profileInput>) =>
      api.request<Profile>(`/users/${profile.id}`, { method: 'PATCH', body }),
    onSuccess: (saved) => {
      if (saved.id === actor.id) {
        cache.setQueryData(keys.account(actor.id), saved);
        auth.updateIdentity(saved);
      }
      onSaved?.();
    },
  });
  const input = (
    name: string,
    label: string,
    value?: string | number,
    type = 'text',
  ) => (
    <Field key={name} id={name} label={label}>
      <input
        id={name}
        name={name}
        defaultValue={value ?? ''}
        type={type}
        required={name === 'name'}
        min={type === 'number' ? 0 : undefined}
        step={type === 'number' ? '0.01' : undefined}
        maxLength={
          type === 'number'
            ? undefined
            : name === 'phoneCountryCode'
              ? 6
              : name === 'phone'
                ? 24
                : 120
        }
      />
    </Field>
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate(
      profileInput(new FormData(event.currentTarget), profile.role, portfolio),
    );
  }
  const availability =
    typeof profile.availability === 'object' ? profile.availability : {};
  return (
    <Card>
      <form onSubmit={submit} className={styles.form}>
        <div className={styles.row}>
          {input('name', 'Display name', profile.name)}
          {input('avatar', 'Avatar initials', profile.avatar)}
          {input('avatarColor', 'Avatar background', profile.avatarColor)}
          <Field id="email" label="Email">
            <input id="email" value={profile.email} readOnly />
          </Field>
          <Field id="role" label="Account role">
            <input id="role" value={profile.role} readOnly />
          </Field>
          {input('phone', 'Phone', profile.phone, 'tel')}
          {input(
            'phoneCountryCode',
            'Phone country code',
            profile.phoneCountryCode,
          )}
        </div>
        <Field id="bio" label="About you">
          <textarea
            className={styles.textarea}
            id="bio"
            name="bio"
            maxLength={2000}
            defaultValue={profile.bio ?? ''}
          />
        </Field>
        {['client', 'worker', 'expert'].includes(profile.role) &&
          input('location', 'Location', profile.location)}
        {profile.role === 'client' && (
          <>
            <h2>Company</h2>
            <div className={styles.row}>
              {input(
                'company',
                'Company name',
                profile.companyDetails?.name ?? profile.company,
              )}
              {input('industry', 'Industry', profile.companyDetails?.industry)}
              {input(
                'website',
                'Company website',
                profile.companyDetails?.website,
                'url',
              )}
              {input('size', 'Company size', profile.companyDetails?.size)}
              {input(
                'companyLocation',
                'Company location',
                profile.companyDetails?.location,
              )}
            </div>
          </>
        )}
        {profile.role === 'worker' && (
          <>
            <h2>Professional details</h2>
            <div className={styles.row}>
              {input('jobTitle', 'Job title', profile.jobTitle)}
              {input(
                'experienceLevel',
                'Experience level',
                profile.experienceLevel,
              )}
              {input(
                'hourlyRate',
                'Hourly rate (INR)',
                profile.hourlyRate ?? 0,
                'number',
              )}
              {input(
                'availability',
                'Availability',
                typeof profile.availability === 'string'
                  ? profile.availability
                  : '',
              )}
              {input(
                'skills',
                'Skills (comma separated)',
                profile.skills?.join(', '),
              )}
              {input(
                'languages',
                'Languages (comma separated)',
                profile.languages?.join(', '),
              )}
            </div>
            <h2>Portfolio</h2>
            {portfolio.map((row, index) => (
              <fieldset key={row.id}>
                <legend>Project {index + 1}</legend>
                {(['title', 'description', 'url', 'thumbnail'] as const).map(
                  (field) => (
                    <label key={field}>
                      {field === 'url'
                        ? 'Project URL'
                        : field === 'thumbnail'
                          ? 'Thumbnail URL'
                          : field}
                      <input
                        aria-label={`Portfolio ${index + 1} ${field}`}
                        type={
                          field === 'url' || field === 'thumbnail'
                            ? 'url'
                            : 'text'
                        }
                        required={field === 'title'}
                        value={row[field] ?? ''}
                        onChange={(event) =>
                          setPortfolio(
                            portfolio.map((item) =>
                              item.id === row.id
                                ? { ...item, [field]: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </label>
                  ),
                )}
                <button
                  type="button"
                  onClick={() =>
                    setPortfolio(portfolio.filter((item) => item.id !== row.id))
                  }
                >
                  Remove project {index + 1}
                </button>
              </fieldset>
            ))}
            <button
              type="button"
              disabled={portfolio.length >= 50}
              onClick={() =>
                setPortfolio([
                  ...portfolio,
                  { id: crypto.randomUUID(), title: '' },
                ])
              }
            >
              Add portfolio project
            </button>
          </>
        )}
        {profile.role === 'expert' && (
          <>
            <h2>Expert preferences</h2>
            <div className={styles.row}>
              {input(
                'specialization',
                'Specialization',
                profile.specialization,
              )}
              {input(
                'hourlyRate',
                'Hourly rate (INR)',
                profile.hourlyRate ?? 0,
                'number',
              )}
              {input(
                'availabilityStatus',
                'Availability status',
                availability?.status,
              )}
              {input(
                'maxCases',
                'Maximum concurrent cases',
                availability?.maxCases,
              )}
              {input(
                'availabilityType',
                'Review type preference',
                availability?.type,
              )}
            </div>
            <fieldset>
              <legend>Audit preferences</legend>
              {domains.map((domain) => (
                <label key={domain} className={styles.inline}>
                  <input
                    type="checkbox"
                    name="auditDomains"
                    value={domain}
                    defaultChecked={profile.auditDomains?.includes(domain)}
                    style={{ width: 'auto' }}
                  />
                  {domain}
                </label>
              ))}
            </fieldset>
          </>
        )}
        <Notice
          error={mutation.error}
          success={mutation.isSuccess ? 'Profile saved.' : undefined}
        />
        <button className={styles.primary} disabled={mutation.isPending}>
          Save profile
        </button>
      </form>
    </Card>
  );
}
