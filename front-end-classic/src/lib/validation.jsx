/**
 * LANNENT — Validation Module
 * Ported from front-end/js/validation.js.
 *
 * The validators are unchanged. The DOM helpers (showError/clearError/form)
 * became the useFieldErrors() hook, and toast/confirm render through
 * <ToastHost/> and <ConfirmHost/> with the original markup and styles.
 */
import { useCallback, useState } from 'react';

// ─── Validators (return error string or null) ─────────────────────────────
function required(value, label) {
  if (!value || String(value).trim() === '') return `${label} is required.`;
  return null;
}

// Letters from any script, plus the marks, hyphens, apostrophes and periods
// that real names contain. The old rule was /^[A-Za-z\s]+$/, which rejected
// "José García", "Anne-Marie O'Brien" and "Marta Kovač" outright, and its
// 3-character minimum rejected two-character CJK names.
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\s'’.\-]*$/u;

function fullName(value) {
  const v = String(value ?? '').trim();
  if (v === '') return 'Full name is required.';
  if (!NAME_PATTERN.test(v)) return 'Name can contain letters, spaces, hyphens and apostrophes.';
  if (v.length < 2) return 'Full name must be at least 2 characters.';
  return null;
}

function email(value) {
  if (!value || String(value).trim() === '') return 'Email address is required.';
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(String(value).trim())) return 'Please enter a valid email address.';
  return null;
}

function password(value) {
  if (!value || value.length === 0) return 'Password is required.';
  if (value.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(value)) return 'Password must include at least one uppercase letter.';
  if (!/[a-z]/.test(value)) return 'Password must include at least one lowercase letter.';
  if (!/\d/.test(value)) return 'Password must include at least one number.';
  if (!/[!@#$%^&*]/.test(value)) return 'Password must include at least one special character (!@#$%^&*).';
  return null;
}

/**
 * Returns { label, level } where level is 0–3 (none, weak, medium, strong)
 */
function passwordStrength(value) {
  if (!value || value.length === 0) return { label: '', level: 0 };
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[!@#$%^&*]/.test(value)) score++;
  if (score <= 2) return { label: 'Weak', level: 1 };
  if (score <= 3) return { label: 'Medium', level: 2 };
  return { label: 'Strong', level: 3 };
}

function passwordMatch(p1, p2) {
  if (!p2 || p2.length === 0) return 'Please confirm your password.';
  if (p1 !== p2) return 'Passwords do not match.';
  return null;
}

function minLength(value, n, label) {
  if (!value || String(value).trim().length < n) return `${label} must be at least ${n} characters.`;
  return null;
}

function positiveNumber(value, label) {
  const num = parseFloat(value);
  if (isNaN(num)) return `${label} must be a valid number.`;
  if (num <= 0) return `${label} must be greater than 0.`;
  return null;
}

function futureDate(value, label) {
  if (!value) return `${label} is required.`;
  const date = new Date(value);
  const today = new Date(); today.setHours(0,0,0,0);
  if (date <= today) return `${label} must be a future date.`;
  return null;
}

function selected(value, label) {
  if (!value || value === '' || value === 'none') return `Please select a ${label}.`;
  return null;
}

function phone(value) {
  if (!value || value.trim() === '') return null; // optional
  const re = /^[\+]?[\d\s\-\(\)]{7,15}$/;
  if (!re.test(value.trim())) return 'Please enter a valid phone number.';
  return null;
}

// ─── Phone Country Validation Rules ───────────────────────────────────────
/**
 * Country-specific phone validation rules.
 * Each entry maps a dial code to { length, pattern, name, flag, placeholder }.
 */
const phoneCountryRules = {
  '+91': {
    length: 10,
    pattern: /^[6-9]\d{9}$/,
    name: 'India',
    flag: '🇮🇳',
    placeholder: 'e.g. 9876543210'
  },
  '+1': {
    length: 10,
    pattern: /^\d{10}$/,
    name: 'USA',
    flag: '🇺🇸',
    placeholder: 'e.g. 2025551234'
  },
  '+44': {
    length: 10,
    pattern: /^[1-9]\d{9}$/,
    name: 'UK',
    flag: '🇬🇧',
    placeholder: 'e.g. 7911123456'
  },
  '+61': {
    length: 9,
    pattern: /^[2-9]\d{8}$/,
    name: 'Australia',
    flag: '🇦🇺',
    placeholder: 'e.g. 412345678'
  },
  '+49': {
    length: 11,
    pattern: /^\d{10,11}$/,
    name: 'Germany',
    flag: '🇩🇪',
    placeholder: 'e.g. 15123456789'
  }
};

/**
 * Returns the validation rule object for a given country code.
 * Falls back to a generic rule if the code is not mapped.
 * @param {string} countryCode – e.g. '+91'
 * @returns {{ length: number, pattern: RegExp, name: string, flag: string, placeholder: string }}
 */
function getPhoneValidationRule(countryCode) {
  return phoneCountryRules[countryCode] || {
    length: 15,
    pattern: /^\d{7,15}$/,
    name: 'Other',
    flag: '🌐',
    placeholder: 'Enter phone number'
  };
}

/**
 * Validates a phone number against the selected country's rules.
 * @param {string} value       – raw phone digits
 * @param {string} countryCode – e.g. '+91'
 * @returns {string|null} error message or null if valid
 */
function validatePhoneNumber(value, countryCode) {
  if (!value || value.trim() === '') return null; // phone is optional

  const digits = value.replace(/\D/g, '');
  const rule = getPhoneValidationRule(countryCode);

  if (digits.length !== rule.length) {
    return `Phone number must be exactly ${rule.length} digits for ${rule.name} (${countryCode}).`;
  }
  if (!rule.pattern.test(digits)) {
    return `Invalid phone number for ${rule.name} (${countryCode}).`;
  }
  return null;
}

/**
 * Returns the list of supported countries for dropdown rendering.
 * @returns {Array<{ code: string, name: string, flag: string }>}
 */
function getPhoneCountries() {
  return Object.keys(phoneCountryRules).map(code => ({
    code,
    name: phoneCountryRules[code].name,
    flag: phoneCountryRules[code].flag
  }));
}


// ─── Toast / confirm (rendered by ToastHost / ConfirmHost) ─────────────────
const listeners = { toast: null, confirm: null };
export function _subscribe(kind, fn) {
  listeners[kind] = fn;
  return () => { if (listeners[kind] === fn) listeners[kind] = null; };
}

/** Same signature as the original Validate.toast. `message` may be a string or JSX. */
function toast(message, type = 'success', duration = 3500) {
  listeners.toast?.({ message, type, duration, id: Date.now() + Math.random() });
}

/** Same signature as the original Validate.confirm. `message` may be a string or JSX. */
function confirm(message, onConfirm, onCancel) {
  listeners.confirm?.({ message, onConfirm, onCancel, id: Date.now() + Math.random() });
}

export const Validate = {
  required, fullName, email, password, passwordStrength, passwordMatch, minLength,
  positiveNumber, futureDate, selected, phone, phoneCountryRules, getPhoneValidationRule,
  validatePhoneNumber, getPhoneCountries, toast, confirm,
};
export default Validate;

// ─── Field errors ────────────────────────────────────────────────────────────
const ERROR_FIELD_STYLE = { borderColor: '#ef4444', boxShadow: '0 0 0 2px rgba(239,68,68,0.15)' };

/**
 * React replacement for Validate.showError / clearError / clearAllErrors /
 * attachAutoClears / form.
 *
 *   const v = useFieldErrors();
 *   <input id="email" style={{ ...v.fieldStyle('email') }} onChange={e => { setEmail(e.target.value); v.clearError('email'); }} />
 *   {v.error('email')}            // renders the original <p id="email_err">, right after the field
 *   const { valid } = v.form([{ fieldId: 'email', value: email, checks: [Validate.email] }]);
 */
export function useFieldErrors() {
  const [errors, setErrors] = useState({});

  const showError = useCallback((fieldId, message) => {
    setErrors((e) => ({ ...e, [fieldId]: message }));
  }, []);
  const clearError = useCallback((fieldId) => {
    setErrors((e) => {
      if (!(fieldId in e)) return e;
      const next = { ...e };
      delete next[fieldId];
      return next;
    });
  }, []);
  const clearAllErrors = useCallback(() => setErrors({}), []);

  const form = useCallback((rules) => {
    let valid = true;
    const found = {};
    rules.forEach(({ fieldId, value, checks }) => {
      for (const check of checks) {
        const err = check(value);
        if (err) { found[fieldId] = err; valid = false; break; }
      }
    });
    setErrors((e) => {
      const next = { ...e };
      rules.forEach(({ fieldId }) => { delete next[fieldId]; });
      return { ...next, ...found };
    });
    return { valid, errors: found };
  }, []);

  const fieldStyle = useCallback((fieldId) => (errors[fieldId] ? ERROR_FIELD_STYLE : {}), [errors]);
  const error = useCallback((fieldId) => (errors[fieldId] ? <FieldError id={fieldId + '_err'} message={errors[fieldId]} /> : null), [errors]);

  return { errors, showError, clearError, clearAllErrors, form, fieldStyle, error, hasError: (id) => !!errors[id] };
}

/** The exact element Validate.showError inserted after a field. */
export function FieldError({ id, message }) {
  return (
    <p id={id} style={{ color: '#ef4444', fontSize: 12, marginTop: 4, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
      <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      {message}
    </p>
  );
}
