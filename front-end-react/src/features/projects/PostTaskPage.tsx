import { useReducer, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { formatMoney } from '../../shared/format/format';
import { Card, Field, Notice, PageHeader } from '../../shared/ui/ui';
import page from '../../shared/ui/page.module.css';
import type { NewMilestone } from './api';
import { useCreateProject } from './hooks';
import { useDirectory } from '../wallets/hooks';

export const CATEGORIES = [
  'Web Development',
  'Mobile Development',
  'Backend / API',
  'UI/UX Design',
  'AI / Machine Learning',
  'DevOps / Cloud',
] as const;

interface MilestoneDraft {
  key: number;
  title: string;
  description: string;
  budget: string;
  dueDate: string;
}

interface Draft {
  title: string;
  description: string;
  category: string;
  budget: string;
  deadline: string;
  skills: string;
  milestones: MilestoneDraft[];
  nextKey: number;
}

type Action =
  | {
      type: 'field';
      name: keyof Omit<Draft, 'milestones' | 'nextKey'>;
      value: string;
    }
  | {
      type: 'milestone';
      key: number;
      name: keyof Omit<MilestoneDraft, 'key'>;
      value: string;
    }
  | { type: 'addMilestone' }
  | { type: 'removeMilestone'; key: number };

const blankMilestone = (key: number): MilestoneDraft => ({
  key,
  title: '',
  description: '',
  budget: '',
  dueDate: '',
});

const initial: Draft = {
  title: '',
  description: '',
  category: CATEGORIES[0],
  budget: '',
  deadline: '',
  skills: '',
  milestones: [blankMilestone(1)],
  nextKey: 2,
};

function reduce(draft: Draft, action: Action): Draft {
  switch (action.type) {
    case 'field':
      return { ...draft, [action.name]: action.value };
    case 'milestone':
      return {
        ...draft,
        milestones: draft.milestones.map((m) =>
          m.key === action.key ? { ...m, [action.name]: action.value } : m,
        ),
      };
    case 'addMilestone':
      return {
        ...draft,
        milestones: [...draft.milestones, blankMilestone(draft.nextKey)],
        nextKey: draft.nextKey + 1,
      };
    case 'removeMilestone':
      return {
        ...draft,
        milestones: draft.milestones.filter((m) => m.key !== action.key),
      };
  }
}

/** Whole paise for a rupee input, or null when it is not a positive amount with at most two decimals. */
export function toPaise(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  const paise = Math.round(Number(value) * 100);
  return paise > 0 ? paise : null;
}

type Errors = Partial<Record<string, string>>;

/** Checks the form before anything is sent. The server re-validates everything. */
export function validate(draft: Draft): Errors {
  const errors: Errors = {};
  if (draft.title.trim().length < 3)
    errors.title = 'Give the project a title of at least 3 characters.';
  if (draft.description.trim().length < 10)
    errors.description = 'Describe the work in at least 10 characters.';
  const budget = toPaise(draft.budget);
  if (budget === null)
    errors.budget = 'Enter a budget in rupees, e.g. 25000 or 25000.50.';
  if (draft.milestones.length === 0)
    errors.milestones = 'Add at least one milestone.';
  let sum = 0;
  for (const m of draft.milestones) {
    if (m.title.trim().length < 2)
      errors[`m${m.key}-title`] = 'Name this milestone.';
    const paise = toPaise(m.budget);
    if (paise === null)
      errors[`m${m.key}-budget`] = 'Enter this milestone’s budget.';
    else sum += paise;
  }
  if (budget !== null && !errors.milestones && sum !== budget) {
    const difference = formatMoney(Math.abs(budget - sum) / 100);
    errors.milestones =
      sum < budget
        ? `Milestones add up to ${difference} less than the budget. They must match exactly.`
        : `Milestones add up to ${difference} more than the budget. They must match exactly.`;
  }
  return errors;
}

export function PostTaskPage() {
  const [draft, dispatch] = useReducer(reduce, initial);
  const [errors, setErrors] = useState<Errors>({});
  const create = useCreateProject();
  const experts = useDirectory('expert');
  const [audit, setAudit] = useState({ enabled: false, expertId: '', fee: '' });
  const reviewers = (experts.data ?? []).filter(
    (e) =>
      e.status !== 'suspended' &&
      (!e.domains?.length || e.domains.includes(draft.category)),
  );

  const allocated =
    draft.milestones.reduce((sum, m) => sum + (toPaise(m.budget) ?? 0), 0) /
    100;

  function submit(event: FormEvent) {
    event.preventDefault();
    const found = validate(draft);
    if (audit.enabled) {
      if (!audit.expertId)
        found.auditExpertId =
          'Choose the reviewer who will audit this project.';
      if (toPaise(audit.fee) === null)
        found.auditFee = 'Enter your opening offer for the audit fee.';
    }
    setErrors(found);
    if (Object.keys(found).length) return;
    const milestones: NewMilestone[] = draft.milestones.map((m) => ({
      title: m.title.trim(),
      description: m.description.trim() || undefined,
      budget: (toPaise(m.budget) ?? 0) / 100,
      dueDate: m.dueDate || undefined,
    }));
    create.mutate({
      title: draft.title.trim(),
      description: draft.description.trim(),
      category: draft.category,
      budget: (toPaise(draft.budget) ?? 0) / 100,
      deadline: draft.deadline || undefined,
      skills: draft.skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      milestones,
      ...(audit.enabled
        ? {
            auditEnabled: true,
            auditExpertId: audit.expertId,
            auditFee: (toPaise(audit.fee) ?? 0) / 100,
          }
        : {}),
    });
  }

  if (create.data) {
    const project = create.data;
    const count = project.milestones.length;
    const draftProject = project.status === 'draft';
    return (
      <>
        <PageHeader
          title={
            draftProject ? 'Project saved as a draft' : 'Project published'
          }
          subtitle={
            draftProject
              ? `${project.title} goes live once your reviewer accepts.`
              : `${project.title} is open for proposals.`
          }
        />
        <Card>
          <p role="status">
            {draftProject ? 'Saved' : 'Published'} with {count} milestone
            {count === 1 ? '' : 's'}.{' '}
            {draftProject
              ? 'Next, agree the audit fee with your reviewer and fund it from Audit offers.'
              : 'Nothing has been charged yet — your wallet is charged when you hire a worker.'}
          </p>
          <div className={page.inline}>
            {draftProject ? (
              <Link className="button" to="/client/audit-offers">
                Audit offers
              </Link>
            ) : (
              <Link className="button" to={`/tasks/${project.id}`}>
                View project
              </Link>
            )}
            <Link to="/client/projects">My projects</Link>
          </div>
        </Card>
      </>
    );
  }

  const field = (name: Exclude<keyof Draft, 'milestones' | 'nextKey'>) => ({
    value: draft[name],
    onChange: (e: { target: { value: string } }) =>
      dispatch({ type: 'field', name, value: e.target.value }),
    'aria-invalid': !!errors[name],
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
  });

  return (
    <>
      <PageHeader
        title="Post a task"
        subtitle="Describe the work and split the budget into milestones. Amounts are in INR."
      />
      <form className={page.form} onSubmit={submit} noValidate>
        <Card>
          <h2>Project</h2>
          <Field id="title" label="Title" error={errors.title}>
            <input id="title" {...field('title')} />
          </Field>
          <Field
            id="description"
            label="Description"
            error={errors.description}
          >
            <textarea
              id="description"
              className={page.textarea}
              {...field('description')}
            />
          </Field>
          <div className={page.row}>
            <Field id="category" label="Category">
              <select id="category" {...field('category')}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field id="budget" label="Budget (₹)" error={errors.budget}>
              <input id="budget" inputMode="decimal" {...field('budget')} />
            </Field>
            <Field id="deadline" label="Deadline">
              <input id="deadline" type="date" {...field('deadline')} />
            </Field>
          </div>
          <Field
            id="skills"
            label="Skills"
            hint="Separate with commas, e.g. React, Node.js"
          >
            <input id="skills" {...field('skills')} />
          </Field>
        </Card>

        <Card>
          <h2>Milestones</h2>
          <p>
            Allocated {formatMoney(allocated)} of{' '}
            {formatMoney((toPaise(draft.budget) ?? 0) / 100)}. Each milestone is
            paid separately when you approve it.
          </p>
          {errors.milestones && (
            <p role="alert" id="milestones-error">
              {errors.milestones}
            </p>
          )}
          <ol className={page.list}>
            {draft.milestones.map((m, index) => (
              <li key={m.key} className={page.item}>
                <div className={page.itemHead}>
                  <h3>Milestone {index + 1}</h3>
                  {draft.milestones.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        dispatch({ type: 'removeMilestone', key: m.key })
                      }
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className={page.row}>
                  <Field
                    id={`m${m.key}-title`}
                    label={`Milestone ${index + 1} title`}
                    error={errors[`m${m.key}-title`]}
                  >
                    <input
                      id={`m${m.key}-title`}
                      value={m.title}
                      onChange={(e) =>
                        dispatch({
                          type: 'milestone',
                          key: m.key,
                          name: 'title',
                          value: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field
                    id={`m${m.key}-budget`}
                    label={`Milestone ${index + 1} budget (₹)`}
                    error={errors[`m${m.key}-budget`]}
                  >
                    <input
                      id={`m${m.key}-budget`}
                      inputMode="decimal"
                      value={m.budget}
                      onChange={(e) =>
                        dispatch({
                          type: 'milestone',
                          key: m.key,
                          name: 'budget',
                          value: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field
                    id={`m${m.key}-due`}
                    label={`Milestone ${index + 1} due date`}
                  >
                    <input
                      id={`m${m.key}-due`}
                      type="date"
                      value={m.dueDate}
                      onChange={(e) =>
                        dispatch({
                          type: 'milestone',
                          key: m.key,
                          name: 'dueDate',
                          value: e.target.value,
                        })
                      }
                    />
                  </Field>
                </div>
                <Field
                  id={`m${m.key}-description`}
                  label={`Milestone ${index + 1}: what will be delivered`}
                >
                  <input
                    id={`m${m.key}-description`}
                    value={m.description}
                    onChange={(e) =>
                      dispatch({
                        type: 'milestone',
                        key: m.key,
                        name: 'description',
                        value: e.target.value,
                      })
                    }
                  />
                </Field>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => dispatch({ type: 'addMilestone' })}
          >
            Add milestone
          </button>
        </Card>

        <Card>
          <h2>Technical audit</h2>
          <label className={page.inline}>
            <input
              type="checkbox"
              checked={audit.enabled}
              onChange={(e) =>
                setAudit({ ...audit, enabled: e.target.checked })
              }
              style={{ width: 'auto' }}
            />
            Have an Expert Reviewer audit each milestone before I approve it
          </label>
          {audit.enabled && (
            <>
              <p className={page.muted}>
                The project stays a draft until you agree a fee with the
                reviewer, fund it, and they accept. The fee is paid once every
                milestone has a report.
              </p>
              <div className={page.row}>
                <Field
                  id="auditExpertId"
                  label="Reviewer"
                  error={errors.auditExpertId}
                  hint={`Reviewers who cover ${draft.category}.`}
                >
                  <select
                    id="auditExpertId"
                    value={audit.expertId}
                    onChange={(e) =>
                      setAudit({ ...audit, expertId: e.target.value })
                    }
                  >
                    <option value="">Choose a reviewer</option>
                    {reviewers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                        {r.specialization ? ` — ${r.specialization}` : ''}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  id="auditFee"
                  label="Opening offer (₹)"
                  error={errors.auditFee}
                >
                  <input
                    id="auditFee"
                    inputMode="decimal"
                    value={audit.fee}
                    onChange={(e) =>
                      setAudit({ ...audit, fee: e.target.value })
                    }
                  />
                </Field>
              </div>
            </>
          )}
        </Card>
        <Notice error={create.error} />
        <button
          className={page.primary}
          type="submit"
          disabled={create.isPending}
        >
          {create.isPending ? 'Publishing…' : 'Publish project'}
        </button>
      </form>
    </>
  );
}
