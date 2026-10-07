import { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { go } from '../lib/nav';
import { useLucideRefresh } from '../lib/hooks';

// Merge open tasks from store
function getAllBrowseTasks() {
  const storeTasks = Store.getOpenTasks().map((t) => ({
    id: t.id,
    title: t.title,
    desc: t.description,
    budget: '$' + t.budget.toLocaleString(),
    type: 'Fixed',
    level: 'Intermediate',
    tags: t.skills || [],
    proposals: Store.getProposalsByTask(t.id).filter((p) => p.type !== 'invitation').length,
    deadline: t.deadline || 'TBD',
    badge: t.auditEnabled ? 'Audit' : 'New',
    badgeClass: t.auditEnabled ? 'badge-purple' : 'badge-green',
    category: t.category?.toLowerCase().replace(/[^a-z]/g, '') || 'web',
    fromStore: true,
  }));
  return storeTasks;
}

const SKILLS = ['React', 'Node.js', 'Python', 'UI Design', 'JavaScript', 'TypeScript', 'Vue.js', 'Figma', 'CSS', 'MongoDB', 'PostgreSQL', 'AWS'];

const inputStyle = { flex: 1, minWidth: 0, padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: 8, fontFamily: 'serif', fontSize: 14, color: '#4A5568' };
const labelStyle = { display: 'block', fontFamily: 'serif', fontSize: 15, marginBottom: 12, color: '#000' };

function renderTaskCards(list) {
  if (!list.length) return <p style={{ color: 'var(--muted-foreground)', padding: 32, textAlign: 'center' }}>No tasks found matching your criteria.</p>;
  return (
    <div className="task-grid">
      {list.map((t) => (
        <div key={t.id} className="task-card" onClick={() => go('task-details.html?id=' + t.id)}>
          <div className="task-card-header">
            <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--foreground)' }}>{t.title}</span>
            {t.badge ? <span className={`badge ${t.badgeClass}`}>{t.badge}</span> : null}
          </div>
          <p className="task-desc">{t.desc}</p>
          <div className="skills-list">
            {t.tags.slice(0, 3).map((tag, i) => <span key={i} className="skill-tag">{tag}</span>)}
            {t.tags.length > 3 ? <span className="skill-tag">{`+${t.tags.length - 3}`}</span> : null}
          </div>
          <div className="task-meta">
            <div className="task-meta-item"><Icon name="briefcase" style={{ width: 13, height: 13 }} />{t.type}</div>
            <div className="task-meta-item"><Icon name="bar-chart-2" style={{ width: 13, height: 13 }} />{t.level}</div>
            <div className="task-meta-item"><Icon name="users" style={{ width: 13, height: 13 }} />{`${t.proposals} proposals`}</div>
            <div className="task-meta-item"><Icon name="clock" style={{ width: 13, height: 13 }} />{`Due ${t.deadline}`}</div>
          </div>
          <div className="task-footer">
            <div className="task-budget">{`${t.budget} `}<span>/ project</span></div>
            <button className="btn-primary" style={{ fontSize: 13, padding: '6px 16px' }}>Apply Now</button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function BrowseTasks() {
  const [tasks] = useState(getAllBrowseTasks);
  // main.js initTaskFiltering ran before this content existed (its
  // DOMContentLoaded listener fired first), so the page's own live filtering
  // below is the only filter that ever applied.
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [lvl, setLvl] = useState('all');
  const [filtered, setFiltered] = useState(tasks);
  const refreshIcons = useLucideRefresh();

  // Live filtering
  const filterAndRender = (next) => {
    const s = { q, cat, lvl, ...next };
    const query = (s.q || '').toLowerCase();
    setFiltered(tasks.filter((t) => {
      const matchQ = !query || t.title.toLowerCase().includes(query) || t.desc.toLowerCase().includes(query) || t.tags.some((tag) => tag.toLowerCase().includes(query));
      const matchCat = s.cat === 'all' || t.category === s.cat;
      const matchLvl = s.lvl === 'all' || t.level.toLowerCase() === s.lvl;
      return matchQ && matchCat && matchLvl;
    }));
    refreshIcons();
  };

  const session = Auth.getCurrentUser();

  return (
    <DashboardLayout
      role={session?.role || 'worker'}
      activePath="browse-tasks.html"
      pageTitle="Browse Tasks"
      pageSubtitle="Find the perfect project that matches your skills"
    >
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 32, alignItems: 'start' }}>
        {/* Left Filter Sidebar */}
        <div style={{ background: 'white', border: '1px solid #E8EAFF', borderRadius: 16, padding: 28, position: 'sticky', top: 104 }}>
          <h3 style={{ fontFamily: 'serif', fontSize: 20, fontWeight: 500, marginBottom: 24, color: '#000' }}>Filters</h3>

          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Category</label>
            <select
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: 8, fontFamily: 'serif', fontSize: 14, color: '#000', background: 'white', appearance: 'none', backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'16\\' height=\\'16\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'black\\' stroke-width=\\'2\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><polyline points=\\'6 9 12 15 18 9\\'/></svg>')`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center' }}
              id="taskCategorySidebar"
              defaultValue="all"
              onChange={(e) => { setCat(e.target.value); filterAndRender({ cat: e.target.value }); }}
            >
              <option value="all">All Categories</option>
              <option value="web">Web Development</option>
              <option value="mobile">Mobile Development</option>
              <option value="backend">Backend / API</option>
              <option value="design">Design</option>
              <option value="ai">AI / ML</option>
              <option value="devops">DevOps</option>
            </select>
            {/* Hidden replica to keep original logic intact */}
            <input type="hidden" id="taskCategory" value={cat} />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Budget Range</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input type="text" placeholder="Min" style={inputStyle} />
              <span style={{ color: '#4A5568' }}>-</span>
              <input type="text" placeholder="Max" style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Required Skills</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SKILLS.map((skill) => (
                <button
                  key={skill}
                  style={{ padding: '6px 16px', background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 9999, fontFamily: 'serif', fontSize: 13, color: '#4A5568', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseOver={(e) => { e.currentTarget.style.background = '#E2E8F0'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = '#F1F5F9'; }}
                >
                  {skill}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 32, padding: '16px 20px', background: '#FAFAFB', border: '1px solid #EAEAEA', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name="file-check" style={{ width: 18, height: 18, color: '#7C3AED' }} />
              <span style={{ fontFamily: 'serif', fontSize: 14, color: '#000' }}>Technical Audit</span>
            </div>
            {/* Toggled imperatively, like the original inline onclick. The browser
                reports the background as rgb(), so the CBD5E1 check never matches:
                the track turns purple and stays purple while the thumb toggles. */}
            <div
              style={{ width: 44, height: 24, background: '#CBD5E1', borderRadius: 9999, position: 'relative', cursor: 'pointer', transition: 'background 0.3s' }}
              onClick={(e) => {
                const el = e.currentTarget;
                el.style.background = el.style.background.includes('CBD5E1') ? '#7C3AED' : '#CBD5E1';
                const thumb = el.children[0];
                thumb.style.transform = thumb.style.transform.includes('20px') ? 'translateX(0)' : 'translateX(20px)';
              }}
            >
              <div style={{ width: 18, height: 18, background: 'white', borderRadius: '50%', position: 'absolute', top: 3, left: 3, transition: 'transform 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div style={{ minWidth: 0 }}>
          {/* Top Search & Sort Bar */}
          <div className="filters-bar" style={{ borderRadius: 16, padding: '14px 20px' }}>
            <div className="search-field" style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 12 }}>
              <Icon name="search" style={{ width: 16, height: 16, flexShrink: 0 }} />
              <input
                type="text" placeholder="Search tasks..." id="taskSearch"
                style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', color: '#0f172a', fontSize: 14 }}
                value={q}
                onChange={(e) => { setQ(e.target.value); filterAndRender({ q: e.target.value }); }}
              />
            </div>
            <select
              className="filter-select" id="taskLevel"
              style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 10 }}
              value={lvl}
              onChange={(e) => { setLvl(e.target.value); filterAndRender({ lvl: e.target.value }); }}
            >
              <option value="all">All Levels</option>
              <option value="entry">Entry Level</option>
              <option value="intermediate">Intermediate</option>
              <option value="expert">Expert</option>
            </select>
            <div style={{ marginLeft: 'auto', fontSize: 14, color: 'var(--muted-foreground)' }}>
              <strong id="taskCount" style={{ color: '#0f172a' }}>{filtered.length}</strong> tasks found
            </div>
          </div>

          {/* Task Cards */}
          <div id="taskContainer">{renderTaskCards(filtered)}</div>
        </div>
      </div>
    </DashboardLayout>
  );
}
