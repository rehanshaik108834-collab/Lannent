import { useRef, useState } from 'react';
import DashboardLayout, { EmptyState } from '../components/DashboardLayout';
import Icon from '../components/Icon';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { usePageStyle } from '../lib/hooks';
import { Validate, useFieldErrors } from '../lib/validation';
import css from './profile-settings.css?inline';

const INDUSTRIES = ['Technology', 'Finance', 'Healthcare', 'Education', 'E-commerce', 'Other'];
const SIZES = ['1–10 employees', '11–50 employees', '50–200 employees', '200–500 employees', '500+ employees'];
// An <option selected> only when the stored value matches; otherwise the first option shows.
const pick = (options, value) => (options.includes(value) ? value : options[0]);

const ERROR_SVG = (
  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
);

/** validatePhoneField(): the phone input's class, the error text and whether Save is disabled. */
function phoneState(value, code) {
  const v = value.trim();
  // Empty is OK (optional)
  if (!v) return { cls: '', err: '', disabled: false };
  const err = Validate.validatePhoneNumber(v, code);
  if (err) return { cls: 'input-error', err, disabled: true };
  return { cls: 'input-valid', err: '', disabled: false };
}

/**
 * Saves profile fields and reports the server's answer. Returns true only
 * when the server stored them; otherwise shows why and returns false.
 */
function persistProfile(updates) {
  const session = Auth.getCurrentUser();
  if (!session) { Validate.toast('Your session has ended. Sign in again.', 'error'); return false; }
  const result = Store.saveProfile(session.userId, updates);
  if (!result.ok) { Validate.toast(result.message || 'Could not save. Please try again.', 'error'); return false; }
  if (updates.name) {
    try { localStorage.setItem('lannent_session', JSON.stringify({ ...session, name: updates.name })); } catch (e) { /* storage unavailable */ }
  }
  return true;
}

function SettingsContent({ profile, company }) {
  const v = useFieldErrors();
  const [tab, setTab] = useState('profile');
  const [initials, setInitials] = useState(() => (profile.name.substring(0, 2) || 'AM').toUpperCase());
  const [bioLength, setBioLength] = useState(profile.bio.length);
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState(profile.phone);
  // Initial UI setup ran validatePhoneField() once on load.
  const [phoneUi, setPhoneUi] = useState(() => phoneState(profile.phone, '+91'));

  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const locationRef = useRef(null);
  const bioRef = useRef(null);
  const cNameRef = useRef(null);
  const cIndustryRef = useRef(null);
  const cWebsiteRef = useRef(null);
  const cSizeRef = useRef(null);
  const cLocationRef = useRef(null);

  const rule = Validate.getPhoneValidationRule(countryCode);

  const onPhoneInput = (raw) => {
    const digits = raw.replace(/\D/g, '');
    setPhone(digits);
    setPhoneUi(phoneState(digits, countryCode));
  };

  const saveProfileChanges = () => {
    const name = nameRef.current?.value.trim() || '';
    const email = emailRef.current?.value.trim() || '';
    const phoneVal = phone.trim() || '';
    const location = locationRef.current?.value.trim() || '';
    const bio = bioRef.current?.value.trim() || '';

    const { valid } = v.form([
      { fieldId: 'p-fullname', value: name, checks: [(x) => Validate.required(x, 'Full name'), (x) => Validate.minLength(x, 2, 'Full name')] },
      { fieldId: 'p-email', value: email, checks: [Validate.email] },
    ]);
    if (!valid) return;

    // Validate phone with country-specific rule
    if (phoneVal) {
      const phoneErr = Validate.validatePhoneNumber(phoneVal, countryCode);
      if (phoneErr) {
        setPhoneUi((s) => ({ ...s, cls: s.cls.includes('input-error') ? s.cls : (s.cls + ' input-error').trim(), err: phoneErr }));
        return;
      }
    }

    // Combine country code + phone for storage
    const fullPhone = phoneVal ? (countryCode + phoneVal) : '';

    if (!persistProfile({ name, phone: fullPhone, phoneCountryCode: countryCode, location, bio })) return;
    Validate.toast('Profile saved successfully!', 'success');

    setInitials((name.substring(0, 2) || 'AM').toUpperCase());
  };

  const saveCompanyChanges = () => {
    const name = cNameRef.current?.value.trim() || '';
    const industry = cIndustryRef.current?.value || '';
    const website = cWebsiteRef.current?.value.trim() || '';
    const size = cSizeRef.current?.value || '';
    const location = cLocationRef.current?.value.trim() || '';

    if (!persistProfile({ companyDetails: { name, industry, website, size, location } })) return;
    Validate.toast('Company details saved successfully!', 'success');
  };

  return (
    <>
      <div className="settings-wrap">

        {/* ══ Left Tab Nav ══ */}
        <nav className="settings-sidenav" id="settingsSidenav">
          <button className={'snav-btn' + (tab === 'profile' ? ' active' : '')} data-tab="profile" onClick={() => setTab('profile')}>
            <Icon name="user" /> Profile Information
          </button>
          <button className={'snav-btn' + (tab === 'company' ? ' active' : '')} data-tab="company" onClick={() => setTab('company')}>
            <Icon name="building-2" /> Company Details
          </button>
        </nav>

        {/* ══ Right Content ══ */}
        <div className="settings-panel">

          {/* ── Profile Tab ── */}
          <div className={'tab-content' + (tab === 'profile' ? ' active' : '')} id="tab-profile">
            <div className="settings-title">Profile Information</div>
            <div className="settings-sub">Update your personal information and profile photo</div>

            {/* Avatar */}
            <div className="avatar-row">
              <div className="avatar-wrap">
                <div className="avatar-circle" style={{ background: profile.avatarColor }}>{initials}</div>
                <button className="avatar-cam-btn"><Icon name="camera" /></button>
              </div>
              <div className="avatar-meta">
                <p>Profile Photo</p>
                <small>JPG, PNG or GIF. Max size 2MB.</small>
                <button className="btn-outline-sm" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, fontSize: 13 }}>
                  <Icon name="upload" style={{ width: 14, height: 14 }} /> Upload Photo
                </button>
              </div>
            </div>
            <hr className="section-divider" />

            {/* Fields */}
            <div className="form-grid-2">
              <div className="field-group">
                <label>Full Name</label>
                <input type="text" className="field-input" defaultValue={profile.name} id="p-fullname" ref={nameRef} style={v.fieldStyle('p-fullname')} onInput={() => v.clearError('p-fullname')} />
                {v.error('p-fullname')}
              </div>
              <div className="field-group">
                <label>Email Address</label>
                <div className="field-wrap">
                  <Icon name="mail" className="field-icon" />
                  <input type="email" className="field-input with-icon" defaultValue={profile.email} id="p-email" ref={emailRef} readOnly title="Email changes are not available yet." style={v.fieldStyle('p-email')} onInput={() => v.clearError('p-email')} />
                  {v.error('p-email')}
                </div>
              </div>
              <div className="field-group" style={{ gridColumn: '1 / -1' }}>
                <label>Phone Number</label>
                <div className="phone-input-group">
                  <select
                    className="phone-country-select"
                    id="p-country-code"
                    value={countryCode}
                    onChange={(e) => {
                      // updatePhoneUI(): new maxlength, placeholder and hint, then re-validate
                      setCountryCode(e.target.value);
                      setPhoneUi(phoneState(phone, e.target.value));
                    }}
                  >
                    {Validate.getPhoneCountries().map((c) => (
                      <option key={c.code} value={c.code}>{c.flag + ' ' + c.name + ' (' + c.code + ')'}</option>
                    ))}
                  </select>
                  <div className="phone-number-wrap">
                    <Icon name="phone" className="field-icon" />
                    <input
                      type="tel"
                      className={'field-input with-icon' + (phoneUi.cls ? ' ' + phoneUi.cls : '')}
                      value={phone}
                      id="p-phone"
                      maxLength={rule.length}
                      placeholder={rule.placeholder}
                      onChange={(e) => onPhoneInput(e.target.value)}
                      // Prevent paste of non-digits
                      onPaste={(e) => {
                        e.preventDefault();
                        const text = (e.clipboardData || window.clipboardData).getData('text');
                        onPhoneInput(text.replace(/\D/g, '').substring(0, parseInt(e.currentTarget.getAttribute('maxlength')) || 15));
                      }}
                      // Block key presses that aren't digits or control keys
                      onKeyPress={(e) => { if (!/[0-9]/.test(e.key)) e.preventDefault(); }}
                    />
                  </div>
                </div>
                <div className="phone-hint" id="p-phone-hint">
                  <Icon name="info" />{` Enter ${rule.length}-digit number`}
                </div>
                <div id="p-phone-error" className="phone-error-msg" style={{ display: phoneUi.err ? 'flex' : 'none' }}>
                  {phoneUi.err ? <>{ERROR_SVG}{phoneUi.err}</> : null}
                </div>
              </div>
              <div className="field-group">
                <label>Location</label>
                <div className="field-wrap">
                  <Icon name="map-pin" className="field-icon" />
                  <input type="text" className="field-input with-icon" defaultValue={profile.location} id="p-location" ref={locationRef} />
                </div>
              </div>
            </div>
            <div className="field-group" style={{ marginBottom: 4 }}>
              <label>Bio</label>
              <textarea className="field-input" rows="4" id="p-bio" ref={bioRef} defaultValue={profile.bio} onInput={(e) => setBioLength(e.currentTarget.value.length)} />
            </div>
            <div className="char-count" id="bioCharCount">{`${bioLength}/500 characters`}</div>

            <div className="save-row">
              <button className="btn-save" id="p-save-btn" onClick={saveProfileChanges} disabled={phoneUi.disabled}>
                <Icon name="save" /> Save Changes
              </button>
            </div>
          </div>

          {/* ── Company Tab ── */}
          <div className={'tab-content' + (tab === 'company' ? ' active' : '')} id="tab-company">
            <div className="settings-title">Company Details</div>
            <div className="settings-sub">Update your company information and branding</div>

            <div className="avatar-row">
              <div className="avatar-wrap">
                <div className="avatar-square">
                  <Icon name="building-2" style={{ width: 32, height: 32 }} />
                </div>
                <button className="avatar-cam-btn"><Icon name="camera" /></button>
              </div>
              <div className="avatar-meta">
                <p>Company Logo</p>
                <small>Recommended size: 400×400px. Max size 2MB.</small>
                <button className="btn-outline-sm" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, fontSize: 13 }}>
                  <Icon name="upload" style={{ width: 14, height: 14 }} /> Upload Logo
                </button>
              </div>
            </div>
            <hr className="section-divider" />

            <div className="form-grid-2">
              <div className="field-group">
                <label>Company Name</label>
                <input type="text" className="field-input" defaultValue={company.name} id="c-name" ref={cNameRef} />
              </div>
              <div className="field-group">
                <label>Industry</label>
                <select className="field-input" id="c-industry" ref={cIndustryRef} defaultValue={pick(INDUSTRIES, company.industry)}>
                  {INDUSTRIES.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="field-group">
                <label>Company Website</label>
                <div className="field-wrap">
                  <Icon name="globe" className="field-icon" />
                  <input type="url" className="field-input with-icon" defaultValue={company.website} id="c-website" ref={cWebsiteRef} />
                </div>
              </div>
              <div className="field-group">
                <label>Company Size</label>
                <select className="field-input" id="c-size" ref={cSizeRef} defaultValue={pick(SIZES, company.size)}>
                  {SIZES.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="field-group" style={{ gridColumn: '1/-1' }}>
                <label>Location</label>
                <div className="field-wrap">
                  <Icon name="map-pin" className="field-icon" />
                  <input type="text" className="field-input with-icon" defaultValue={company.location} id="c-location" ref={cLocationRef} />
                </div>
              </div>
            </div>

            <div className="save-row">
              <button className="btn-save" onClick={saveCompanyChanges}>
                <Icon name="save" /> Save Changes
              </button>
            </div>
          </div>

        </div>{/* /settings-panel */}
      </div>{/* /settings-wrap */}

      {/* ══ Toast ══ */}
      <div className="toast" id="toast">✓ Settings saved successfully</div>
    </>
  );
}

export default function ProfileSettings() {
  usePageStyle(css);
  // This component holds no state, so saving a new name does not re-render the
  // dashboard shell: the original kept showing the old name until a reload.
  const session = Auth.getCurrentUser();
  const role = session?.role || 'client';
  const user = session ? Store.getUserById(session.userId) : null;
  if (!user) {
    // Bailing here used to leave a genuinely blank page.
    return (
      <EmptyState
        role="client"
        activePath="profile-settings.html"
        pageTitle="Settings"
        message="Your profile could not be loaded. Check that the API is running, then reload."
        linkHref="client-dashboard.html"
        linkLabel="Back to Dashboard"
      />
    );
  }

  const profile = {
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    location: user.location || '',
    bio: user.bio || '',
    avatarColor: user.avatarColor || 'linear-gradient(135deg, #6366f1, #4f46e5)',
  };

  const company = user.companyDetails || {
    name: '', industry: 'Technology', website: '', size: '50-200 employees', location: '',
  };

  return (
    <DashboardLayout role={role} activePath="profile-settings.html" pageTitle="Account Settings" pageSubtitle="Manage your account details and company information.">
      <SettingsContent profile={profile} company={company} />
    </DashboardLayout>
  );
}
