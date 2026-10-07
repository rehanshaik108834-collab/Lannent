import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { Validate, useFieldErrors } from '../lib/validation';
import { usePageStyle } from '../lib/hooks';
import { useLucideRefresh } from '../lib/hooks';
import css from './worker-settings.css?inline';

/* ════════════════════════════════════════════════════════
   Side nav tabs definition
════════════════════════════════════════════════════════ */
const TABS = [
  { id: 'profile', icon: 'user', label: 'Profile Information' },
  { id: 'professional', icon: 'briefcase', label: 'Professional Details' },
  { id: 'portfolio', icon: 'folder-open', label: 'Portfolio' },
];

const ErrSvg = () => (
  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
);

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
    try { localStorage.setItem('lannent_session', JSON.stringify({ ...session, name: updates.name })); } catch (e) { /* ignore */ }
  }
  return true;
}

export default function WorkerSettings() {
  usePageStyle(css);
  // The page state lives in SettingsContent so that saving (which rewrites
  // the stored session name) does not re-render the dashboard shell: the
  // original shell kept showing the old name until the next page load.
  return (
    <DashboardLayout
      role="worker"
      activePath="profile-settings.html"
      pageTitle="Account Settings"
      pageSubtitle="Manage your profile, portfolio, payouts, and notifications."
    >
      <SettingsContent />
    </DashboardLayout>
  );
}

function initialState() {
  const session = Auth.getCurrentUser();
  const user = Store.getUserById(session.userId) || {};
  return {
    profileData: {
      fullName: user.name || 'Unknown', email: user.email || '',
      phone: user.phone || '', location: user.location || '',
      bio: user.bio || '',
      avatarColor: user.avatarColor || 'linear-gradient(135deg,#6366f1,#8b5cf6)',
    },
    professionalData: {
      jobTitle: user.jobTitle || '',
      skills: user.skills || [],
      experienceLevel: user.experienceLevel || 'Mid-Level',
      hourlyRate: user.hourlyRate || 0,
      languages: user.languages || ['English'],
      availability: user.availability || 'Full-time',
    },
    portfolioProjects: user.portfolioProjects || [],
  };
}

/** Real-time phone validation: the error message, or null. */
function phoneError(value, code) {
  const v = value.trim();
  if (!v) return null;
  return Validate.validatePhoneNumber(v, code);
}

function SettingsContent() {
  const [init] = useState(initialState);
  const { profileData, professionalData } = init;
  const v = useFieldErrors();
  const refreshIcons = useLucideRefresh();

  const [activeTab, setActiveTab] = useState('profile');

  // Profile
  const [fullName, setFullName] = useState(profileData.fullName);
  const [location, setLocation] = useState(profileData.location);
  const [bio, setBio] = useState(profileData.bio);
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState(profileData.phone);
  // wsUpdatePhoneUI() ran once at load, validating whatever phone was stored.
  const [phoneErr, setPhoneErr] = useState(() => phoneError(profileData.phone, '+91'));
  const [phoneValid, setPhoneValid] = useState(() => !!profileData.phone.trim() && !phoneError(profileData.phone, '+91'));
  const [saveDisabled, setSaveDisabled] = useState(() => !!phoneError(profileData.phone, '+91'));
  const rule = Validate.getPhoneValidationRule(countryCode);

  // Professional
  const [jobTitle, setJobTitle] = useState(professionalData.jobTitle);
  const [hourlyRate, setHourlyRate] = useState(String(professionalData.hourlyRate));
  const expLevelRef = useRef(null);
  const availabilityRef = useRef(null);
  const [skills, setSkills] = useState(professionalData.skills);
  const [newSkill, setNewSkill] = useState('');

  // Portfolio
  const [portfolioProjects, setPortfolioProjects] = useState(init.portfolioProjects);
  const [modalOpen, setModalOpen] = useState(false);
  const [portTitle, setPortTitle] = useState('');
  const [portDesc, setPortDesc] = useState('');
  const [portUrl, setPortUrl] = useState('');
  const [portTitleBorder, setPortTitleBorder] = useState('');

  const validatePhoneField = (value, code) => {
    const err = phoneError(value, code);
    setPhoneErr(err);
    setPhoneValid(!!value.trim() && !err);
    setSaveDisabled(!!err);
    return !err;
  };

  /* ── Actions ─────────────────────────────────────────── */
  const wsValidateAndSaveProfile = () => {
    const name = fullName.trim();
    const email = profileData.email.trim();
    const phoneVal = phone.trim();
    const loc = location.trim();
    const bioVal = bio.trim();

    const { valid } = v.form([
      { fieldId: 'wsFullName', value: name, checks: [(x) => Validate.required(x, 'Full name'), (x) => Validate.minLength(x, 2, 'Full name')] },
      { fieldId: 'wsEmail', value: email, checks: [Validate.email] },
    ]);
    if (!valid) return;

    // Validate phone with country-specific rule
    if (phoneVal) {
      const err = Validate.validatePhoneNumber(phoneVal, countryCode);
      if (err) {
        setPhoneErr(err);
        return;
      }
    }

    // Combine country code + phone for storage
    const fullPhone = phoneVal ? (countryCode + phoneVal) : '';

    if (!persistProfile({ name, phone: fullPhone, phoneCountryCode: countryCode, location: loc, bio: bioVal })) return;
    Validate.toast('Profile saved successfully!', 'success');
  };

  const wsSaveProfessional = () => {
    const saved = persistProfile({
      jobTitle: jobTitle.trim(),
      experienceLevel: expLevelRef.current?.value || '',
      hourlyRate: parseFloat(hourlyRate || 0) || 0,
      availability: availabilityRef.current?.value || '',
      skills,
      languages: professionalData.languages,
    });
    if (!saved) return;
    Validate.toast('Professional details saved!', 'success');
  };

  const wsAddSkill = () => {
    const s = newSkill.trim();
    if (s && !skills.includes(s)) {
      setSkills([...skills, s]);
      refreshIcons();
      setNewSkill('');
    }
  };

  const wsRemoveSkill = (skill) => {
    setSkills(skills.filter((x) => x !== skill));
    refreshIcons();
  };

  const wsRemovePortfolioProject = (id) => {
    const remaining = portfolioProjects.filter((p) => p.id !== id);
    if (!persistProfile({ portfolioProjects: remaining })) return;
    setPortfolioProjects(remaining);
    refreshIcons();
  };

  const wsAddPortfolioProject = () => {
    const title = portTitle.trim();
    const desc = portDesc.trim();
    const url = portUrl.trim();

    if (!title) {
      setPortTitleBorder('#ef4444');
      return;
    }

    // Entries carry no thumbnail until there is a real one to carry.
    const next = [...portfolioProjects, {
      id: Date.now().toString(),
      title,
      description: desc || 'No description provided.',
      url: url || '#',
      thumbnail: null,
    }];

    if (!persistProfile({ portfolioProjects: next })) return; // the server did not store it

    setPortfolioProjects(next);
    refreshIcons();
    setModalOpen(false);

    // Reset form
    setPortTitle(''); setPortTitleBorder('');
    setPortDesc('');
    setPortUrl('');
  };

  /* ── Panels ──────────────────────────────────────────── */
  const tabClass = (id) => 'ws-tab' + (activeTab === id ? ' active' : '');

  const modal = createPortal(
    <div>
      <div className={'ws-modal-backdrop' + (modalOpen ? ' open' : '')} id="wsPortfolioModal" onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
        <div className="ws-modal ws-modal-md">
          <div className="ws-modal-title">Add Portfolio Project</div>
          <div className="ws-modal-sub">Showcase your work to potential clients</div>
          <div className="ws-modal-fields">
            <div><label className="ws-label">Project Title <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="text" className="ws-input" id="wsPortTitle" placeholder="E.g., E-Commerce Platform" style={portTitleBorder ? { borderColor: portTitleBorder } : undefined} value={portTitle} onChange={(e) => setPortTitle(e.target.value)} /></div>
            <div><label className="ws-label">Description</label>
              <textarea className="ws-textarea" id="wsPortDesc" rows="3" placeholder="Describe what you built and the technologies used" value={portDesc} onChange={(e) => setPortDesc(e.target.value)} /></div>
            <div><label className="ws-label">Project URL</label>
              <input type="url" className="ws-input" id="wsPortUrl" placeholder="https://example.com" value={portUrl} onChange={(e) => setPortUrl(e.target.value)} /></div>
            <div><label className="ws-label">Upload Screenshots</label>
              <div className="ws-upload-zone">
                <Icon name="upload" style={{ width: 32, height: 32 }} />
                <div className="ws-upload-main">Click to upload or drag and drop</div>
                <div className="ws-upload-sub">PNG, JPG or GIF (max. 5MB)</div>
              </div></div>
          </div>
          <div className="ws-modal-actions">
            <button className="ws-btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="ws-btn-primary" onClick={wsAddPortfolioProject}>
              <Icon name="plus" style={{ width: 15, height: 15 }} />Add Project</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );

  return (
    <>
      <div className="ws-layout">
        <div className="ws-sidenav"><div className="ws-nav-card"><nav>
          {TABS.map((t) => (
            <button key={t.id} className={'ws-nav-btn' + (activeTab === t.id ? ' active' : '')} onClick={() => setActiveTab(t.id)}>
              <Icon name={t.icon} style={{ width: 17, height: 17, flexShrink: 0 }} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav></div></div>
        <div className="ws-main"><div className="ws-content">

          {/* ── Tab: Profile ── */}
          <div id="ws-tab-profile" className={tabClass('profile')}>
            <div className="ws-section-title">Profile Information</div>
            <div className="ws-section-sub">Update your personal information and profile photo</div>

            <div className="ws-photo-row">
              <div className="ws-avatar-wrap"><div className="ws-avatar-lg" style={{ background: profileData.avatarColor }}>{profileData.fullName.substring(0, 2).toUpperCase()}</div>
                <div className="ws-avatar-cam"><Icon name="camera" style={{ width: 13, height: 13 }} /></div></div>
              <div><div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Profile Photo</div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 10 }}>JPG, PNG or GIF. Max size 2MB.</div>
                <button className="ws-btn-sm"><Icon name="upload" style={{ width: 13, height: 13 }} />Upload Photo</button>
              </div></div>
            <div className="ws-divider" />

            <div className="ws-grid-2" style={{ marginBottom: 16 }}>
              <div><label className="ws-label">Full Name</label>
                <input type="text" className="ws-input" id="wsFullName" style={v.fieldStyle('wsFullName')} value={fullName} onChange={(e) => setFullName(e.target.value)} />{v.error('wsFullName')}</div>

              <div><label className="ws-label">Email Address</label>
                <div className="ws-input-wrap"><Icon name="mail" />
                  <input type="email" className="ws-input" id="wsEmail" style={v.fieldStyle('wsEmail')} defaultValue={profileData.email} readOnly title="Email changes are not available yet." />{v.error('wsEmail')}</div></div>

              <div style={{ gridColumn: '1/-1' }}><label className="ws-label">Phone Number</label>
                <div className="ws-phone-group">
                  <select
                    className="ws-phone-country" id="wsCountryCode" value={countryCode}
                    onChange={(e) => {
                      // wsUpdatePhoneUI: new maxlength/placeholder/hint, then re-validate
                      setCountryCode(e.target.value);
                      refreshIcons();
                      validatePhoneField(phone, e.target.value);
                    }}
                  >
                    {Validate.getPhoneCountries().map((c) => (
                      <option key={c.code} value={c.code}>{`${c.flag} ${c.name} (${c.code})`}</option>
                    ))}
                  </select>
                  <div className="ws-phone-number-wrap"><Icon name="phone" />
                    <input
                      type="tel" id="wsPhone" value={phone}
                      className={'ws-input' + (phoneErr ? ' ws-input-error' : phoneValid ? ' ws-input-valid' : '')}
                      maxLength={rule.length} placeholder={rule.placeholder}
                      onChange={(e) => {
                        // Block non-digit characters in real time
                        const digits = e.target.value.replace(/\D/g, '');
                        setPhone(digits);
                        validatePhoneField(digits, countryCode);
                      }}
                      onPaste={(e) => {
                        // Prevent paste of non-digits
                        e.preventDefault();
                        const text = (e.clipboardData || window.clipboardData).getData('text');
                        const digits = text.replace(/\D/g, '').substring(0, parseInt(e.currentTarget.getAttribute('maxlength')) || 15);
                        setPhone(digits);
                        validatePhoneField(digits, countryCode);
                      }}
                      onKeyPress={(e) => {
                        // Block key presses that aren't digits
                        if (!/[0-9]/.test(e.key)) e.preventDefault();
                      }}
                    /></div>
                </div>
                <div className="ws-phone-hint" id="wsPhoneHint"><Icon name="info" />{` Enter ${rule.length}-digit number`}</div>
                <div id="wsPhoneError" className="ws-phone-error" style={{ display: phoneErr ? 'flex' : 'none' }}>{phoneErr ? <><ErrSvg />{phoneErr}</> : null}</div>
              </div>

              <div><label className="ws-label">Location</label>
                <div className="ws-input-wrap"><Icon name="map-pin" />
                  <input type="text" className="ws-input" id="wsLocation" value={location} onChange={(e) => setLocation(e.target.value)} /></div></div>
            </div>

            <div style={{ marginBottom: 8 }}><label className="ws-label">Bio</label>
              <textarea className="ws-textarea" id="wsBio" rows="4" placeholder="Tell clients about yourself..." value={bio} onChange={(e) => setBio(e.target.value)} />
              <div className="ws-char-count" id="wsBioCount">{bio.length + '/500 characters'}</div></div>

            <div className="ws-save-row"><button className="ws-btn-primary" id="wsSaveBtn" onClick={wsValidateAndSaveProfile} disabled={saveDisabled}>
              <Icon name="save" style={{ width: 15, height: 15 }} />Save Changes</button></div>
          </div>

          {/* ── Tab: Professional ── */}
          <div id="ws-tab-professional" className={tabClass('professional')}>
            <div className="ws-section-title">Professional Details</div>
            <div className="ws-section-sub">Manage your professional profile and expertise</div>

            <div className="ws-grid-2" style={{ marginBottom: 16 }}>
              <div><label className="ws-label">Job Title</label>
                <input type="text" className="ws-input" id="wsJobTitle" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} /></div>

              <div><label className="ws-label">Experience Level</label>
                <select className="ws-select" id="wsExpLevel" ref={expLevelRef} defaultValue={professionalData.experienceLevel}>
                  {['Junior', 'Mid-Level', 'Senior', 'Expert'].map((o) => <option key={o}>{o}</option>)}
                </select></div>

              <div><label className="ws-label">Hourly Rate ($)</label>
                <div className="ws-input-wrap"><Icon name="dollar-sign" />
                  <input type="number" className="ws-input" id="wsHourlyRate" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} /></div></div>

              <div><label className="ws-label">Availability</label>
                <select className="ws-select" id="wsAvailability" ref={availabilityRef} defaultValue={professionalData.availability}>
                  {['Full-time', 'Part-time', 'Contract', 'Not Available'].map((o) => <option key={o}>{o}</option>)}
                </select></div>
            </div>

            <div style={{ marginBottom: 16 }}><label className="ws-label">Skills</label>
              <div className="ws-chips" id="wsSkillsWrap">
                {skills.map((skill) => (
                  <div key={skill} className="ws-chip-blue">
                    <span>{skill}</span>
                    <button onClick={() => wsRemoveSkill(skill)} title="Remove">
                      <Icon name="x" style={{ width: 11, height: 11 }} /></button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="text" className="ws-input" id="wsNewSkill" style={{ width: 180, height: 36 }} placeholder="Add skill..." value={newSkill} onChange={(e) => setNewSkill(e.target.value)} />
                <button className="ws-btn-sm" onClick={wsAddSkill}><Icon name="plus" style={{ width: 13, height: 13 }} />Add</button></div></div>

            <div style={{ marginBottom: 8 }}><label className="ws-label">Languages</label>
              <div className="ws-chips">
                {professionalData.languages.map((l, i) => <div key={i} className="ws-chip-purple">{l}</div>)}
              </div></div>

            <div className="ws-save-row"><button className="ws-btn-primary" onClick={wsSaveProfessional}>
              <Icon name="save" style={{ width: 15, height: 15 }} />Save Changes</button></div>
          </div>

          {/* ── Tab: Portfolio ── */}
          <div id="ws-tab-portfolio" className={tabClass('portfolio')}>
            <div className="ws-section-header">
              <div><div className="ws-section-title" style={{ marginBottom: 4 }}>Portfolio</div>
                <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Showcase your best work to potential clients</div></div>
              <button className="ws-btn-primary" onClick={() => setModalOpen(true)}>
                <Icon name="plus" style={{ width: 15, height: 15 }} />Add Project</button>
            </div>
            <div id="wsPortfolioGrid">
              {portfolioProjects.length === 0 ? (
                <div className="ws-empty-state">
                  <Icon name="folder-open" style={{ width: 48, height: 48, display: 'block', margin: '0 auto' }} />
                  <div className="ws-empty-text">No portfolio projects yet.<br />Add your first project to showcase your work.</div>
                  <button className="ws-btn-primary" onClick={() => setModalOpen(true)}>
                    <Icon name="plus" style={{ width: 15, height: 15 }} />Add Your First Project</button>
                </div>
              ) : (
                <div className="ws-portfolio-grid">
                  {portfolioProjects.map((p) => (
                    <div key={p.id} className="ws-portfolio-card">
                      {p.thumbnail
                        ? <div className="ws-portfolio-thumb"><img src={p.thumbnail} alt={p.title} loading="lazy" /></div>
                        : <div className="ws-portfolio-thumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--secondary)', color: 'var(--muted-foreground)', fontSize: 12 }}>No image</div>}
                      <div className="ws-portfolio-body">
                        <div className="ws-portfolio-title-row">
                          <div className="ws-portfolio-title">{p.title}</div>
                          <button className="ws-btn-trash" onClick={() => wsRemovePortfolioProject(p.id)} title="Remove project">
                            <Icon name="trash-2" style={{ width: 14, height: 14 }} /></button></div>
                        <div className="ws-portfolio-desc">{p.description}</div>
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="ws-ext-link">
                          <Icon name="external-link" style={{ width: 12, height: 12 }} />View Project</a>
                      </div></div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div></div>
      </div>
      {modal}
    </>
  );
}
