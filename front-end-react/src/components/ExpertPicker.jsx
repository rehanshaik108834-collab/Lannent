import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Store } from '../lib/store';

/**
 * LANNENT — Expert Reviewer picker
 * React port of front-end/js/expert-picker.js, shared by post-task (project
 * audit) and dispute (dispute audit). Only reviewers whose domains cover the
 * project's category are offered; the server enforces the same rule.
 *
 * Render it inside the page's own container, where ExpertPicker.render()
 * used to fill innerHTML:
 *
 *   <div id="auditExpertList">
 *     <ExpertPicker category={category} selectedId={expertId} onChange={setExpertId} />
 *   </div>
 */

export function matchingExperts(category) {
  const experts = (Store.getExperts && Store.getExperts()) || [];
  if (!category) return experts;
  return experts.filter((e) => Array.isArray(e.domains) && e.domains.includes(category));
}

export default function ExpertPicker({ category, selectedId = null, onChange }) {
  const [profileId, setProfileId] = useState(null);
  const list = matchingExperts(category);

  // A reviewer selected for a different category is no longer valid.
  const stale = selectedId && !list.some((e) => e.id === selectedId);
  useEffect(() => {
    if (stale) onChange?.(null);
  }, [stale, onChange]);

  const select = (id) => onChange?.(selectedId === id ? null : id);

  const profile = profileId ? Store.getUserById(profileId) : null;
  const modal = profile
    ? createPortal(
        <div id="xpProfileModal" className="xp-modal" style={{ display: 'flex' }}>
          <div className="xp-modal-card">
            <div className="xp-modal-head">
              <span className="xp-avatar xp-avatar-lg" style={{ background: profile.avatarColor }}>{profile.avatar}</span>
              <div>
                <div className="xp-modal-name">{profile.name}</div>
                <div className="xp-meta">{profile.specialization}</div>
              </div>
              <button type="button" className="xp-close" onClick={() => setProfileId(null)} aria-label="Close">&times;</button>
            </div>
            <div className="xp-stats">
              <div><div className="xp-stat-v">{profile.reviewsDone || 0}</div><div className="xp-stat-k">Reviews completed</div></div>
              <div><div className="xp-stat-v">{profile.hourlyRate ? '$' + profile.hourlyRate : '—'}</div><div className="xp-stat-k">Hourly rate</div></div>
              <div><div className="xp-stat-v">{profile.status === 'active' ? 'Active' : profile.status}</div><div className="xp-stat-k">Account</div></div>
            </div>
            <div className="xp-section-k">Reviews work in</div>
            <div className="xp-chips">
              {(profile.domains || []).length
                ? profile.domains.map((d) => <span key={d} className="xp-chip">{d}</span>)
                : <span className="xp-chip">Not specified</span>}
            </div>
            <div className="xp-modal-actions">
              <button type="button" className="btn-outline" onClick={() => setProfileId(null)}>Close</button>
              <button type="button" className="btn-primary" onClick={() => { select(profile.id); setProfileId(null); }}>
                {`Select ${profile.name.split(' ')[0]}`}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  if (!list.length) {
    return (
      <div style={{ padding: 16, border: '1px dashed var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--muted-foreground)' }}>
        No Expert Reviewer currently covers <strong>{category || 'this category'}</strong>.
        {' '}Choose a different category, or continue without an audit.
      </div>
    );
  }

  return (
    <>
      {list.map((e) => {
        const on = e.id === selectedId;
        return (
          <div
            key={e.id}
            className={'xp-card' + (on ? ' xp-on' : '')}
            onClick={() => select(e.id)}
            role="button"
            tabIndex={0}
            aria-pressed={String(on)}
            onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(e.id); } }}
          >
            <span className="xp-radio">{on ? <span className="xp-dot" /> : null}</span>
            <span className="xp-avatar" style={{ background: e.avatarColor }}>{e.avatar}</span>
            <span className="xp-body">
              <span className="xp-name">{e.name}</span>
              <span className="xp-meta">{`${e.specialization} · ${e.reviewsDone} review${e.reviewsDone === 1 ? '' : 's'}`}</span>
            </span>
            <button type="button" className="xp-profile" onClick={(ev) => { ev.stopPropagation(); setProfileId(e.id); }}>View profile</button>
          </div>
        );
      })}
      {modal}
    </>
  );
}
