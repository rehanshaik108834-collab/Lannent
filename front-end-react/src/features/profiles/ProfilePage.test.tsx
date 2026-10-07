import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { profileInput, ProfileForm } from './ProfilePage';
import { useAuth } from '../auth/auth-context';
import { AppProviders } from '../../app/providers/AppProviders';
import { clearSession, TOKEN_KEY } from '../../shared/api/session';

const profile = {
  id: 'u1',
  name: 'Original name',
  email: 'private@example.test',
  role: 'client',
  status: 'active',
  walletBalance: 100,
  company: 'Example',
  location: 'Chennai',
};
function SignedInForm() {
  const auth = useAuth();
  return auth.user ? (
    <ProfileForm profile={profile} />
  ) : (
    <p>Restoring session</p>
  );
}
const reply = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data }));
describe('Supported profile editing', () => {
  it('excludes identity/financial fields and preserves role-specific structured fields', () => {
    const form = new FormData();
    form.set('name', ' Person ');
    form.set('email', 'forged@test');
    form.set('walletBalance', '999999');
    form.set('company', 'Company');
    form.set('industry', 'Software');
    const result = profileInput(form, 'client', []);
    expect(result).toMatchObject({
      name: 'Person',
      company: 'Company',
      companyDetails: { name: 'Company', industry: 'Software' },
    });
    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('walletBalance');
    expect(profileInput(form, 'superuser', [])).not.toHaveProperty(
      'companyDetails',
    );
  });
  it('keeps inputs after a refused save and reports failure rather than success', async () => {
    clearSession();
    localStorage.setItem(TOKEN_KEY, 'token');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(reply({ valid: true, user: profile }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ message: 'Profile save refused' }), {
            status: 400,
          }),
        ),
    );
    render(
      <AppProviders>
        <SignedInForm />
      </AppProviders>,
    );
    await screen.findByLabelText('Display name');
    await userEvent.clear(screen.getByLabelText('Display name'));
    await userEvent.type(screen.getByLabelText('Display name'), 'Changed name');
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Profile save refused',
    );
    expect(screen.getByLabelText('Display name')).toHaveValue('Changed name');
    expect(screen.queryByText('Profile saved.')).not.toBeInTheDocument();
  });
});
