import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { Validate } from '../lib/validation';
import { usePageStyle } from '../lib/hooks';
import css from './hire-gig-workers.css?inline';

// Load real workers from Store
function loadWorkersFromStore() {
  return Store.getUsers()
    .filter((u) => u.role === 'worker' && u.status !== 'suspended')
    .map((u) => ({
      id: u.id,
      name: u.name,
      avatar: u.avatar || u.name.split(' ').map((n) => n[0]).join('').toUpperCase(),
      avatarColor: u.avatarColor || 'linear-gradient(135deg,#6366f1,#4f46e5)',
      specialization: u.specialization || (u.skills && u.skills[0]) || 'Freelancer',
      rating: u.rating || 4.5,
      reviewCount: u.reviewCount || u.completedProjects || 0,
      skills: u.skills || [],
      projectsCompleted: u.completedProjects || 0,
      successRate: u.successRate || 95,
      hourlyRate: u.hourlyRate || 50,
      location: u.location || 'Remote',
      availability: u.availability || 'Available',
      experience: u.experience || 'Intermediate',
      bio: u.bio || 'Experienced freelancer ready to help with your project.',
      portfolio: u.portfolio || [],
    }));
}

const SKILL_LIST = ['React', 'TypeScript', 'Node.js', 'Python', 'Django', 'AWS', 'Docker', 'Kubernetes', 'Figma', 'UI Design', 'PostgreSQL', 'MongoDB', 'React Native', 'Swift', 'Machine Learning'];
const AVAILABILITY = ['Available', 'Busy', 'Not Available'];

// lucide.createIcons() after each filter pass replaced every icon in the
// document; re-inserting the same nodes gives the same repaint.
function repaintIcons() {
  document.querySelectorAll('svg[data-lucide]').forEach((el) => el.parentNode.insertBefore(el, el.nextSibling));
}

const statBox = { textAlign: 'center', padding: 8, borderRadius: 8, background: 'var(--input-bg)' };
const checkLabel = { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '6px 8px', borderRadius: 8 };
const sectionHead = { fontWeight: 700, fontSize: 13, color: '#111827', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 };
const sectionIcon = (bg, extra) => ({ width: 20, height: 20, background: bg, borderRadius: 5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...extra });

export default function HireGigWorkers() {
  usePageStyle(css);
  const [workers] = useState(loadWorkersFromStore);
  const selectedWorker = useRef(null);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [selectedAvailability, setSelectedAvailability] = useState([]);
  const [q, setQ] = useState('');
  const [exp, setExp] = useState('');
  const [minRating, setMinRating] = useState('0');
  const [maxRate, setMaxRate] = useState('200');
  const [filterPass, setFilterPass] = useState(0);
  useLayoutEffect(() => { if (filterPass) repaintIcons(); }, [filterPass]);
  const applyFilters = () => setFilterPass((n) => n + 1);

  const [profile, setProfile] = useState(null); // worker shown in the panel
  const [profileStyle, setProfileStyle] = useState(undefined);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLabel, setInviteLabel] = useState('Invite worker to one of your active projects');
  const [sentToasts, setSentToasts] = useState([]);
  const projectSelRef = useRef(null);
  const inviteMessageRef = useRef(null);

  const lower = q.toLowerCase();
  const filtered = workers.filter((w) => {
    const matchSearch = !lower || w.name.toLowerCase().indexOf(lower) !== -1
      || w.specialization.toLowerCase().indexOf(lower) !== -1
      || w.skills.some((s) => s.toLowerCase().indexOf(lower) !== -1);
    const matchExp = !exp || w.experience === exp;
    const matchRating = w.rating >= parseFloat(minRating);
    const matchRate = w.hourlyRate <= Number(maxRate);
    const matchSkills = selectedSkills.length === 0 || selectedSkills.some((sk) => w.skills.indexOf(sk) !== -1);
    const matchAvail = selectedAvailability.length === 0 || selectedAvailability.indexOf(w.availability) !== -1;
    return matchSearch && matchExp && matchRating && matchRate && matchSkills && matchAvail;
  });

  function clearFilters() {
    setQ('');
    setExp('');
    setMinRating('0');
    setMaxRate('200');
    setSelectedSkills([]);
    setSelectedAvailability([]);
    applyFilters();
  }

  function toggleFilterSkill(skill) {
    setSelectedSkills((list) => (list.includes(skill) ? list.filter((s) => s !== skill) : [...list, skill]));
    applyFilters();
  }

  function toggleFilterAvailability(status) {
    setSelectedAvailability((list) => (list.includes(status) ? list.filter((s) => s !== status) : [...list, status]));
    applyFilters();
  }

  function openProfile(id) {
    const worker = workers.find((w) => w.id === id);
    if (!worker) return;
    selectedWorker.current = worker;
    setProfile(worker);
    setProfileStyle({ display: 'flex', alignItems: 'flex-start', justifyContent: 'center' });
    applyFilters();
  }

  function closeProfile() {
    setProfileStyle((s) => ({ ...s, display: 'none' }));
  }

  function openInviteModal(id) {
    const worker = workers.find((w) => w.id === id);
    if (!worker) return;
    selectedWorker.current = worker;
    setInviteLabel('Invite ' + worker.name + ' to one of your active projects');
    setInviteOpen(true);
  }

  function sendInvite() {
    // Validate: a project must be selected
    const projectSel = projectSelRef.current;
    const projectId = projectSel ? projectSel.value : '';
    if (!projectId) {
      Validate.toast('Please select a project to invite the worker to.', 'error');
      return;
    }
    // Guard: only open tasks accept invitations
    const task = Store.getTaskById(projectId);
    if (task && task.status !== 'open') {
      Validate.toast('This project is no longer open — cannot send invitations.', 'error');
      return;
    }
    // Save proposal/invitation to Store
    const sw = selectedWorker.current;
    if (sw) {
      try {
        Store.createProposal({
          taskId: projectId,
          workerId: sw.id,
          workerName: sw.name,
          avatar: sw.avatar,
          avatarColor: sw.avatarColor,
          bidPrice: '$' + sw.hourlyRate + '/hr',
          timeline: 'To be agreed',
          coverLetter: inviteMessageRef.current ? inviteMessageRef.current.value : 'Client invitation',
          skills: sw.skills || [],
          status: 'pending',
          type: 'invitation',
          createdAt: new Date().toISOString().slice(0, 10),
        });
        // Notify worker
        Store.addNotification({ userId: sw.id, type: 'invitation', text: 'You have been invited to a project', subtext: (projectSel.options[projectSel.selectedIndex]?.text || 'Project') + ' · just now', read: false });
      } catch (e) { console.warn('Store invite failed:', e); }
    }
    setInviteOpen(false);
    const id = Date.now() + Math.random();
    setSentToasts((list) => [...list, { id, text: 'Invitation sent to ' + (sw ? sw.name : 'worker') + '!' }]);
    setTimeout(() => { setSentToasts((list) => list.filter((t) => t.id !== id)); }, 3000);
  }

  // Invite modal project options, built once when the page loaded.
  const [projectOptions] = useState(() => {
    const session = Auth.getCurrentUser();
    if (!session) return <option>No projects available</option>;
    const openTasks = Store.getTasksByClient(session.userId).filter((t) => t.status === 'open');
    if (!openTasks.length) return <option value="">No open projects — only open projects accept invitations</option>;
    return openTasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>);
  });

  function renderWorkerCards(list) {
    if (!list.length) {
      return (
        <div style={{ borderRadius: 16, border: '1px solid var(--border)', background: 'var(--card)', padding: 48, textAlign: 'center' }}>
          <h3 style={{ fontWeight: 500, fontSize: 18, marginBottom: 8 }}>No freelancers found</h3>
          <p style={{ fontSize: 14, color: 'var(--muted-foreground)', marginBottom: 16 }}>Try adjusting your filters or search criteria</p>
          <button onClick={clearFilters} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 14 }}>Clear Filters</button>
        </div>
      );
    }
    return list.map((w) => {
      const availBg = w.availability === 'Available' ? '#22c55e' : (w.availability === 'Busy' ? '#f59e0b' : '#ef4444');
      const badgeBg = w.availability === 'Available' ? '#ecfdf5' : '#fffbeb';
      const badgeColor = w.availability === 'Available' ? '#059669' : '#d97706';
      return (
        <div key={w.id} className="worker-card" onClick={() => openProfile(w.id)}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ position: 'relative' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: w.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 13, fontWeight: 700 }}>{w.avatar}</div>
                <div className="avail-dot" style={{ position: 'absolute', bottom: 0, right: 0, background: availBg }} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{w.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{w.specialization}</div>
              </div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 9999, background: badgeBg, color: badgeColor }}>{w.availability}</span>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
            {w.skills.map((s, j) => <span key={j} className="skill-tag" style={{ fontSize: 11, padding: '2px 8px' }}>{s}</span>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
            <div style={statBox}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#f59e0b' }}>{`${w.rating}★`}</div>
              <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{`${w.reviewCount} reviews`}</div>
            </div>
            <div style={statBox}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#10b981' }}>{`${w.successRate}%`}</div>
              <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>Success</div>
            </div>
            <div style={statBox}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{`$${w.hourlyRate}/h`}</div>
              <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>Rate</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <Icon name="map-pin" style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{w.location}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button onClick={(e) => { e.stopPropagation(); openProfile(w.id); }} className="btn-outline">View Profile</button>
            <button onClick={(e) => { e.stopPropagation(); openInviteModal(w.id); }} className="btn-primary">Invite</button>
          </div>
        </div>
      );
    });
  }

  function renderProfilePanel(worker) {
    // Availability & Experience badge colours
    const availBg = worker.availability === 'Available' ? '#ecfdf5' : (worker.availability === 'Busy' ? '#fffbeb' : '#fef2f2');
    const availColor = worker.availability === 'Available' ? '#059669' : (worker.availability === 'Busy' ? '#d97706' : '#dc2626');
    const expBg = worker.experience === 'Expert' ? '#eef2ff' : (worker.experience === 'Intermediate' ? '#faf5ff' : '#f0fdf4');
    const expColor = worker.experience === 'Expert' ? '#4f46e5' : (worker.experience === 'Intermediate' ? '#7c3aed' : '#16a34a');

    return (
      <>
        {/* ── Header ── */}
        <div style={{ padding: '24px 24px 20px', background: 'linear-gradient(135deg,#eef2ff,#e0e7ff)', borderBottom: '1px solid #c7d2fe' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ position: 'relative' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: worker.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 18, fontWeight: 700, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>{worker.avatar}</div>
                <div style={{ position: 'absolute', bottom: 1, right: 1, width: 14, height: 14, borderRadius: '50%', background: availColor, border: '2px solid white' }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 20, color: '#111827' }}>{worker.name}</div>
                <div style={{ fontSize: 14, color: '#4f46e5', fontWeight: 500, marginTop: 2 }}>{worker.specialization}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{`📍 ${worker.location}`}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 9999, background: availBg, color: availColor }}>{worker.availability}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 9999, background: expBg, color: expColor }}>{worker.experience}</span>
                </div>
              </div>
            </div>
            <button onClick={closeProfile} style={{ background: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer', color: '#4f46e5', fontSize: 22, lineHeight: 1, width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>&times;</button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ padding: '22px 24px', maxHeight: '62vh', overflowY: 'auto' }}>
          {/* About / Bio */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ ...sectionHead, marginBottom: 8 }}>
              <span style={sectionIcon('#6366f1', { color: 'white', fontSize: 11 })}>👤</span>
              About
            </div>
            <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.65, margin: 0, padding: '12px 14px', background: '#f8fafc', borderRadius: 10, borderLeft: '3px solid #6366f1' }}>{worker.bio}</p>
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
            <div style={{ textAlign: 'center', padding: '12px 6px', borderRadius: 12, background: '#fffbeb', border: '1px solid #fde68a' }}>
              <div style={{ fontWeight: 700, color: '#d97706', fontSize: 17 }}>{worker.rating}<span style={{ fontSize: 13 }}>★</span></div>
              <div style={{ fontSize: 10, color: '#92400e', marginTop: 3 }}>{`${worker.reviewCount} reviews`}</div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px 6px', borderRadius: 12, background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
              <div style={{ fontWeight: 700, color: '#059669', fontSize: 17 }}>{`${worker.successRate}%`}</div>
              <div style={{ fontSize: 10, color: '#065f46', marginTop: 3 }}>Success</div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px 6px', borderRadius: 12, background: '#eef2ff', border: '1px solid #c7d2fe' }}>
              <div style={{ fontWeight: 700, color: '#4f46e5', fontSize: 17 }}>{worker.projectsCompleted}</div>
              <div style={{ fontSize: 10, color: '#3730a3', marginTop: 3 }}>Projects</div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px 6px', borderRadius: 12, background: '#faf5ff', border: '1px solid #ddd6fe' }}>
              <div style={{ fontWeight: 700, color: '#7c3aed', fontSize: 15 }}>{`$${worker.hourlyRate}`}<span style={{ fontSize: 10 }}>/hr</span></div>
              <div style={{ fontSize: 10, color: '#5b21b6', marginTop: 3 }}>Hourly Rate</div>
            </div>
          </div>

          {/* Skills */}
          <div style={{ marginBottom: 20 }}>
            <div style={sectionHead}>
              <span style={sectionIcon('#0ea5e9', { color: 'white', fontSize: 11 })}>✓</span>
              Skills
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {worker.skills.map((s, j) => <span key={j} style={{ padding: '5px 12px', borderRadius: 20, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#0369a1', fontSize: 12, fontWeight: 500 }}>{s}</span>)}
            </div>
          </div>

          {/* Portfolio (reviews and work history are never part of the loaded worker) */}
          {worker.portfolio && worker.portfolio.length ? (
            <div style={{ marginBottom: 22 }}>
              <div style={sectionHead}>
                <span style={sectionIcon('#6366f1', { color: 'white', fontSize: 11 })}>📄</span>
                Portfolio
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {worker.portfolio.map((port, p) => (
                  <div key={p} style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#f9fafb' }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: '#111827', marginBottom: 4 }}>{port.title}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>{port.description}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* CTA */}
          <div style={{ display: 'flex', gap: 12, paddingTop: 4 }}>
            <button onClick={() => { openInviteModal(worker.id); closeProfile(); }} className="btn-primary" style={{ flex: 1, padding: 12, borderRadius: 12, fontWeight: 600 }}>Invite to Project</button>
            <button onClick={closeProfile} className="btn-outline" style={{ flex: 1, padding: 12, borderRadius: 12 }}>Close</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <DashboardLayout
        role="client"
        activePath="hire-gig-workers.html"
        pageTitle="Hire Gig Workers"
        pageSubtitle="Find skilled freelancers and invite them to collaborate on your project"
      >
        <div className="hire-layout">
          <div className="filter-sidebar">
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Filters</span>
                <button style={{ fontSize: 12, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer' }} onClick={clearFilters}>Reset</button>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 12 }}>Experience</label>
                <select id="filterExp" className="form-input" value={exp} onChange={(e) => { setExp(e.target.value); applyFilters(); }}>
                  <option value="">All Levels</option>
                  <option value="Entry">Entry</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Expert">Expert</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 12 }}>Hourly Rate (max)</label>
                <input id="rateRange" type="range" min="0" max="200" step="5" value={maxRate} onChange={(e) => { setMaxRate(e.target.value); applyFilters(); }} style={{ width: '100%' }} />
                <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>Up to $<span id="rateValue">{maxRate}</span>/hr</p>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 12 }}>Minimum Rating</label>
                <select id="filterRating" className="form-input" value={minRating} onChange={(e) => { setMinRating(e.target.value); applyFilters(); }}>
                  <option value="0">Any</option>
                  <option value="4">4.0+</option>
                  <option value="4.5">4.5+</option>
                  <option value="4.8">4.8+</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 12 }}>Skills</label>
                <div style={{ display: 'grid', gap: 2, maxHeight: 220, overflowY: 'auto' }}>
                  {SKILL_LIST.map((s) => (
                    <label key={s} style={checkLabel}>
                      <input type="checkbox" value={s} checked={selectedSkills.includes(s)} onChange={() => toggleFilterSkill(s)} />
                      <span style={{ fontSize: 13 }}>{s}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 12 }}>Availability</label>
                {AVAILABILITY.map((s) => (
                  <label key={s} style={checkLabel}>
                    <input type="checkbox" value={s} checked={selectedAvailability.includes(s)} onChange={() => toggleFilterAvailability(s)} />
                    <span style={{ fontSize: 13 }}>{s}</span>
                  </label>
                ))}
              </div>
              <button onClick={clearFilters} style={{ width: '100%', padding: 10, borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Clear All Filters</button>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 16 }}>
              <p style={{ fontSize: 13, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}><span id="workerCount">{filtered.length}</span> freelancers found</p>
              <div style={{ position: 'relative', flex: 1, maxWidth: 420 }}>
                <Icon name="search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--muted-foreground)' }} />
                <input id="workerSearch" type="text" placeholder="Search freelancers by name, skill..." style={{ width: '100%', padding: '10px 16px 10px 40px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 13, boxSizing: 'border-box' }} value={q} onChange={(e) => { setQ(e.target.value); applyFilters(); }} />
              </div>
            </div>
            <div id="workersContainer" className="workers-grid">{renderWorkerCards(filtered)}</div>
          </div>
        </div>
      </DashboardLayout>

      {createPortal(
        <>
          <div className="profile-modal" id="profileModal" style={profileStyle} onClick={(e) => { if (e.target === e.currentTarget) closeProfile(); }}>
            <div className="profile-panel" id="profilePanel">{profile ? renderProfilePanel(profile) : null}</div>
          </div>
          <div id="inviteModal" style={{ display: inviteOpen ? 'flex' : 'none', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 210, alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
            <div style={{ background: 'white', borderRadius: 24, padding: 32, width: '100%', maxWidth: 440, margin: '0 16px', boxShadow: '0 32px 80px rgba(0,0,0,0.15)' }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Invite to Project</h2>
              <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 20 }} id="inviteWorkerLabel">{inviteLabel}</p>
              <div className="form-group"><label className="form-label">Select Project</label>
                <select className="form-input" id="projectSelect" style={{ padding: '12px 16px', width: '100%' }} ref={projectSelRef}>
                  {projectOptions}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Personal Message</label>
                <textarea id="inviteMessage" className="form-input" rows="3" placeholder="Hi! I would like to invite you to work on..." ref={inviteMessageRef} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setInviteOpen(false)} className="btn-outline" style={{ flex: 1, padding: 12, borderRadius: 12 }}>Cancel</button>
                <button onClick={sendInvite} className="btn-primary" style={{ flex: 2, padding: 12, borderRadius: 12 }}>Send Invitation</button>
              </div>
            </div>
          </div>
          {sentToasts.map((t) => (
            <div key={t.id} style={{ position: 'fixed', bottom: 24, right: 24, background: '#10b981', color: 'white', padding: '14px 20px', borderRadius: 12, fontSize: 14, fontWeight: 500, zIndex: 300, boxShadow: '0 8px 24px rgba(16,185,129,0.3)' }}>{t.text}</div>
          ))}
        </>,
        document.body,
      )}
    </>
  );
}
