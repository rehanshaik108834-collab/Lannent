import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import A from '../components/A';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { Validate } from '../lib/validation';
import { usePageStyle } from '../lib/hooks';
import css from './worker-applications.css?inline';

// main.js escapeHtml: the hire note ran it and then set textContent, so a
// name with &, <, >, " or ' showed its entities. Kept as it rendered.
function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Load projects from Store (tasks belonging to current client)
function loadProjects() {
  const session = Auth.getCurrentUser();
  if (!session) return [];
  // Only show open tasks — clients can only review proposals and hire for open projects
  return Store.getTasksByClient(session.userId)
    .filter((t) => t.status === 'open')
    .map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description || '',
      budget: '$' + (t.budget || 0).toLocaleString(),
      deadline: t.deadline ? new Date(t.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No deadline',
      posted: t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent',
      proposalCount: Store.getProposalsByTask(t.id).filter((p) => p.type !== 'invitation').length,
    }));
}

// Build proposals list from Store only (filtered to current client's tasks)
function buildAllProposals() {
  const session = Auth.getCurrentUser();
  if (!session) return [];
  const clientTaskIds = Store.getTasksByClient(session.userId).map((t) => t.id);
  return Store.getProposals()
    .filter((p) => clientTaskIds.includes(p.taskId))
    .map((p) => {
      const worker = Store.getUserById(p.workerId);
      return {
        id: p.id, projectId: p.taskId, taskId: p.taskId,
        workerName: p.workerName || worker?.name || 'Worker',
        avatar: p.avatar || worker?.avatar || 'WK',
        avatarColor: p.avatarColor || worker?.avatarColor || '',
        rating: worker?.rating || 4.5,
        reviewCount: worker?.reviewCount || 10,
        location: worker?.location || 'Remote',
        bidPrice: p.bidPrice || '$0',
        timeline: p.timeline || '2 weeks',
        coverLetter: p.coverLetter || '',
        skills: p.skills || worker?.skills || [],
        completedProjects: worker?.completedProjects || 0,
        successRate: worker?.successRate || 90,
        hourlyRate: worker?.hourlyRate || '$50/hr',
        responseTime: worker?.responseTime || 'Within 24 hours',
        status: p.status || 'pending',
        fromStore: true,
        type: p.type || 'application',
      };
    });
}

// Re-inserting the icons in place gives the repaint lucide.createIcons() caused.
function repaintIcons() {
  document.querySelectorAll('svg[data-lucide]').forEach((el) => el.parentNode.insertBefore(el, el.nextSibling));
}

const sys = 'system-ui,-apple-system,sans-serif';
const money = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function WorkerApplications() {
  usePageStyle(css);
  const [projects] = useState(loadProjects);
  const [allProposals, setAllProposals] = useState(buildAllProposals);
  const [selectedProjectId, setSelectedProjectId] = useState(() => projects[0]?.id || '');
  const [selectedProposalId, setSelectedProposalId] = useState(null);
  const [appliedQuery, setAppliedQuery] = useState(''); // what filterProposals() last applied
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuGen, setMenuGen] = useState(0);
  const [hire, setHire] = useState(null); // hire modal content, null = hidden
  const [hireOpen, setHireOpen] = useState(false);

  // The dropdown chevron. The page kept a reference to the icon element, but
  // every later lucide.createIcons() (selecting a proposal, searching,
  // switching project, opening the hire modal) replaced it with a copy that
  // kept its current rotation. From then on the toggle rotated a detached
  // element, and the visible chevron only changed when switchProject reset it.
  const [chevron, setChevron] = useState({ transform: 'rotate(0deg)', transition: undefined });
  const chevronLive = useRef(true);
  const [iconPass, setIconPass] = useState(0);
  const iconsReplaced = () => { chevronLive.current = false; setIconPass((n) => n + 1); };
  useLayoutEffect(() => { if (iconPass) repaintIcons(); }, [iconPass]);

  const displayRef = useRef(null);
  const menuRef = useRef(null);

  const proposalsFor = (list, projectId) => list.filter((p) => (p.projectId === projectId || p.taskId === projectId) && p.type !== 'invitation' && p.status === 'pending');
  const getProposals = () => proposalsFor(allProposals, selectedProjectId);

  // Close dropdown when clicking outside
  useEffect(() => {
    const onDocClick = (event) => {
      if (displayRef.current && menuRef.current && !displayRef.current.contains(event.target) && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
        if (chevronLive.current) setChevron((c) => ({ ...c, transform: 'rotate(0deg)' }));
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  if (!projects.length) {
    return (
      <DashboardLayout role="client" activePath="client-my-projects.html" pageTitle="Worker Applications" pageSubtitle="Review proposals and hire the best talent">
        <div style={{ textAlign: 'center', padding: '80px 24px' }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: 'linear-gradient(135deg,#eef2ff,#e0e7ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Icon name="inbox" style={{ width: 32, height: 32, color: '#6366f1' }} />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No projects yet</h3>
          <p style={{ fontSize: 14, color: 'var(--muted-foreground)', marginBottom: 24 }}>Post a task first to start receiving worker applications.</p>
          <A href="post-task.html" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 12, fontSize: 14 }}>Post a Task</A>
        </div>
      </DashboardLayout>
    );
  }

  function selectProposal(id) {
    setSelectedProposalId(id);
    iconsReplaced();
  }

  function switchProject(id) {
    setSelectedProjectId(id);
    setSelectedProposalId(null);
    setAppliedQuery('');
    setMenuGen((n) => n + 1);
    setMenuOpen(false);
    iconsReplaced();
    setChevron((c) => ({ ...c, transform: 'rotate(0deg)' }));
  }

  function toggleMenu() {
    if (!menuOpen) {
      setMenuOpen(true);
      if (chevronLive.current) setChevron({ transform: 'rotate(180deg)', transition: 'transform 0.2s' });
    } else {
      setMenuOpen(false);
      if (chevronLive.current) setChevron((c) => ({ ...c, transform: 'rotate(0deg)' }));
    }
  }

  function filterProposals(value) {
    setSearch(value);
    setAppliedQuery(value);
    iconsReplaced();
  }

  function openHireModal(proposalId) {
    setSelectedProposalId(proposalId);
    const p = allProposals.find((x) => x.id === proposalId);
    if (!p) return;

    // Escrow is funded from the task budget, not the worker's bid, and the
    // client also pays a contract initiation fee. Quote what the server will
    // actually charge, using the same fee table it uses.
    const task = Store.getTaskById(p.taskId);
    const budget = task ? task.budget : parseFloat(String(p.bidPrice).replace(/[$,]/g, '')) || 0;
    const q = Store.Fees.projectFunding(budget);
    setHire({
      workerName: p.workerName,
      bid: money(q.budget),
      fee: money(q.marketplace),
      initiation: money(q.initiation),
      total: money(q.total),
      note: `${escapeHtml(p.workerName)} bid ${p.bidPrice}. Escrow is funded from the project budget of ${money(q.budget)}.`,
    });
    setHireOpen(true);
    iconsReplaced();
  }

  function confirmHire() {
    // Guard: verify the task is still open before hiring
    const task = Store.getTaskById(selectedProjectId);
    if (task && task.status !== 'open') {
      setHireOpen(false);
      Validate.toast('This project is no longer open — cannot hire.', 'error');
      return;
    }

    setHireOpen(false);

    // Save to store if it's a store proposal
    try {
      if (selectedProposalId) {
        const storeProposal = Store.getProposals().find((p) => p.id === selectedProposalId);
        if (storeProposal) {
          Store.hireWorker(selectedProposalId);
        }
      }
    } catch (e) { console.warn('Store hire failed', e); }

    // Update UI — mark hired, disable others in current project
    setAllProposals((list) => list.map((p) => {
      if (p.taskId === selectedProjectId) {
        return { ...p, status: p.id === selectedProposalId ? 'hired' : 'rejected' };
      }
      return p;
    }));

    Validate.toast('✓ Worker hired! Escrow funds locked.', 'success');

    // Re-render the proposal list
    switchProject(selectedProjectId);
  }

  function rejectProposal(proposalId) {
    Validate.confirm('Are you sure you want to reject this application?', () => {
      setAllProposals((list) => list.map((p) => {
        if (p.id === proposalId) {
          return { ...p, status: 'rejected' };
        }
        return p;
      }));

      if (Store.updateProposal) {
        try { Store.updateProposal(proposalId, { status: 'rejected' }); } catch (e) { /* ignored */ }
      }

      Validate.toast('Application rejected.', 'success');
      switchProject(selectedProjectId);
    });
  }

  function renderProposalList(proposals) {
    if (!proposals.length) return <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted-foreground)' }}>No proposals for this project yet.</div>;
    return proposals.map((p) => (
      <div key={p.id} className={'proposal-item' + (p.id === selectedProposalId ? ' active' : '')} onClick={() => selectProposal(p.id)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: p.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{p.avatar}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{p.workerName}</div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{`${'★'.repeat(Math.round(p.rating))} ${p.rating} (${p.reviewCount})`}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontWeight: 700, color: '#10b981', fontSize: 14 }}>{p.bidPrice}</div>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{p.timeline}</div>
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.coverLetter}</p>
      </div>
    ));
  }

  function renderProposalDetail(p) {
    if (!p) return <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted-foreground)' }}>Select a proposal to view details</div>;
    return (
      <>
        <div className="detail-section">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: p.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 16, fontWeight: 700 }}>{p.avatar}</div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{p.workerName}</h2>
                <div style={{ fontSize: 13, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span><Icon name="map-pin" style={{ width: 12, height: 12, display: 'inline', verticalAlign: 'middle' }} />{` ${p.location}`}</span>
                  <span><Icon name="clock" style={{ width: 12, height: 12, display: 'inline', verticalAlign: 'middle' }} />{` ${p.responseTime}`}</span>
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>{p.bidPrice}</div>
              <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{p.timeline}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
            <div style={{ padding: 12, borderRadius: 12, background: '#ecfdf5', textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: '#10b981' }}>{`${p.successRate}%`}</div>
              <div style={{ fontSize: 11, color: '#065f46' }}>Success Rate</div>
            </div>
            <div style={{ padding: 12, borderRadius: 12, background: '#eef2ff', textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: '#4f46e5' }}>{p.completedProjects}</div>
              <div style={{ fontSize: 11, color: '#3730a3' }}>Projects Done</div>
            </div>
            <div style={{ padding: 12, borderRadius: 12, background: '#fffbeb', textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: '#d97706' }}>{`${p.rating}★`}</div>
              <div style={{ fontSize: 11, color: '#92400e' }}>Rating</div>
            </div>
            <div style={{ padding: 12, borderRadius: 12, background: '#faf5ff', textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#7c3aed' }}>{p.hourlyRate}</div>
              <div style={{ fontSize: 11, color: '#5b21b6' }}>Hourly Rate</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn-primary" style={{ flex: 2, padding: 10, borderRadius: 12 }} onClick={() => openHireModal(p.id)}>
              <Icon name="check-circle" style={{ width: 15, height: 15, display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />{`Hire ${p.workerName.split(' ')[0]}`}
            </button>
            <button className="btn-outline" style={{ flex: 1, padding: 10, borderRadius: 12, color: '#ef4444', borderColor: '#fca5a5' }} title="Reject" onClick={() => rejectProposal(p.id)}>
              Reject
            </button>
          </div>
        </div>

        <div className="detail-section">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Cover Letter</h3>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7 }}>{p.coverLetter}</p>
        </div>

        <div className="detail-section">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Skills</h3>
          <div className="skills-list">{p.skills.map((s, i) => <span key={i} className="skill-tag" style={{ fontSize: 13, padding: '5px 12px' }}>{s}</span>)}</div>
        </div>
      </>
    );
  }

  const current = getProposals();
  const q = appliedQuery.toLowerCase();
  const listed = q ? current.filter((p) => (!q || p.workerName.toLowerCase().includes(q) || p.skills.some((s) => s.toLowerCase().includes(q)))) : current;
  const project = projects.find((p) => p.id === selectedProjectId);

  return (
    <DashboardLayout
      role="client"
      activePath="client-my-projects.html"
      pageTitle="Worker Applications"
      pageSubtitle="Review proposals and hire the best talent"
    >
      <div style={{ marginBottom: 16 }}>
        <A
          href="client-my-projects.html"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--muted-foreground)', transition: 'color 0.15s' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--foreground)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted-foreground)'; }}
        >
          <Icon name="arrow-left" style={{ width: 16, height: 16 }} /> Back to Projects
        </A>
      </div>

      {/* Project Switcher with Dropdown and Details */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ position: 'relative', background: 'linear-gradient(135deg,#eef2ff,#f0f4ff)', border: '1px solid #c7d2fe', borderRadius: 16, padding: '16px 20px', marginBottom: 16 }}>
          <div id="projectSelectDisplay" ref={displayRef} onClick={toggleMenu} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '8px 12px', background: 'rgba(255,255,255,0.6)', borderRadius: 12, border: '1px solid #ddd6fe' }}>
            <Icon name="briefcase" style={{ width: 20, height: 20, color: '#4f46e5', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }} id="projectSelectTitle">{project ? project.title : (projects[0]?.title || 'Select a project')}</div>
              <div style={{ fontSize: 12, color: '#6366f1' }} id="projectSelectProposals">{`${current.length} proposals`}</div>
            </div>
            <Icon name="chevron-down" style={{ width: 18, height: 18, color: '#6366f1', flexShrink: 0, transform: chevron.transform, transition: chevron.transition }} id="dropdownChevron" />
          </div>
          {/* Custom Dropdown Menu */}
          <div id="projectDropdownMenu" ref={menuRef} style={{ display: menuOpen ? 'block' : 'none', position: 'absolute', top: '100%', left: 16, right: 16, background: 'white', border: '1px solid #c7d2fe', borderRadius: 12, marginTop: 8, boxShadow: '0 8px 24px rgba(79,70,229,0.15)', zIndex: 100, overflow: 'hidden' }}>
            {projects.map((proj) => (
              <div
                key={`${menuGen}-${proj.id}`}
                onClick={() => switchProject(proj.id)}
                style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', transition: 'background 0.15s', display: 'flex', alignItems: 'center', gap: 12 }}
                onMouseOver={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <Icon name="briefcase" style={{ width: 16, height: 16, color: '#4f46e5', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{proj.title}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{`${proposalsFor(allProposals, proj.id).length} proposals`}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Project Details */}
        <div id="projectDetails" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
          {project ? (
            <>
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, fontFamily: sys, color: 'var(--foreground)' }}>{project.title}</h3>
                <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, fontFamily: sys }}>{project.description}</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                <div style={{ padding: 14, borderRadius: 12, background: 'linear-gradient(135deg,#f0fdf4,#ecfdf5)', border: '1px solid #a7f3d0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Icon name="dollar-sign" style={{ width: 16, height: 16, color: '#10b981', flexShrink: 0 }} />
                    <div style={{ fontSize: 11, color: '#065f46', fontWeight: 600, fontFamily: sys }}>Budget</div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#059669', fontFamily: sys }}>{project.budget}</div>
                </div>
                <div style={{ padding: 14, borderRadius: 12, background: 'linear-gradient(135deg,#eff6ff,#eef2ff)', border: '1px solid #bfdbfe' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Icon name="users" style={{ width: 16, height: 16, color: '#0ea5e9', flexShrink: 0 }} />
                    <div style={{ fontSize: 11, color: '#0c4a6e', fontWeight: 600, fontFamily: sys }}>Proposals</div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0284c7', fontFamily: sys }}>{current.length}</div>
                </div>
                <div style={{ padding: 14, borderRadius: 12, background: 'linear-gradient(135deg,#fffbeb,#fef3c7)', border: '1px solid #fde68a' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Icon name="calendar" style={{ width: 16, height: 16, color: '#f59e0b', flexShrink: 0 }} />
                    <div style={{ fontSize: 11, color: '#92400e', fontWeight: 600, fontFamily: sys }}>Deadline</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#d97706', fontFamily: sys }}>{project.deadline}</div>
                </div>
                <div style={{ padding: 14, borderRadius: 12, background: 'linear-gradient(135deg,#faf5ff,#f3e8ff)', border: '1px solid #ddd6fe' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Icon name="clock" style={{ width: 16, height: 16, color: '#a855f7', flexShrink: 0 }} />
                    <div style={{ fontSize: 11, color: '#6b21a8', fontWeight: 600, fontFamily: sys }}>Posted</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#9333ea', fontFamily: sys }}>{project.posted}</div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Main layout */}
      <div className="apps-layout">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }} id="proposalCount">{`${current.length} Proposals`}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 10, background: 'var(--input-bg)', flex: 1, maxWidth: 200, marginLeft: 12 }}>
              <Icon name="search" style={{ width: 14, height: 14, color: 'var(--muted-foreground)', flexShrink: 0 }} />
              <input type="text" placeholder="Search..." id="proposalSearch" style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, fontFamily: 'inherit', flex: 1 }} value={search} onChange={(e) => filterProposals(e.target.value)} />
            </div>
          </div>
          <div className="proposal-list" id="proposalList">{renderProposalList(listed)}</div>
        </div>

        <div className="proposal-detail" id="proposalDetail">
          {renderProposalDetail(allProposals.find((p) => p.id === selectedProposalId))}
        </div>
      </div>

      {/* Hire Modal */}
      <div className="hire-modal" id="hireModal" style={hireOpen ? { display: 'flex' } : (hire ? { display: 'none' } : undefined)}>
        <div style={{ background: 'white', borderRadius: 24, padding: 32, width: '100%', maxWidth: 440, margin: '0 16px', boxShadow: '0 32px 80px rgba(0,0,0,0.15)' }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Confirm Hire</h2>
          <p style={{ fontSize: 14, color: 'var(--muted-foreground)', marginBottom: 20 }}>You&apos;re about to hire <strong id="hireWorkerName">{hire?.workerName}</strong> for this project. This will lock the escrow funds.</p>
          <div style={{ padding: 16, borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
              <span style={{ color: '#374151' }}>Project budget (held in escrow)</span><span style={{ fontWeight: 700 }} id="hireBidAmount">{hire?.bid}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
              <span style={{ color: '#374151' }}>Marketplace fee (5%)</span><span style={{ fontWeight: 600, color: '#dc2626' }} id="hireFee">{hire?.fee}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
              <span style={{ color: '#374151' }}>Contract initiation fee</span><span style={{ fontWeight: 600, color: '#dc2626' }} id="hireInitiation">{hire?.initiation}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderTop: '1px solid #bbf7d0', paddingTop: 8, marginTop: 4 }}>
              <span style={{ fontWeight: 600 }}>Total charged to you</span><span style={{ fontWeight: 700, color: '#10b981' }} id="hireTotal">{hire?.total}</span>
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 8 }} id="hireBidNote">{hire?.note}</div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setHireOpen(false)} className="btn-outline" style={{ flex: 1, padding: 12, borderRadius: 12 }}>Cancel</button>
            <button onClick={confirmHire} className="btn-primary" style={{ flex: 2, padding: 12, borderRadius: 12 }}>Confirm &amp; Lock Escrow</button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
