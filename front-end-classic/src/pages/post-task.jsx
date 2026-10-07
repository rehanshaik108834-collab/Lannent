import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import ExpertPicker from '../components/ExpertPicker';
import { Store } from '../lib/store';
import { Auth } from '../lib/auth';
import { go } from '../lib/nav';
import { usePageStyle, useRerender } from '../lib/hooks';
import { Validate, useFieldErrors } from '../lib/validation';
import css from './post-task.css?inline';

const skillSuggestions = ['React','TypeScript','Node.js','Web Design','JavaScript','Vue.js','Angular','Python','Django','FastAPI','Express.js','MongoDB','PostgreSQL','MySQL','AWS','Google Cloud','Azure','Docker','Kubernetes','Jenkins','CI/CD','Figma','Sketch','Adobe XD','UI Design','UX Design','Responsive Design','CSS','HTML','SASS','Tailwind','Bootstrap','Flutter','Dart','Swift','Kotlin','Java','C#','PHP','Laravel','Symfony','Ruby','Rails','GraphQL','REST API','OAuth','JWT','Authentication','Database Design','System Design','Machine Learning','TensorFlow','PyTorch','NLP','Computer Vision','Data Analysis','Pandas','NumPy','Matplotlib','Tableau','Power BI','Analytics','Git','GitHub','GitLab','Bitbucket','SVN','Linux','Unix','Windows','MacOS','Bash','Shell','PowerShell','Python Scripting','Automation','Testing','Jest','Mocha','Pytest','Selenium','QA','Manual Testing','Load Testing','Performance Testing','Security','Penetration Testing','Cybersecurity','SSL/TLS','Encryption','OWASP','API Security','Web Security','SEO','SEM','PPC','Content Marketing','Email Marketing','Social Media','Facebook Ads','Google Ads','Analytics','Google Analytics','Mixpanel','Amplitude','Product Management','Agile','Scrum','Kanban','Project Management','JIRA','Asana','Monday.com','Notion','Slack','Communication','Leadership','Team Management','Training','Documentation','Technical Writing','Copywriting','Content Strategy','Brand Strategy','User Research','Usability Testing','A/B Testing','Conversion Rate Optimization','Customer Support','Customer Success','Sales','Negotiation','Contract Negotiation','Legal','Compliance','GDPR','HIPAA','SOC 2','ISO','Quality Assurance','Code Review','Refactoring','Optimization','Performance Tuning','Caching','CDN','Load Balancing','Microservices','Serverless','Lambda','Cloud Functions','Firebase','Supabase','Sanity','Contentful','Headless CMS','Static Site Generation','Next.js','Gatsby','Hugo','Jekyll','WordPress','Shopify','WooCommerce','Magento','BigCommerce','E-commerce','Payment Processing','Stripe','PayPal','Square','Blockchain','Crypto','Web3','Smart Contracts','Solidity','Ethereum','Bitcoin','NFT','Virtual Reality','Augmented Reality','3D Modeling','Blender','Unity','Unreal Engine','Game Development','Level Design','Game Art','Sound Design','Music Production','Video Production','Video Editing','Adobe Creative Suite','Premiere','After Effects','Lighting','Photography','Motion Graphics','Animation','2D Animation','3D Animation','Rigging','Modeling','Texturing','Rendering','Visualization','Data Visualization','Infographics','Illustration','Vector Art','Iconography','Logo Design','Branding','Package Design','Print Design','Layout Design','Typography','Color Theory','Design Systems','Component Libraries','Accessibility','WCAG','Inclusive Design','Mobile First','Progressive Web Apps','Service Workers','Offline Support','Caching Strategies','State Management','Redux','MobX','Vuex','Context API','Hooks','Composition API','Async/Await','Promises','Callbacks','Error Handling','Logging','Monitoring','Sentry','Datadog','New Relic','APM','Observability','Telemetry','Event Tracking','User Tracking','Privacy','Analytics Privacy','GDPR Compliance','Data Privacy','Security Audit','Vulnerability Assessment','Bug Bounty','Incident Response','Disaster Recovery','Backup Strategy','Data Recovery','Version Control','Branching Strategies','Code Owners','Pull Requests','Code Reviews','Pair Programming','Mob Programming','Test-Driven Development','Behavior-Driven Development','Acceptance Testing','Integration Testing','Unit Testing','End-to-End Testing','Contract Testing','Snapshot Testing','Visual Regression Testing','Performance Testing','Load Testing','Stress Testing','Chaos Engineering','Infrastructure as Code','Terraform','Ansible','Puppet','Chef','Containers','Docker Compose','Orchestration','Kubernetes','OpenShift','AWS ECS','Cloud Deployment','CI/CD Pipeline','GitHub Actions','GitLab CI','CircleCI','Travis CI','Jenkins','Monitoring','Alerting','Logging','Log Aggregation','ELK Stack','Splunk','Cloudwatch','Metrics','Prometheus','Grafana','Cost Optimization','Resource Management','Scaling','Horizontal Scaling','Vertical Scaling','Caching Strategies','Database Optimization','Query Optimization','Index Optimization','Sharding','Partitioning','Replication','Backup','Disaster Recovery','Business Continuity','Incident Management','Change Management','Release Management','Deployment Strategy','Blue-Green Deployment','Canary Deployment','Rolling Deployment','Feature Flags','A/B Testing'];

const EMPTY_MS = { title: '', description: '', budget: '', deadline: '' };

const PATH_CHECK_CIRCLE = 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z';
const PATH_SHIELD_CHECK = 'M9 12l2 2 4-4m7 0a9 9 0 11-18 0 9 9 0 0118 0z';
const PATH_DOLLAR = 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
const PATH_CALENDAR = 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z';
const PATH_EDIT = 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z';
const PATH_X = 'M6 18L18 6M6 6l12 12';
const PATH_PLUS = 'M12 4v16m8-8H4';

function Svg({ d, ...rest }) {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" {...rest}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={d} />
    </svg>
  );
}

export default function PostTask() {
  usePageStyle(css);
  const rerender = useRerender();
  const v = useFieldErrors();

  // The original's mutable form state, kept as-is; the parts of the page it
  // rebuilt only on demand (milestones, suggestions) render from snapshots.
  const fsRef = useRef(null);
  if (!fsRef.current) {
    fsRef.current = {
      taskTitle: '',
      category: 'Web Development',
      description: '',
      skills: [],
      skillInput: '',
      deadline: '',
      budget: 0,
      currency: 'INR',
      auditEnabled: false,
      auditFee: 300,
      auditExpertId: null,
      milestones: [],
      showMilestoneForm: false,
      newMilestone: { ...EMPTY_MS },
    };
  }
  const formState = fsRef.current;
  const editingRef = useRef(null); // editingMilestoneIndex

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [suggest, setSuggest] = useState({ active: false, items: [], gen: 0 });
  const [msErr, setMsErr] = useState({});

  /* ── calculateMilestoneTotal ── */
  const calculateMilestoneTotal = () => formState.milestones.reduce((sum, m) => sum + (parseFloat(m.budget) || 0), 0);

  /* ── validateMilestoneBudget – checks single milestone ── */
  const validateMilestoneBudget = (budgetVal) => {
    const totalBudget = parseFloat(formState.budget) || 0;
    if (budgetVal <= 0) return { valid: false, msg: 'Budget must be greater than 0' };
    if (totalBudget > 0 && budgetVal > totalBudget) return { valid: false, msg: 'Milestone budget cannot exceed total budget' };
    return { valid: true, msg: '' };
  };

  /* ── validateTotalMatch – checks sum == total ── */
  const validateTotalMatch = () => {
    const mc = calculateMilestoneTotal();
    const tb = parseFloat(formState.budget) || 0;
    if (tb <= 0) return { valid: false, status: 'no-budget', diff: 0 };
    if (mc > tb) return { valid: false, status: 'exceeded', diff: mc - tb };
    if (mc < tb) return { valid: false, status: 'under', diff: tb - mc };
    return { valid: true, status: 'matched', diff: 0 };
  };

  // renderMilestones(): the container was rebuilt from formState at call time.
  const snapshotMilestones = () => {
    const editing = editingRef.current;
    const remaining = (parseFloat(formState.budget) || 0) - calculateMilestoneTotal() + (editing !== null ? parseFloat(formState.milestones[editing]?.budget || 0) : 0);
    return {
      key: Date.now() + Math.random(),
      showForm: formState.showMilestoneForm,
      editing,
      remaining,
      currency: formState.currency,
      milestones: formState.milestones.map((m) => ({ ...m })),
      newMilestone: { ...formState.newMilestone },
    };
  };
  const [msView, setMsView] = useState(snapshotMilestones);
  const renderMilestones = () => { setMsErr({}); setMsView(snapshotMilestones()); };

  const renderSuggestions = () => {
    const filtered = skillSuggestions.filter((s) =>
      s.toLowerCase().includes(formState.skillInput.toLowerCase()) &&
      !formState.skills.includes(s),
    );
    // Every call rebuilt the list, so each item is a new element.
    if (formState.skillInput && filtered.length > 0) setSuggest((cur) => ({ active: true, items: filtered.slice(0, 8), gen: cur.gen + 1 }));
    else setSuggest((cur) => ({ ...cur, active: false }));
  };

  function handleAddSkill() {
    if (formState.skillInput.trim() && !formState.skills.includes(formState.skillInput)) {
      formState.skills.push(formState.skillInput);
      formState.skillInput = '';
      rerender();
      renderSuggestions();
    }
  }

  function handleSelectSkillSuggestion(skill) {
    if (!formState.skills.includes(skill)) {
      formState.skills.push(skill);
      formState.skillInput = '';
      rerender();
      renderSuggestions();
    }
  }

  function handleRemoveSkill(idx) {
    formState.skills.splice(idx, 1);
    rerender();
    renderSuggestions();
  }

  /* ── Helper: show/hide inline field errors ── */
  const showFieldMsg = (id, msg) => setMsErr((e) => ({ ...e, [id]: msg }));
  const hideFieldMsg = (id) => setMsErr((e) => {
    if (!(id in e)) return e;
    const next = { ...e };
    delete next[id];
    return next;
  });

  function handleAddMilestone() {
    const nm = formState.newMilestone;
    let valid = true;

    // Title
    if (!nm.title || nm.title.trim().length < 3) {
      showFieldMsg('msTitleErr', 'Title must be at least 3 characters');
      valid = false;
    } else hideFieldMsg('msTitleErr');

    // Description
    if (!nm.description || nm.description.trim().length < 3) {
      showFieldMsg('msDescErr', 'Description is required');
      valid = false;
    } else hideFieldMsg('msDescErr');

    // Budget
    const budgetVal = parseFloat(nm.budget);
    const bv = validateMilestoneBudget(budgetVal || 0);
    if (!nm.budget || !bv.valid) {
      showFieldMsg('msBudgetErr', bv.msg || 'Budget is required');
      valid = false;
    } else hideFieldMsg('msBudgetErr');

    // Deadline
    if (!nm.deadline) {
      showFieldMsg('msDeadlineErr', 'Deadline is required');
      valid = false;
    } else if (formState.deadline && nm.deadline > formState.deadline) {
      showFieldMsg('msDeadlineErr', `Must be on or before project deadline (${formState.deadline})`);
      valid = false;
    } else hideFieldMsg('msDeadlineErr');

    if (!valid) return;

    if (editingRef.current !== null) {
      formState.milestones[editingRef.current] = { ...nm };
      editingRef.current = null;
    } else {
      formState.milestones.push({ ...nm });
    }
    formState.newMilestone = { ...EMPTY_MS };
    formState.showMilestoneForm = false;
    renderMilestones();
    rerender();
  }

  function handleRemoveMilestone(idx) {
    formState.milestones.splice(idx, 1);
    renderMilestones();
    rerender();
  }

  function handleEditMilestone(idx) {
    editingRef.current = idx;
    formState.newMilestone = { ...formState.milestones[idx] };
    formState.showMilestoneForm = true;
    renderMilestones();
  }

  function getDaysUntilDeadline() {
    if (!formState.deadline) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(formState.deadline);
    deadline.setHours(0, 0, 0, 0);
    const diff = deadline - today;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  function toggleAudit() {
    formState.auditEnabled = !formState.auditEnabled;
    if (!formState.auditEnabled) formState.auditExpertId = null;
    rerender();
  }

  // The input also had onchange="...renderSuggestions()". It fires when the
  // input loses focus, i.e. on mousedown on a suggestion, and rebuilds the
  // list under the pointer, so that first click never selects the skill
  // (a second click does). Kept as it behaved.
  const skillInputRef = useRef(null);
  useEffect(() => {
    const el = skillInputRef.current;
    const onNativeChange = () => { flushSync(() => { formState.skillInput = el.value; renderSuggestions(); }); };
    el.addEventListener('change', onNativeChange);
    return () => el.removeEventListener('change', onNativeChange);
  });

  const onExpertChange = useCallback((id) => { fsRef.current.auditExpertId = id; rerender(); }, [rerender]);

  /* ── updatePublishState: enable/disable Publish button in real-time ── */
  const publishDisabled = (() => {
    const t = title.trim();
    const d = desc.trim();
    const budget = parseFloat(formState.budget) || 0;
    const { valid: budgetOk } = validateTotalMatch();
    // An audited project cannot be published without a named reviewer.
    const auditReady = !formState.auditEnabled || !!formState.auditExpertId;
    const ready = t.length >= 5 && d.length >= 5 && budget > 0 &&
                  formState.milestones.length > 0 && budgetOk && auditReady;
    return !ready;
  })();

  function validateTaskForm() {
    const t = title.trim();
    const d = desc.trim();
    const budget = formState.budget;

    let valid = true;

    if (!t) { v.showError('taskTitleInput', 'Task title is required.'); valid = false; }
    else if (t.length < 5) { v.showError('taskTitleInput', 'Title must be at least 5 characters.'); valid = false; }
    else v.clearError('taskTitleInput');

    if (!d || d.length < 5) {
      Validate.toast('Description is required.', 'error'); valid = false;
    }

    if (!budget || parseFloat(budget) <= 0) {
      Validate.toast('Please enter a valid budget greater than 0.', 'error'); valid = false;
    }

    if (formState.milestones.length === 0) {
      Validate.toast('Please add at least one milestone before publishing.', 'error'); valid = false;
    }

    // ── Strict budget match check ──
    const { valid: budgetMatched, status } = validateTotalMatch();
    if (formState.milestones.length > 0 && !budgetMatched) {
      if (status === 'exceeded') {
        Validate.toast('Total milestone budget exceeds total budget. Adjust milestones.', 'error');
      } else if (status === 'under') {
        Validate.toast('Total milestone budget must equal total budget. Allocate remaining funds.', 'error');
      }
      valid = false;
    }

    return valid;
  }

  function publishTask() {
    if (!validateTaskForm()) return;

    const session = Auth.getCurrentUser();
    const description = desc.trim() || formState.description;
    const clientId = session?.userId || 'u1';
    const budget = parseFloat(formState.budget);

    // Check wallet balance
    const user = Store.getUserById(clientId);
    if (!user) {
      Validate.toast('User not found. Please log in again.', 'error');
      return;
    }

    if (user.walletBalance < budget) {
      Validate.toast(`Insufficient balance! You have $${user.walletBalance.toLocaleString()} but need $${budget.toLocaleString()}.`, 'error');
      return;
    }

    // Create task
    const task = Store.createTask({
      title: formState.taskTitle,
      category: formState.category,
      description,
      skills: formState.skills,
      deadline: formState.deadline,
      budget,
      currency: formState.currency,
      auditEnabled: formState.auditEnabled,
      auditFee: formState.auditEnabled ? (formState.auditFee || undefined) : undefined,
      auditDomain: formState.auditEnabled ? formState.category : undefined,
      auditExpertId: formState.auditEnabled ? formState.auditExpertId : undefined,
      clientId,
      status: 'open',
    });

    // Create milestones
    formState.milestones.forEach((m) => {
      // workerId stays null: nobody is hired yet. Setting it to the client
      // made the milestone payable to the client, so approving a deliverable
      // released escrow back to them instead of to the hired worker. The
      // worker is backfilled onto these milestones when they are hired.
      Store.createMilestone({ taskId: task.id, title: m.title, description: m.description, budget: parseFloat(m.budget), deadline: m.deadline, workerId: null });
    });

    // No money moves here. Project escrow is funded when a worker is hired,
    // and the audit fee is funded once you and the reviewer agree a price.
    if (formState.auditEnabled) {
      Validate.toast('Project saved as a draft. It goes live once a reviewer accepts your audit.', 'success');
      setTimeout(() => { go('client-audit-offers.html'); }, 1400);
    } else {
      Validate.toast('Task published successfully.', 'success');
      setTimeout(() => { go('client-my-projects.html'); }, 1200);
    }
  }

  function saveDraft() {
    const t = title.trim();
    if (!t) { v.showError('taskTitleInput', 'Task title is required to save draft.'); return; }
    Validate.toast('Draft saved successfully.', 'info');
  }

  // ── Summary (updateSummary) ──
  const milestoneCost = calculateMilestoneTotal();
  const totalBudget = parseFloat(formState.budget || 0);
  const days = getDaysUntilDeadline();
  let auditSummary = 'Disabled';
  if (formState.auditEnabled) {
    const rev = formState.auditExpertId ? Store.getUserById(formState.auditExpertId) : null;
    auditSummary = rev
      ? `${rev.name.split(' ')[0]} · ${formState.currency} ${(formState.auditFee || 0).toLocaleString()}`
      : 'Select a reviewer';
  }

  // renderBudgetCheck
  let budgetCheck = null;
  if (!(totalBudget <= 0 && formState.milestones.length === 0)) {
    const { valid: matched, status, diff } = validateTotalMatch();
    const pct = totalBudget > 0 ? Math.min((milestoneCost / totalBudget) * 100, 100) : 0;
    const exceeded = status === 'exceeded';
    const barClass = matched ? 'ok' : exceeded ? 'over' : 'warn';
    const boxClass = matched ? 'ok' : exceeded ? 'exceeded' : 'warn';
    let icon;
    let message;
    if (matched) {
      icon = '✅'; message = 'Budget perfectly allocated across all milestones.';
    } else if (exceeded) {
      icon = '🔴'; message = `Total milestone budget exceeds total budget by ${formState.currency} ${diff.toLocaleString()}. Remove or reduce milestones.`;
    } else {
      icon = '⚠️'; message = `Total milestone budget must equal total budget. ${formState.currency} ${diff.toLocaleString()} remaining to allocate.`;
    }
    budgetCheck = (
      <div className={`budget-check ${boxClass}`}>
        <div className="budget-bar"><div className={`budget-bar-fill ${barClass}`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
        <div className="budget-check-item">
          <span>Milestone total:</span>
          <strong>{`${formState.currency} ${milestoneCost.toLocaleString()}`}</strong>
        </div>
        <div className="budget-check-item">
          <span>Project Budget:</span>
          <strong>{`${formState.currency} ${totalBudget.toLocaleString()}`}</strong>
        </div>
        <div className="budget-check-item budget-check-divider">
          <span>{matched ? '✓ Fully allocated' : exceeded ? '✗ Over budget' : 'Remaining'}</span>
          <strong>{`${formState.currency} ${Math.abs(diff).toLocaleString()}`}</strong>
        </div>
        <div className="budget-check-warning">
          <span style={{ flexShrink: 0 }}>{icon}</span>
          <p>{message}</p>
        </div>
      </div>
    );
  }

  // renderWalletCheck
  const session = Auth.getCurrentUser();
  const walletUser = Store.getUserById(session?.userId || 'u1');
  const walletBalance = walletUser?.walletBalance || 0;
  const isInsufficient = totalBudget > walletBalance;
  const wc = isInsufficient ? 'audit' : 'milestones';

  // renderMilestones
  let milestonesContent;
  if (!msView.showForm && msView.milestones.length === 0) {
    milestonesContent = (
      <div className="empty-state">
        <Svg d={PATH_CHECK_CIRCLE} />
        <p>No milestones added yet. Click below to add one.</p>
      </div>
    );
  } else {
    const { remaining, editing } = msView;
    const nm = msView.newMilestone;
    const onMsInput = (field, errId) => (e) => { formState.newMilestone[field] = e.target.value; hideFieldMsg(errId); };
    const errCls = (errId) => (msErr[errId] ? 'form-input has-error' : 'form-input');
    const errDiv = (errId) => <div className={msErr[errId] ? 'field-error show' : 'field-error'} id={errId}>{msErr[errId] || ''}</div>;
    milestonesContent = (
      <>
        {msView.showForm ? (
          <div className="milestone-form" key={msView.key}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              {`${editing !== null ? '✏️ Edit' : '➕ Add'} Milestone`}
              {remaining > 0 ? <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 400, color: 'var(--muted-foreground)' }}>Remaining: <strong style={{ color: '#16a34a' }}>{`${msView.currency} ${remaining.toLocaleString()}`}</strong></span> : null}
            </div>
            <div className="form-group">
              <label className="form-label">Milestone Title <span className="required">*</span></label>
              <input type="text" className={errCls('msTitleErr')} id="newMilestoneTitle" defaultValue={nm.title}
                onInput={onMsInput('title', 'msTitleErr')} placeholder="e.g. Design Phase" />
              {errDiv('msTitleErr')}
            </div>
            <div className="form-group">
              <label className="form-label">Description <span className="required">*</span></label>
              <textarea className={errCls('msDescErr')} id="newMilestoneDesc" rows="3"
                onInput={onMsInput('description', 'msDescErr')} placeholder="What's the deliverable?" defaultValue={nm.description} />
              {errDiv('msDescErr')}
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Budget <span className="required">*</span></label>
                <input type="number" className={errCls('msBudgetErr')} id="newMilestoneBudget" defaultValue={nm.budget || (remaining > 0 && msView.milestones.length > 0 ? remaining : '')}
                  onInput={onMsInput('budget', 'msBudgetErr')} placeholder={remaining > 0 ? String(remaining) : 'Amount'} min="1" />
                {errDiv('msBudgetErr')}
              </div>
              <div className="form-group">
                <label className="form-label">Deadline <span className="required">*</span></label>
                <input type="date" className={errCls('msDeadlineErr')} id="newMilestoneDeadline" defaultValue={nm.deadline}
                  onInput={onMsInput('deadline', 'msDeadlineErr')} />
                {errDiv('msDeadlineErr')}
              </div>
            </div>
            <div className="milestone-form-actions">
              <button className="save" type="button" onClick={handleAddMilestone}>{`${editing !== null ? 'Update' : 'Save'} Milestone`}</button>
              <button className="cancel" type="button" onClick={() => { formState.showMilestoneForm = false; editingRef.current = null; formState.newMilestone = { ...EMPTY_MS }; renderMilestones(); }}>Cancel</button>
            </div>
          </div>
        ) : null}
        {msView.milestones.map((m, idx) => (
          <div className="milestone-card" key={`${msView.key}-${idx}`}>
            <div className="milestone-content">
              <div className="milestone-title">
                <div className="milestone-index">{idx + 1}</div>
                <h3>{m.title}</h3>
              </div>
              <div className="milestone-desc">{m.description}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 32 }}>
                <div className="milestone-budget">
                  <Svg d={PATH_DOLLAR} />
                  {`${msView.currency} ${parseFloat(m.budget).toLocaleString()}`}
                </div>
                {m.deadline ? <span style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4 }}>{`📅 ${m.deadline}`}</span> : null}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="milestone-delete" type="button" title="Edit" onClick={() => handleEditMilestone(idx)}>
                <Svg d={PATH_EDIT} style={{ width: 14, height: 14 }} />
              </button>
              <button className="milestone-delete" type="button" title="Remove" onClick={() => handleRemoveMilestone(idx)}>
                <Svg d={PATH_X} />
              </button>
            </div>
          </div>
        ))}
      </>
    );
  }

  return (
    <DashboardLayout
      role="client"
      activePath="post-task.html"
      pageTitle="Post a Task"
      pageSubtitle="Create and publish a new freelance task"
    >
      <div className="post-container">
        <div>
          <div className="section-card">
            <h2>Basic Information</h2>
            <div className="form-group">
              <label className="form-label">Task Title <span className="required">*</span></label>
              <input
                type="text" className="form-input" id="taskTitleInput" placeholder="e.g. E-commerce Website Redesign"
                style={v.fieldStyle('taskTitleInput')}
                value={title}
                onChange={(e) => { setTitle(e.target.value); formState.taskTitle = e.target.value; v.clearError('taskTitleInput'); }}
              />
              {v.error('taskTitleInput')}
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" onChange={(e) => { formState.category = e.target.value; rerender(); }}>
                <option>Web Development</option>
                <option>Mobile Development</option>
                <option>Backend / API</option>
                <option>UI/UX Design</option>
                <option>AI / Machine Learning</option>
                <option>DevOps / Cloud</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Description <span className="required">*</span></label>
              <textarea
                className="form-textarea" rows="5" placeholder="Describe what you need done, goals, and requirements..."
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                onBlur={(e) => { formState.description = e.target.value; }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Deadline</label>
              <input type="date" className="form-input" onChange={(e) => { formState.deadline = e.target.value; rerender(); }} />
            </div>
            <div className="form-group">
              <label className="form-label">Required Skills</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text" className="form-input" id="skillInput" placeholder="Start typing to add skills..."
                  ref={skillInputRef}
                  onChange={(e) => { formState.skillInput = e.target.value; renderSuggestions(); }}
                  onKeyPress={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSkill(); } }}
                />
                <div className={'suggestion-dropdown' + (suggest.active ? ' active' : '')} id="skillSuggestions">
                  {suggest.items.map((s, i) => (
                    <div key={`${suggest.gen}-${i}`} className="suggestion-item" onClick={() => handleSelectSkillSuggestion(s)}>{s}</div>
                  ))}
                </div>
              </div>
              <div className="skills-container" id="skillsContainer">
                {formState.skills.map((skill, idx) => (
                  <div className="skill-tag" key={idx}>
                    <span>{skill}</span>
                    <button type="button" onClick={() => handleRemoveSkill(idx)}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="section-card budget-escrow">
            <h2>Budget &amp; Escrow</h2>
            <div className="grid-2" style={{ marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">Total Budget <span className="required">*</span></label>
                <div style={{ position: 'relative' }}>
                  <Icon name="dollar-sign" className="input-icon" />
                  <input type="number" className="form-input with-icon" defaultValue="" placeholder="5000" onChange={(e) => { formState.budget = e.target.value; rerender(); }} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Currency</label>
                <select className="form-select" defaultValue="INR" onChange={(e) => { formState.currency = e.target.value; rerender(); }}>
                  <option value="INR">INR (₹)</option>
                </select>
              </div>
            </div>
            <div className="audit-toggle">
              <div className="audit-info">
                <div className="audit-label">
                  <Svg d={PATH_SHIELD_CHECK} width="16" height="16" />
                  Technical Audit
                </div>
                <div className="audit-desc">Hire an Expert Reviewer to audit this project. Your project stays a draft until a reviewer accepts.</div>
              </div>
              <button className={'toggle-switch ' + (formState.auditEnabled ? 'on' : 'off')} type="button" onClick={toggleAudit}>
                <div className="toggle-switch-thumb" />
              </button>
            </div>
            <div id="auditPanel" style={{ display: formState.auditEnabled ? 'block' : 'none', marginTop: 16, padding: 18, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--secondary)' }}>
              <label className="form-label" htmlFor="auditFeeInput" style={{ display: 'block', marginBottom: 6 }}>Your opening offer for the audit</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontWeight: 700, color: 'var(--muted-foreground)' }}>$</span>
                <input
                  id="auditFeeInput" className="form-input" type="number" min="1" step="1"
                  style={{ maxWidth: 180 }} placeholder="300"
                  defaultValue={300}
                  onInput={(e) => { formState.auditFee = parseFloat(e.target.value) || 0; rerender(); }}
                />
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 14 }}>
                Reviewers can accept this or counter with their own price. Nothing is charged until you both agree.
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Choose your Expert Reviewer</div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 10 }}>
                {'Only reviewers who cover this category are shown. Your project stays a draft until they accept,\n                  and only they can see its audit.'}
              </div>
              <div id="auditExpertList">
                <ExpertPicker category={formState.category} selectedId={formState.auditExpertId} onChange={onExpertChange} />
              </div>
            </div>
          </div>

          <div className="section-card">
            <h2>Milestones</h2>
            <div id="milestonesContainer">{milestonesContent}</div>
            <button className="add-milestone-btn" type="button" onClick={() => { formState.showMilestoneForm = true; renderMilestones(); }}>
              <Svg d={PATH_PLUS} width="16" height="16" />
              Add Milestone
            </button>
          </div>

          <div className="action-buttons">
            <button type="button" className="save-draft" onClick={saveDraft}>Save Draft</button>
            <button type="button" className="publish" id="publishBtn" disabled={publishDisabled} onClick={publishTask}>Publish Task</button>
          </div>
        </div>

        <div className="post-sidebar">
          <div className="sidebar-card">
            <h3>Project Summary</h3>

            <div className="summary-item budget">
              <div className="summary-label budget">
                <Svg d={PATH_DOLLAR} width="16" height="16" />
                Budget
              </div>
              <div className="summary-value budget" id="summarySummaryBudget">{`${formState.currency} ${isNaN(totalBudget) ? 0 : totalBudget.toLocaleString()}`}</div>
            </div>

            <div className="summary-item milestones">
              <div className="summary-label milestones">
                <Svg d={PATH_CHECK_CIRCLE} width="16" height="16" />
                Milestones
              </div>
              <div className="summary-value milestones" id="summaryMilestones">{`${formState.milestones.length}`}</div>
            </div>

            <div className="summary-item deadline">
              <div className="summary-label deadline">
                <Svg d={PATH_CALENDAR} width="16" height="16" />
                Deadline
              </div>
              <div className="summary-value deadline" id="summaryDeadline">{formState.deadline ? `${days} day${days === 1 ? '' : 's'}` : 'Not set'}</div>
            </div>

            {/* The "enabled" classes were decided once, at first render (audit off). */}
            <div className="summary-item audit ">
              <div className="summary-label audit ">
                <Svg d={PATH_SHIELD_CHECK} width="16" height="16" />
                Audit
              </div>
              <div className="summary-value audit " id="summaryAudit">{auditSummary}</div>
            </div>

            <div id="budgetCheckContainer">{budgetCheck}</div>
            <div id="walletCheckSummary">
              <div className={`summary-item ${wc}`} style={{ marginTop: 12 }}>
                <div className={`summary-label ${wc}`}>
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={PATH_DOLLAR} />
                  </svg>
                  Wallet Balance
                </div>
                <div className={`summary-value ${wc}`} style={{ color: isInsufficient ? '#dc2626' : '#10b981', fontSize: 16 }}>{`${formState.currency} ${walletBalance.toLocaleString()}`}</div>
                {isInsufficient ? <div style={{ fontSize: 11, marginTop: 6, color: '#991b1b' }}>Insufficient balance. Add funds to proceed.</div> : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
