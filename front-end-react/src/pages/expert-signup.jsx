import { useEffect, useRef } from 'react';
import Icon from '../components/Icon';
import A from '../components/A';
import { Store } from '../lib/store';
import { usePageStyle, useRerender } from '../lib/hooks';
import { Validate } from '../lib/validation';
import css from './expert-signup.css?inline';

const VIDEO_SRC = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260302_085640_276ea93b-d7da-4418-a09b-2aa5b490e838.mp4';

const COUNTRY_OPTIONS = [
  ['', 'Select your country'],
  ['in', 'India'],
  ['us', 'United States'],
  ['uk', 'United Kingdom'],
  ['ca', 'Canada'],
  ['au', 'Australia'],
  ['de', 'Germany'],
  ['fr', 'France'],
  ['sg', 'Singapore'],
  ['other', 'Other'],
];
const EXPERTISE_OPTIONS = [
  ['', 'Select your primary expertise'],
  ['frontend', 'Frontend Development'],
  ['backend', 'Backend Development'],
  ['fullstack', 'Full-Stack Development'],
  ['mobile', 'Mobile Development'],
  ['devops', 'DevOps & Infrastructure'],
  ['security', 'Security & Auditing'],
  ['data', 'Data Engineering'],
  ['ml', 'Machine Learning'],
];
const YEARS_OPTIONS = [
  ['', 'Select years of experience'],
  ['1-3', '1–3 years'],
  ['3-5', '3–5 years'],
  ['5-8', '5–8 years'],
  ['8-12', '8–12 years'],
  ['12+', '12+ years'],
];

const PW_REQS = [
  { id: 'expReqLen', text: 'At least 8 characters', test: (val) => val.length >= 8 },
  { id: 'expReqUpper', text: 'One uppercase letter', test: (val) => /[A-Z]/.test(val) },
  { id: 'expReqLower', text: 'One lowercase letter', test: (val) => /[a-z]/.test(val) },
  { id: 'expReqNum', text: 'One number', test: (val) => /\d/.test(val) },
  { id: 'expReqSpecial', text: 'One special character (!@#$%^&*)', test: (val) => /[!@#$%^&*]/.test(val) },
];

const UPLOAD_DEFAULTS = {
  expResume: { main: 'Click or drag & drop your resume', sub: 'PDF only · Max 2MB' },
  expCert: { main: 'Click or drag & drop certifications', sub: 'PDF, JPG, PNG · Max 5MB' },
};

// Text fields — validate on input (debounced) and blur
const TEXT_FIELDS = ['expName', 'expEmail', 'expPassword', 'expConfirmPw', 'expPhone', 'expLinkedin', 'expGithub', 'expMotivation'];

const errIcon = (
  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
);

const toggleBtnStyle = { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)' };
const optionalStyle = { color: 'var(--muted-foreground)', fontWeight: 400, fontSize: 12 };

export default function ExpertSignup() {
  usePageStyle(css);
  const rerender = useRerender();

  // The original read every value straight from the DOM and mutated classes
  // imperatively, step by step. This ref holds that state; handlers mutate it
  // in the original order and then re-render once.
  const s = useRef(null);
  if (!s.current) {
    s.current = {
      values: {
        expName: '', expEmail: '', expPassword: '', expConfirmPw: '', expPhoneCountry: '+91', expPhone: '',
        expCountry: '', expExpertise: '', expYears: '', expLinkedin: '', expGithub: '', expMotivation: '',
      },
      cls: {}, // fieldId → '' | 'input-error' | 'input-valid'
      err: {}, // fieldId → message shown in <div id="<id>_error">
      zone: { expResume: {}, expCert: {} }, // { dragOver, hasFile, hasError }
      file: { expResume: null, expCert: null }, // { name, sizeMB } shown in the zone
      showPw: false,
      showConfirm: false,
      motivTouched: false,
      iconGen: 0, // bumped wherever the original called lucide.createIcons()
      submitDisabled: true,
      loading: false,
      success: false,
      timers: {},
    };
  }
  const st = s.current;
  const val = st.values;
  const resumeRef = useRef(null);
  const certRef = useRef(null);
  const fileRefs = { expResume: resumeRef, expCert: certRef };

  useEffect(() => () => { Object.values(st.timers).forEach(clearTimeout); }, [st]);

  // lucide.createIcons() replaced EVERY icon element on the page with a fresh
  // <svg>. Remounting the icons (new keys) reproduces that, including the repaint.
  function createIcons() {
    st.iconGen += 1;
  }

  /* ── ERROR HELPERS (per-field, below-field messages) ── */
  function showFieldError(fieldId, msg) {
    st.cls[fieldId] = 'input-error';
    st.err[fieldId] = msg;
  }
  function clearFieldError(fieldId) {
    if (st.cls[fieldId] === 'input-error') st.cls[fieldId] = '';
    delete st.err[fieldId];
  }
  function markFieldValid(fieldId) {
    st.cls[fieldId] = 'input-valid';
    clearFieldError(fieldId);
  }

  /* ── INDIVIDUAL VALIDATORS: each returns null (valid) or error string ── */

  /** 1. Full Name: required, min 3, letters/spaces/dots */
  function validateName() {
    const v = val.expName.trim();
    if (!v) return 'Full name is required.';
    if (v.length < 2) return 'Full name must be at least 2 characters.';
    // Any script's letters, plus hyphens and apostrophes — see Validate.fullName.
    if (!/^[\p{L}\p{M}][\p{L}\p{M}\s'’.\-]*$/u.test(v)) return 'Name can contain letters, spaces, hyphens and apostrophes.';
    return null;
  }

  /** 2. Email */
  function validateEmail() {
    const v = val.expEmail.trim();
    if (!v) return 'Email address is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Please enter a valid email address.';
    return null;
  }

  /** 3. Phone (country-aware, required) */
  function validatePhone() {
    const code = val.expPhoneCountry;
    const v = val.expPhone.trim();
    if (!v) return 'Phone number is required.';
    const digits = v.replace(/\D/g, '');
    const rule = Validate.getPhoneValidationRule(code);
    if (digits.length !== rule.length) return `Phone must be exactly ${rule.length} digits for ${rule.name} (${code}).`;
    if (!rule.pattern.test(digits)) return `Invalid phone number for ${rule.name} (${code}).`;
    return null;
  }

  /** 4. Country dropdown */
  function validateCountry() {
    if (!val.expCountry) return 'Please select your country.';
    return null;
  }

  /** 5. Primary Expertise dropdown */
  function validateExpertise() {
    if (!val.expExpertise) return 'Please select your primary expertise.';
    return null;
  }

  /** 6. Years of Experience dropdown */
  function validateYears() {
    if (!val.expYears) return 'Please select your years of experience.';
    return null;
  }

  /** 7. LinkedIn (optional, must be valid URL containing linkedin.com) */
  function validateLinkedin() {
    const v = val.expLinkedin.trim();
    if (!v) return null; // optional
    try { new URL(v); } catch { return 'Please enter a valid URL.'; }
    if (!v.toLowerCase().includes('linkedin.com')) return 'URL must contain "linkedin.com".';
    return null;
  }

  /** 8. GitHub / Portfolio (optional, must be valid URL) */
  function validateGithub() {
    const v = val.expGithub.trim();
    if (!v) return null; // optional
    try { new URL(v); } catch { return 'Please enter a valid URL.'; }
    return null;
  }

  /** 9. Resume: required, PDF only, max 2MB */
  function validateResume() {
    const files = resumeRef.current?.files;
    if (!files || files.length === 0) return 'Please upload your resume (PDF).';
    const file = files[0];
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))
      return 'Resume must be a PDF file.';
    if (file.size > 2 * 1024 * 1024) return 'Resume must be under 2MB.';
    return null;
  }

  /** 10. Certifications: optional, PDF/JPG/PNG, max 5MB */
  function validateCert() {
    const files = certRef.current?.files;
    if (!files || files.length === 0) return null; // optional
    const file = files[0];
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    const ext = file.name.toLowerCase().split('.').pop();
    if (!allowed.includes(file.type) && !['pdf', 'jpg', 'jpeg', 'png'].includes(ext))
      return 'Only PDF, JPG, or PNG files allowed.';
    if (file.size > 5 * 1024 * 1024) return 'Certifications must be under 5MB.';
    return null;
  }

  /** 11. Motivation: required, 30–500 chars */
  function validateMotivation() {
    const v = val.expMotivation.trim();
    if (!v) return 'This field is required.';
    if (v.length < 30) return `Please write at least 30 characters (currently ${v.length}).`;
    if (v.length > 500) return 'Maximum 500 characters allowed.';
    return null;
  }

  /** 12. Password: required, 8+ chars, upper+lower+digit+special */
  function validatePassword() {
    const v = val.expPassword;
    if (!v) return 'Password is required.';
    if (v.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(v)) return 'Password must contain at least one uppercase letter.';
    if (!/[a-z]/.test(v)) return 'Password must contain at least one lowercase letter.';
    if (!/\d/.test(v)) return 'Password must contain at least one number.';
    if (!/[!@#$%^&*]/.test(v)) return 'Password must contain at least one special character (!@#$%^&*).';
    return null;
  }

  /** 13. Confirm Password: must match */
  function validateConfirmPw() {
    const pw = val.expPassword;
    const v = val.expConfirmPw;
    if (!v) return 'Please confirm your password.';
    if (v !== pw) return 'Passwords do not match.';
    return null;
  }

  /* ── FIELD → VALIDATOR MAPPING ── */
  const fieldValidators = {
    expName: validateName,
    expEmail: validateEmail,
    expPassword: validatePassword,
    expConfirmPw: validateConfirmPw,
    expPhone: validatePhone,
    expCountry: validateCountry,
    expExpertise: validateExpertise,
    expYears: validateYears,
    expLinkedin: validateLinkedin,
    expGithub: validateGithub,
    expResume: validateResume,
    expCert: validateCert,
    expMotivation: validateMotivation,
  };

  /** Run a single field's validator and update UI. Returns true if valid. */
  function runFieldValidation(fieldId) {
    const fn = fieldValidators[fieldId];
    if (!fn) return true;
    const err = fn();
    if (err) { showFieldError(fieldId, err); return false; }
    markFieldValid(fieldId);
    return true;
  }

  /** Run ALL validators silently (no UI changes) to determine submit button state. */
  function isFormValid() {
    for (const fn of Object.values(fieldValidators)) {
      if (fn() !== null) return false;
    }
    return true;
  }

  /** Enable / disable submit button based on form validity. */
  function updateSubmitState() {
    st.submitDisabled = !isFormValid();
  }

  // Initial submit state (the original ran updatePhoneUI() and updateSubmitState() on load)
  useEffect(() => {
    updateSubmitState();
    rerender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Real-time password strength indicator ── */
  function onPasswordInput() {
    const v = val.expPassword;
    if (v.length === 0) {
      st.cls.expPassword = '';
      clearFieldError('expPassword');
      updateSubmitState();
      return;
    }
    clearFieldError('expPassword');
    st.cls.expPassword = '';
    // Also re-check confirm match if confirm has value
    if (val.expConfirmPw) runFieldValidation('expConfirmPw');
    updateSubmitState();
  }

  /* ── Real-time confirm password ── */
  function onConfirmInput() {
    clearFieldError('expConfirmPw');
    st.cls.expConfirmPw = '';
    const pw = val.expPassword;
    const v = val.expConfirmPw;
    if (v.length === 0) { updateSubmitState(); return; }
    if (pw && v === pw) {
      st.cls.expConfirmPw = 'input-valid';
    } else if (v.length > 0) {
      st.cls.expConfirmPw = 'input-error';
    }
    updateSubmitState();
  }

  /* ── Text field input: field-specific handler, then the debounced validation ── */
  function onTextInput(id, value) {
    if (id === 'expPhone') value = value.replace(/\D/g, ''); // Block non-digits in real-time
    val[id] = value;
    if (id === 'expPassword') onPasswordInput();
    if (id === 'expConfirmPw') onConfirmInput();
    if (id === 'expMotivation') st.motivTouched = true;

    clearTimeout(st.timers[id]);
    clearFieldError(id);
    st.timers[id] = setTimeout(() => { runFieldValidation(id); updateSubmitState(); rerender(); }, 350);
    rerender();
  }

  function onTextBlur(id) {
    clearTimeout(st.timers[id]);
    runFieldValidation(id);
    updateSubmitState();
    rerender();
  }

  /* ── Dropdowns — validate on change ── */
  function onSelectChange(id, value) {
    val[id] = value;
    if (id === 'expPhoneCountry') {
      // updatePhoneUI: maxlength / placeholder / hint follow the country; re-validate if there's a value
      createIcons();
      if (val.expPhone.trim()) runFieldValidation('expPhone');
      updateSubmitState();
      // the generic dropdown listener
      if (val.expPhone.trim()) runFieldValidation('expPhone');
    } else {
      runFieldValidation(id);
    }
    updateSubmitState();
    rerender();
  }

  /* ── Phone: block non-digits on keypress, sanitise paste ── */
  function onPhoneKeyPress(e) {
    if (!/[0-9]/.test(e.key)) e.preventDefault();
  }
  function onPhonePaste(e) {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    // Setting .value directly fired no input event: no validation, no submit-state update.
    val.expPhone = text.replace(/\D/g, '').substring(0, parseInt(e.currentTarget.getAttribute('maxlength')) || 15);
    rerender();
  }

  /* ── DRAG & DROP FILE UPLOADS ── */
  function onFileChange(id) {
    const inputEl = fileRefs[id].current;
    const zone = st.zone[id];
    // setupUploadZone's change handler
    if (inputEl.files && inputEl.files[0]) {
      const f = inputEl.files[0];
      const sizeMB = (f.size / (1024 * 1024)).toFixed(1);
      st.file[id] = { name: f.name, sizeMB };
      zone.hasFile = true;
      zone.hasError = false;
      createIcons();
    } else {
      st.file[id] = null;
      zone.hasFile = false;
    }
    // File inputs — validate on change
    const err = fieldValidators[id]();
    if (err) {
      showFieldError(id, err);
      zone.hasError = true;
      zone.hasFile = false;
    } else {
      clearFieldError(id);
      zone.hasError = false;
    }
    updateSubmitState();
    rerender();
  }

  const dragOn = (id) => (e) => { e.preventDefault(); e.stopPropagation(); st.zone[id].dragOver = true; rerender(); };
  const dragOff = (id) => (e) => { e.preventDefault(); e.stopPropagation(); st.zone[id].dragOver = false; rerender(); };
  const onDrop = (id) => (e) => {
    dragOff(id)(e);
    const dt = e.dataTransfer;
    if (dt.files && dt.files.length > 0) {
      fileRefs[id].current.files = dt.files;
      onFileChange(id);
    }
  };

  /* ── FORM SUBMIT ── */
  function onSubmit(e) {
    e.preventDefault();

    // Run ALL validations with UI
    let firstErrorId = null;
    const requiredFields = ['expName', 'expEmail', 'expPassword', 'expConfirmPw', 'expPhone', 'expCountry', 'expExpertise', 'expYears', 'expResume', 'expMotivation'];
    const optionalFields = ['expLinkedin', 'expGithub', 'expCert'];
    const allFields = [...requiredFields, ...optionalFields];

    allFields.forEach((id) => {
      const valid = runFieldValidation(id);
      if (!valid && !firstErrorId) firstErrorId = id;

      // Update upload zone error state for file fields
      if (id === 'expResume' && !valid) st.zone.expResume.hasError = true;
      if (id === 'expCert' && !valid) st.zone.expCert.hasError = true;
    });

    if (firstErrorId) {
      rerender();
      // Scroll to first error
      const grp = document.getElementById('grp-' + firstErrorId) || document.getElementById(firstErrorId);
      if (grp) grp.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Check duplicate email in users AND applications
    if (typeof Store !== 'undefined') {
      const existingUser = Store.getUserByEmail(val.expEmail.trim());
      const existingApp = Store.getExpertApplicationStatus(val.expEmail.trim()).exists;
      if (existingUser) {
        showFieldError('expEmail', 'An account with this email already exists.');
        rerender();
        document.getElementById('grp-expEmail')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (existingApp) {
        // existingApp is the boolean `.exists`, so its .status is always undefined
        // and this always reads "already approved" (kept as the original had it).
        const statusMsg = existingApp.status === 'pending'
          ? 'An application with this email is already under review.'
          : existingApp.status === 'rejected'
            ? 'A previous application with this email was rejected. Please contact support.'
            : 'This email is already approved. Please log in instead.';
        showFieldError('expEmail', statusMsg);
        rerender();
        document.getElementById('grp-expEmail')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }

    // ── Loading state ──
    st.submitDisabled = true;
    st.loading = true;
    rerender();

    // Save application to Store
    const phoneCountry = val.expPhoneCountry || '+91';
    const selectedLabel = (options, value) => {
      const o = options.find(([v]) => v === value);
      return o ? o[1].trim() : (value || '');
    };
    const resumeFile = resumeRef.current?.files?.[0];
    const certFile = certRef.current?.files?.[0];

    const appData = {
      name: val.expName.trim(),
      email: val.expEmail.trim(),
      password: val.expPassword,
      phone: val.expPhone.trim(),
      phoneCountry: phoneCountry,
      // Send the option LABELS. The raw values are codes ("in", "frontend"),
      // and the admin queue displays these fields verbatim — a reviewer was
      // seeing "in / frontend" instead of "India / Frontend Development".
      country: selectedLabel(COUNTRY_OPTIONS, val.expCountry),
      expertise: selectedLabel(EXPERTISE_OPTIONS, val.expExpertise),
      experience: selectedLabel(YEARS_OPTIONS, val.expYears),
      linkedin: val.expLinkedin.trim(),
      github: val.expGithub.trim(),
      motivation: val.expMotivation.trim(),
      // Names are kept alongside the references so an older application, or
      // one whose upload failed, still shows the reviewer what was offered.
      resumeName: resumeFile?.name || null,
      certificateName: certFile?.name || null,
      resumeFile: null,
      certificateFile: null,
    };

    // The applicant has no account yet, so these go through the public
    // application upload; the stored files are readable by staff only.
    const uploads = [];
    if (resumeFile) {
      uploads.push(Store.uploadFile(resumeFile, { purpose: 'expert-application' })
        .then((ref) => { appData.resumeFile = ref; })
        .catch((err) => { console.warn('Resume upload failed:', err.message); }));
    }
    if (certFile) {
      uploads.push(Store.uploadFile(certFile, { purpose: 'expert-application' })
        .then((ref) => { appData.certificateFile = ref; })
        .catch((err) => { console.warn('Certificate upload failed:', err.message); }));
    }

    Promise.all(uploads).then(() => {
      if (typeof Store !== 'undefined') {
        const result = Store.saveExpertApplication(appData);
        if (!result.success) {
          showFieldError('expEmail', result.error);
          st.submitDisabled = false;
          st.loading = false;
          rerender();
          return;
        }
      }
      // The button stays disabled after a successful submission.
      st.loading = false;
      st.success = true;
      createIcons();
      rerender();
    });
  }

  /* ── Render helpers ── */
  const inputCls = (base, id) => (st.cls[id] ? `${base} ${st.cls[id]}` : base);
  const errorDiv = (id) => (
    <div id={id + '_error'} className="field-error-msg" style={{ display: st.err[id] ? 'flex' : 'none' }}>
      {st.err[id] ? <>{errIcon}{st.err[id]}</> : null}
    </div>
  );
  const textProps = (id) => ({
    id,
    value: val[id],
    onChange: (e) => onTextInput(id, e.target.value),
    onBlur: () => onTextBlur(id),
  });
  const zoneCls = (id) => {
    const z = st.zone[id];
    return ['upload-zone', z.dragOver && 'drag-over', z.hasFile && 'has-file', z.hasError && 'has-error'].filter(Boolean).join(' ');
  };
  const uploadMain = (id) => {
    const f = st.file[id];
    if (!f) return UPLOAD_DEFAULTS[id].main;
    return <span className="upload-file-name"><Icon key={st.iconGen} name="file-check" style={{ width: 14, height: 14 }} />{` ${f.name}`}</span>;
  };
  const uploadSub = (id) => (st.file[id] ? `${st.file[id].sizeMB} MB` : UPLOAD_DEFAULTS[id].sub);

  // Password strength
  const pw = val.expPassword;
  const pwShown = pw.length !== 0;
  const { label: pwLabel, level: pwLevel } = Validate.passwordStrength(pw);
  const barCls = pwLevel === 1 ? 'active-weak' : pwLevel === 2 ? 'active-medium' : 'active-strong';

  // Phone country
  const phoneRule = Validate.getPhoneValidationRule(val.expPhoneCountry);

  // Motivation counter
  const motivLen = val.expMotivation.length;
  let counterCls = 'char-counter';
  let barStyle = { width: '0%', background: 'var(--border)' };
  let motivMin = 'Min 30 characters';
  if (st.motivTouched) {
    const pct = Math.min(100, (motivLen / 500) * 100);
    if (motivLen < 30) {
      counterCls = 'char-counter danger';
      barStyle = { width: pct + '%', background: '#ef4444' };
      motivMin = `${30 - motivLen} more needed`;
    } else if (motivLen > 450) {
      counterCls = 'char-counter warning';
      barStyle = { width: pct + '%', background: '#f59e0b' };
      motivMin = `${500 - motivLen} remaining`;
    } else {
      barStyle = { width: pct + '%', background: '#10b981' };
      motivMin = '✓ Meets minimum';
    }
  }

  return (
    <>
      <div className="auth-page">
        {/* Background video (fixed) */}
        <div className="auth-video-wrap">
          <video className="auth-video" autoPlay muted loop playsInline>
            <source src={VIDEO_SRC} type="video/mp4" />
          </video>
          <div className="auth-overlay" />
        </div>

        {/* LEFT — Branding (sticky) */}
        <div className="auth-left">
          <h1 className="auth-title">Join our network of <span className="serif">expert</span> reviewers.</h1>
          <p className="auth-sub">Help maintain quality standards across the platform by conducting technical audits and resolving disputes. Earn competitive fees while building your reputation.</p>
          <div className="auth-features">
            <div className="auth-feature">
              <div className="auth-feature-icon"><Icon key={st.iconGen} name="file-check" style={{ width: 15, height: 15 }} /></div>
              <span style={{ fontSize: 14 }}>Conduct technical audits</span>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon"><Icon key={st.iconGen} name="scale" style={{ width: 15, height: 15 }} /></div>
              <span style={{ fontSize: 14 }}>Resolve project disputes</span>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon"><Icon key={st.iconGen} name="lock" style={{ width: 15, height: 15 }} /></div>
              <span style={{ fontSize: 14 }}>Earn $80–$150 per review</span>
            </div>
          </div>
        </div>

        {/* RIGHT — Application Form (scrollable) */}
        <div className="auth-right" style={{ alignItems: 'flex-start', paddingTop: 48, paddingBottom: 48, overflowY: 'auto', maxHeight: '100vh' }}>
          <div className="auth-card-signup">
            <div className="auth-card-brand">
              <Icon key={st.iconGen} name="shield-check" style={{ width: 20, height: 20 }} />
              <span className="auth-card-brand-name">Lannent</span>
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.03em', marginTop: 24, marginBottom: 4 }}>Apply as Expert Reviewer</h2>
            <p style={{ fontSize: 14, color: 'var(--muted-foreground)', marginBottom: 28 }}>Join our network of technical experts who verify project deliverables.</p>

            <form id="expertSignupForm" noValidate onSubmit={onSubmit}>

              {/* ═══ BASIC INFORMATION ═══ */}
              <div className="section-title">
                <Icon key={st.iconGen} name="user" /> Basic Information
              </div>

              {/* Full Name */}
              <div className="form-group" id="grp-expName">
                <label className="form-label" htmlFor="expName">
                  Full Name <span style={{ color: '#ef4444' }}>*</span>{' '}
                  <span className="label-tooltip">
                    <Icon key={st.iconGen} name="help-circle" />
                    <span className="tooltip-text">Letters, spaces, and prefixes like &quot;Dr.&quot; allowed</span>
                  </span>
                </label>
                <input type="text" className={inputCls('form-input', 'expName')} placeholder="Dr. Jane Smith" aria-required="true" autoComplete="name" {...textProps('expName')} />
                {errorDiv('expName')}
              </div>

              {/* Email & Phone Row */}
              <div className="form-group" id="grp-expEmail">
                <label className="form-label" htmlFor="expEmail">
                  Email Address <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div className="input-icon-wrap">
                  <span className="input-icon"><Icon key={st.iconGen} name="mail" style={{ width: 16, height: 16 }} /></span>
                  <input type="email" className={inputCls('form-input', 'expEmail')} placeholder="jane@example.com" aria-required="true" autoComplete="email" {...textProps('expEmail')} />
                </div>
                {errorDiv('expEmail')}
              </div>

              {/* Password */}
              <div className="form-group" id="grp-expPassword">
                <label className="form-label" htmlFor="expPassword">
                  Password <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div className="form-input-wrap">
                  <input type={st.showPw ? 'text' : 'password'} className={inputCls('form-input form-input-pr', 'expPassword')} placeholder="••••••••" aria-required="true" autoComplete="new-password" {...textProps('expPassword')} />
                  <button type="button" className="form-input-icon-right" id="toggleExpPw" style={toggleBtnStyle} onClick={() => { st.showPw = !st.showPw; createIcons(); rerender(); }}>
                    <Icon key={st.iconGen} name={st.showPw ? 'eye-off' : 'eye'} style={{ width: 16, height: 16 }} />
                  </button>
                </div>
                <div className="pw-strength" id="expPwStrengthWrap" style={{ display: pwShown ? '' : 'none' }}>
                  <div className="pw-strength-bars">
                    {[1, 2, 3].map((n, i) => (
                      <div key={n} className={'pw-strength-bar' + (pwShown && i < pwLevel ? ` ${barCls}` : '')} id={`expPwBar${n}`} />
                    ))}
                  </div>
                  {' '}
                  <span className={pwShown ? 'pw-strength-label ' + pwLabel.toLowerCase() : 'pw-strength-label'} id="expPwStrengthLabel">{pwShown ? pwLabel : ''}</span>
                </div>
                <div className="pw-requirements" id="expPwRequirements" style={{ display: pwShown ? '' : 'none' }}>
                  {PW_REQS.map((r) => (
                    <div key={r.id} className={pwShown && r.test(pw) ? 'pw-req met' : 'pw-req'} id={r.id}><span className="pw-req-icon">✓</span><span>{r.text}</span></div>
                  ))}
                </div>
                {errorDiv('expPassword')}
              </div>

              {/* Confirm Password */}
              <div className="form-group" id="grp-expConfirmPw">
                <label className="form-label" htmlFor="expConfirmPw">
                  Confirm Password <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div className="form-input-wrap">
                  <input type={st.showConfirm ? 'text' : 'password'} className={inputCls('form-input form-input-pr', 'expConfirmPw')} placeholder="••••••••" aria-required="true" autoComplete="new-password" {...textProps('expConfirmPw')} />
                  <button type="button" className="form-input-icon-right" id="toggleExpConfirm" style={toggleBtnStyle} onClick={() => { st.showConfirm = !st.showConfirm; createIcons(); rerender(); }}>
                    <Icon key={st.iconGen} name={st.showConfirm ? 'eye-off' : 'eye'} style={{ width: 16, height: 16 }} />
                  </button>
                </div>
                {errorDiv('expConfirmPw')}
              </div>

              {/* Phone with Country Code */}
              <div className="form-group" id="grp-expPhone">
                <label className="form-label" htmlFor="expPhone">
                  Phone Number <span style={{ color: '#ef4444' }}>*</span>{' '}
                  <span className="label-tooltip">
                    <Icon key={st.iconGen} name="help-circle" />
                    <span className="tooltip-text">Digits only, validated per country</span>
                  </span>
                </label>
                <div className="exp-phone-group">
                  <select className="exp-phone-country" id="expPhoneCountry" aria-label="Country code" value={val.expPhoneCountry} onChange={(e) => onSelectChange('expPhoneCountry', e.target.value)}>
                    {Validate.getPhoneCountries().map((c) => (
                      <option key={c.code} value={c.code}>{`${c.flag} ${c.name} (${c.code})`}</option>
                    ))}
                  </select>
                  <div className="exp-phone-input-wrap">
                    <span className="input-icon"><Icon key={st.iconGen} name="phone" style={{ width: 16, height: 16 }} /></span>
                    <input
                      type="tel" className={inputCls('form-input', 'expPhone')} aria-required="true" autoComplete="tel"
                      maxLength={phoneRule.length} placeholder={phoneRule.placeholder}
                      onKeyPress={onPhoneKeyPress} onPaste={onPhonePaste}
                      {...textProps('expPhone')}
                    />
                  </div>
                </div>
                <div className="exp-phone-hint" id="expPhoneHint"><Icon key={st.iconGen} name="info" />{` Enter ${phoneRule.length}-digit number`}</div>
                {errorDiv('expPhone')}
              </div>

              {/* Country */}
              <div className="form-group" id="grp-expCountry">
                <label className="form-label" htmlFor="expCountry">
                  Country <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select className={inputCls('form-input', 'expCountry')} id="expCountry" aria-required="true" value={val.expCountry} onChange={(e) => onSelectChange('expCountry', e.target.value)}>
                  {COUNTRY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                {errorDiv('expCountry')}
              </div>

              {/* ═══ PROFESSIONAL DETAILS ═══ */}
              <div className="section-title" style={{ marginTop: 8 }}>
                <Icon key={st.iconGen} name="briefcase" /> Professional Details
              </div>

              {/* Primary Expertise */}
              <div className="form-group" id="grp-expExpertise">
                <label className="form-label" htmlFor="expExpertise">
                  Primary Expertise <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select className={inputCls('form-input', 'expExpertise')} id="expExpertise" aria-required="true" value={val.expExpertise} onChange={(e) => onSelectChange('expExpertise', e.target.value)}>
                  {EXPERTISE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                {errorDiv('expExpertise')}
              </div>

              {/* Years of Experience */}
              <div className="form-group" id="grp-expYears">
                <label className="form-label" htmlFor="expYears">
                  Years of Experience <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select className={inputCls('form-input', 'expYears')} id="expYears" aria-required="true" value={val.expYears} onChange={(e) => onSelectChange('expYears', e.target.value)}>
                  {YEARS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                {errorDiv('expYears')}
              </div>

              {/* LinkedIn Profile */}
              <div className="form-group" id="grp-expLinkedin">
                <label className="form-label" htmlFor="expLinkedin">
                  {'LinkedIn Profile '}
                  <span style={optionalStyle}> (Optional)</span>{' '}
                  <span className="label-tooltip">
                    <Icon key={st.iconGen} name="help-circle" />
                    <span className="tooltip-text">Must contain &quot;linkedin.com&quot;</span>
                  </span>
                </label>
                <div className="input-icon-wrap">
                  <span className="input-icon"><Icon key={st.iconGen} name="linkedin" style={{ width: 16, height: 16 }} /></span>
                  <input type="url" className={inputCls('form-input', 'expLinkedin')} placeholder="https://linkedin.com/in/janesmith" autoComplete="url" {...textProps('expLinkedin')} />
                </div>
                {errorDiv('expLinkedin')}
              </div>

              {/* GitHub / Portfolio URL */}
              <div className="form-group" id="grp-expGithub">
                <label className="form-label" htmlFor="expGithub">
                  {'GitHub / Portfolio URL '}
                  <span style={optionalStyle}> (Optional)</span>
                </label>
                <div className="input-icon-wrap">
                  <span className="input-icon"><Icon key={st.iconGen} name="github" style={{ width: 16, height: 16 }} /></span>
                  <input type="url" className={inputCls('form-input', 'expGithub')} placeholder="https://github.com/janesmith" autoComplete="url" {...textProps('expGithub')} />
                </div>
                {errorDiv('expGithub')}
              </div>

              {/* ═══ VERIFICATION DOCUMENTS ═══ */}
              <div className="section-title" style={{ marginTop: 8 }}>
                <Icon key={st.iconGen} name="file-text" /> Verification Documents
              </div>

              {/* Resume Upload (PDF, max 2MB) */}
              <div className="form-group" id="grp-expResume">
                <label className="form-label">
                  Upload Resume <span style={{ color: '#ef4444' }}>*</span>{' '}
                  <span className="label-tooltip">
                    <Icon key={st.iconGen} name="help-circle" />
                    <span className="tooltip-text">PDF only, max 2MB</span>
                  </span>
                </label>
                <label
                  className={zoneCls('expResume')} id="resumeZone" htmlFor="expResume" tabIndex={0} role="button" aria-label="Upload resume PDF"
                  onDragEnter={dragOn('expResume')} onDragOver={dragOn('expResume')} onDragLeave={dragOff('expResume')} onDrop={onDrop('expResume')}
                >
                  <input type="file" accept=".pdf" id="expResume" aria-required="true" className={st.cls.expResume || undefined} ref={resumeRef} onChange={() => onFileChange('expResume')} />
                  <div className="upload-icon"><Icon key={st.iconGen} name="upload" style={{ width: 24, height: 24 }} /></div>
                  <div className="upload-main" id="resumeMainText">{uploadMain('expResume')}</div>
                  <div className="upload-sub" id="resumeSubText">{uploadSub('expResume')}</div>
                </label>
                {errorDiv('expResume')}
              </div>

              {/* Certifications Upload (Optional, PDF/JPG/PNG, max 5MB) */}
              <div className="form-group" id="grp-expCert">
                <label className="form-label">
                  {'Upload Certifications '}
                  <span style={optionalStyle}> (Optional)</span>{' '}
                  <span className="label-tooltip">
                    <Icon key={st.iconGen} name="help-circle" />
                    <span className="tooltip-text">PDF, JPG, or PNG · Max 5MB</span>
                  </span>
                </label>
                <label
                  className={zoneCls('expCert')} id="certZone" htmlFor="expCert" tabIndex={0} role="button" aria-label="Upload certifications"
                  onDragEnter={dragOn('expCert')} onDragOver={dragOn('expCert')} onDragLeave={dragOff('expCert')} onDrop={onDrop('expCert')}
                >
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" id="expCert" className={st.cls.expCert || undefined} ref={certRef} onChange={() => onFileChange('expCert')} />
                  <div className="upload-icon"><Icon key={st.iconGen} name="upload" style={{ width: 24, height: 24 }} /></div>
                  <div className="upload-main" id="certMainText">{uploadMain('expCert')}</div>
                  <div className="upload-sub" id="certSubText">{uploadSub('expCert')}</div>
                </label>
                {errorDiv('expCert')}
              </div>

              {/* ═══ MOTIVATION ═══ */}
              <div className="form-group" style={{ marginTop: 8 }} id="grp-expMotivation">
                <label className="form-label" htmlFor="expMotivation">
                  Why do you want to become an expert reviewer? <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  className={inputCls('form-textarea', 'expMotivation')}
                  rows={5}
                  aria-required="true"
                  placeholder="Share your motivation and how your expertise can help maintain quality standards..."
                  maxLength={500}
                  {...textProps('expMotivation')}
                />
                <div className={counterCls} id="motivCharCounter">
                  <span id="motivCharText">{`${motivLen}/500 characters`}</span>
                  <span id="motivCharMin">{motivMin}</span>
                </div>
                <div className="char-bar">
                  <div className="char-bar-fill" id="motivCharBar" style={barStyle} />
                </div>
                {errorDiv('expMotivation')}
              </div>

              {/* Submit Button */}
              <button type="submit" className={st.loading ? 'btn-submit loading' : 'btn-submit'} id="expSubmitBtn" disabled={st.submitDisabled} style={{ marginTop: 8 }}>
                {st.loading
                  ? <span id="submitBtnText"><div className="btn-spinner" /> Submitting...</span>
                  : <span id="submitBtnText">Submit Application</span>}
              </button>
            </form>

            <p className="auth-footer-text" style={{ marginTop: 24 }}>
              Already have an account? <A href="expert-login.html">Sign in</A>
            </p>
          </div>
        </div>
      </div>

      {/* ═══ SUCCESS MODAL ═══ */}
      <div id="successModal" style={{ display: st.success ? 'flex' : 'none', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', zIndex: 200, backdropFilter: 'blur(4px)' }}>
        <div style={{ background: 'white', borderRadius: 24, padding: 40, textAlign: 'center', maxWidth: 420, margin: '0 16px', boxShadow: '0 32px 80px rgba(0,0,0,0.15)', animation: 'fadeUp 0.4s ease' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#10b981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 12px 32px rgba(16,185,129,0.3)' }}>
            <Icon key={st.iconGen} name="check" style={{ width: 32, height: 32, color: 'white' }} />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Application Submitted!</h2>
          <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>Thank you for applying! We&apos;ll review your application within 48 hours and reach out via email.</p>
          <A
            href="../index.html"
            style={{ display: 'inline-block', padding: '12px 28px', borderRadius: 32, background: 'linear-gradient(to bottom,hsl(0,0%,16%),hsl(0,0%,10%))', color: 'white', fontWeight: 500, textDecoration: 'none', fontSize: 14, transition: 'transform 0.2s' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = ''; }}
          >
            Back to Home
          </A>
        </div>
      </div>
    </>
  );
}
