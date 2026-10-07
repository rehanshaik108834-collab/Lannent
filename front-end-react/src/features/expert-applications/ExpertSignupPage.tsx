import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import type { FileReference } from '../../shared/types/domain';
import { Card, Field, Notice } from '../../shared/ui/ui';
import page from '../../shared/ui/page.module.css';
import { PublicHeader } from '../public/PublicPages';
import { submitApplication, uploadApplicationDocument } from './api';

const STRONG = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,128}$/;

type Draft = Record<
  | 'name'
  | 'email'
  | 'password'
  | 'confirm'
  | 'phone'
  | 'country'
  | 'expertise'
  | 'experience'
  | 'linkedin'
  | 'github'
  | 'motivation',
  string
>;

const empty: Draft = {
  name: '',
  email: '',
  password: '',
  confirm: '',
  phone: '',
  country: '',
  expertise: '',
  experience: '',
  linkedin: '',
  github: '',
  motivation: '',
};

/**
 * Public Expert Reviewer application. The applicant chooses the password they
 * will sign in with once intake approves; there is no default password.
 */
export function ExpertSignupPage() {
  const [draft, setDraft] = useState<Draft>(empty);
  const [errors, setErrors] = useState<
    Partial<Record<keyof Draft | 'form', string>>
  >({});
  const [resume, setResume] = useState<FileReference | null>(null);
  const [certificate, setCertificate] = useState<FileReference | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<unknown>(null);
  const submit = useMutation({ mutationFn: submitApplication });

  const field = (name: keyof Draft) => ({
    id: name,
    value: draft[name],
    onChange: (e: { target: { value: string } }) =>
      setDraft({ ...draft, [name]: e.target.value }),
    'aria-invalid': !!errors[name],
  });

  async function attach(
    event: ChangeEvent<HTMLInputElement>,
    set: (ref: FileReference) => void,
  ) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      set(await uploadApplicationDocument(file));
    } catch (error) {
      setUploadError(error);
      event.target.value = '';
    } finally {
      setUploading(false);
    }
  }

  function send(event: FormEvent) {
    event.preventDefault();
    const found: typeof errors = {};
    if (draft.name.trim().length < 2) found.name = 'Enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim()))
      found.email = 'Enter a valid email address.';
    if (!STRONG.test(draft.password)) {
      found.password =
        'Use 8+ characters with an uppercase and lowercase letter, a number and one of !@#$%^&*.';
    }
    if (draft.confirm !== draft.password)
      found.confirm = 'Passwords do not match.';
    if (draft.motivation.trim().length < 30)
      found.motivation =
        'Tell us why you want to review in at least 30 characters.';
    setErrors(found);
    if (Object.keys(found).length) return;
    const { confirm: _confirm, ...fields } = draft;
    submit.mutate({
      ...Object.fromEntries(
        Object.entries(fields).map(([k, v]) => [k, v.trim() || undefined]),
      ),
      name: draft.name.trim(),
      email: draft.email.trim(),
      password: draft.password,
      resumeFile: resume ?? undefined,
      certificateFile: certificate ?? undefined,
    } as Parameters<typeof submitApplication>[0]);
  }

  return (
    <>
      <PublicHeader />
      <main id="main" className="status" style={{ maxWidth: 760 }}>
        <h1>Apply as an Expert Reviewer</h1>
        {submit.isSuccess ? (
          <Card>
            <p role="status">
              Application received. Our intake team reviews every application;
              once approved you can sign in with the email and password you
              chose.
            </p>
            <Link to="/expert-login">Expert sign in</Link>
          </Card>
        ) : (
          <form className={page.form} onSubmit={send} noValidate>
            <Card>
              <h2>Account</h2>
              <Field id="name" label="Full name" error={errors.name}>
                <input {...field('name')} autoComplete="name" />
              </Field>
              <Field id="email" label="Email" error={errors.email}>
                <input {...field('email')} type="email" autoComplete="email" />
              </Field>
              <div className={page.row}>
                <Field
                  id="password"
                  label="Password"
                  error={errors.password}
                  hint="You will sign in with this once approved."
                >
                  <input
                    {...field('password')}
                    type="password"
                    autoComplete="new-password"
                  />
                </Field>
                <Field
                  id="confirm"
                  label="Confirm password"
                  error={errors.confirm}
                >
                  <input
                    {...field('confirm')}
                    type="password"
                    autoComplete="new-password"
                  />
                </Field>
              </div>
            </Card>
            <Card>
              <h2>Experience</h2>
              <div className={page.row}>
                <Field id="expertise" label="Area of expertise">
                  <input {...field('expertise')} />
                </Field>
                <Field id="experience" label="Years of experience">
                  <select {...field('experience')}>
                    <option value="">Choose</option>
                    <option>1-3</option>
                    <option>3-5</option>
                    <option>5-10</option>
                    <option>10+</option>
                  </select>
                </Field>
              </div>
              <div className={page.row}>
                <Field id="phone" label="Phone (optional)">
                  <input {...field('phone')} type="tel" autoComplete="tel" />
                </Field>
                <Field id="country" label="Country (optional)">
                  <input {...field('country')} autoComplete="country-name" />
                </Field>
              </div>
              <div className={page.row}>
                <Field id="linkedin" label="LinkedIn (optional)">
                  <input {...field('linkedin')} type="url" />
                </Field>
                <Field id="github" label="GitHub (optional)">
                  <input {...field('github')} type="url" />
                </Field>
              </div>
              <Field
                id="motivation"
                label="Why do you want to review?"
                error={errors.motivation}
              >
                <textarea {...field('motivation')} className={page.textarea} />
              </Field>
            </Card>
            <Card>
              <h2>Documents (optional)</h2>
              <p className={page.muted}>Only the intake team can open these.</p>
              <Field id="resume" label="Résumé">
                <input
                  id="resume"
                  type="file"
                  onChange={(e) => void attach(e, setResume)}
                  disabled={uploading}
                />
              </Field>
              {resume && <p role="status">Attached {resume.name}</p>}
              <Field id="certificate" label="Certificate">
                <input
                  id="certificate"
                  type="file"
                  onChange={(e) => void attach(e, setCertificate)}
                  disabled={uploading}
                />
              </Field>
              {certificate && <p role="status">Attached {certificate.name}</p>}
              <Notice error={uploadError} />
            </Card>
            <Notice error={submit.error} />
            <button
              className={page.primary}
              type="submit"
              disabled={submit.isPending || uploading}
            >
              {submit.isPending ? 'Submitting…' : 'Submit application'}
            </button>
          </form>
        )}
      </main>
    </>
  );
}
