import { store, IS_DEMO } from './store.js?v=202610061436';
import { CHURCH_NAME, APP_NAME } from './config.js?v=202610061436';
import { REPORT_TYPES, REPORT_TYPE_MAP, ALL_REPORT_TYPE_KEYS, PILLARS, SOULS_MONTHLY_TARGET } from './templates.js?v=202610061436';
import { computeScorecards, attendanceByReport } from './scoring.js?v=202610061436';
import { esc, initials, fmtDate, lastWeekday, monthKey, monthRange, shiftMonth, monthLabel, pct, today, downloadFile, toCsv, parseDate } from './util.js?v=202610061436';

// ─── State ─────────────────────────────────────────────────────────────────

const S = {
  profile: null,
  departments: [],
  scope: null, // department id, or null = all departments (global admin only)
  month: monthKey(),
  editor: null,
};
const $content = () => document.getElementById('content');
const isGlobal = () => S.profile?.role === 'global_admin';
const dept = (id = S.scope) => S.departments.find((d) => d.id === id);
const savePref = (k, v) => { try { localStorage.setItem('coza-' + k, v ?? ''); } catch {} };
const loadPref = (k) => { try { return localStorage.getItem('coza-' + k) || null; } catch { return null; } };

// ─── Icons ─────────────────────────────────────────────────────────────────

const ICONS = {
  dashboard: '<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  reports: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  members: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  tasks: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  scorecard: '<circle cx="12" cy="8" r="6"/><path d="M15.5 13.5 17 22l-5-3-5 3 1.5-8.5"/>',
  admin: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24M1 1l22 22"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;

// ─── UI helpers ────────────────────────────────────────────────────────────

function toast(msg, err = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (err ? ' err' : '');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), err ? 4500 : 2200);
}
const fail = (e) => { console.error(e); toast(e.message || 'Something went wrong', true); };

function modal(title, body, { okLabel = 'Save', onOk, danger = false, wide = false } = {}) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}" ${wide ? 'style="width:min(720px,100%)"' : ''}>
    <div class="modal-h"><h2>${esc(title)}</h2><button data-close aria-label="Close">×</button></div>
    <div class="modal-b">${body}</div>
    <div class="modal-f"><button class="btn" data-close>Cancel</button>${onOk ? `<button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(okLabel)}</button>` : ''}</div>
  </div>`;
  const close = () => back.remove();
  back.addEventListener('click', async (e) => {
    if (e.target === back || e.target.closest('[data-close]')) close();
    if (e.target.closest('[data-ok]')) {
      const btn = e.target.closest('[data-ok]');
      btn.disabled = true;
      try {
        if ((await onOk(back)) !== false) close();
      } catch (err) {
        fail(err);
      } finally {
        btn.disabled = false;
      }
    }
  });
  document.body.appendChild(back);
  back.querySelector('input,select,textarea')?.focus();
  return back;
}
const confirmBox = (title, text, okLabel, onOk) => modal(title, `<p style="margin:0">${esc(text)}</p>`, { okLabel, onOk, danger: true });

const monthPicker = () => `<div class="month-picker no-print">
  <button data-action="month" data-n="-1" aria-label="Previous month">‹</button><span>${monthLabel(S.month)}</span>
  <button data-action="month" data-n="1" aria-label="Next month">›</button></div>`;

const person = (m, sub = '') => `<div class="person"><div class="avatar">${esc(initials(m.full_name))}</div><div><div class="n">${esc(m.full_name)}</div>${sub ? `<div class="small muted">${sub}</div>` : ''}</div></div>`;

const ring = (p, size = '') => `<div class="ring ${size}" style="--p:${p ?? 0};--c:${p == null ? 'var(--line)' : p >= 70 ? '#0f8a3c' : p >= 45 ? '#d38b00' : '#c62f3a'}"><b>${p == null ? '—' : p + '%'}</b></div>`;

const needDept = (what) => `<div class="card empty"><h3>Choose a department</h3><p>${what} work one department at a time. Pick one below or from the selector at the top.</p>
  <div class="row" style="justify-content:center;margin-top:12px">${S.departments.map((d) => `<button class="btn" data-action="scope" data-id="${d.id}">${esc(d.name)}</button>`).join('')}</div></div>`;

// ─── Boot & auth ───────────────────────────────────────────────────────────

async function boot() {
  try {
    S.profile = await store.getProfile();
  } catch (e) {
    fail(e);
  }
  if (!S.profile) return renderAuth();
  if (S.profile.role === 'pending') return renderPending();
  S.departments = await store.listDepartments();
  if (isGlobal()) {
    const pref = loadPref('scope');
    S.scope = S.departments.some((d) => d.id === pref) ? pref : null;
  } else {
    S.scope = S.profile.department_id;
    if (!dept()) return renderPending('Your account is approved but not linked to a department yet. Ask a global admin to assign one.');
  }
  renderShell();
  route();
}

function renderAuth(mode = 'signin', error = '') {
  document.getElementById('app').innerHTML = `<div class="auth">
    <div class="auth-art"><div class="brand"><img class="brand-logo lg" src="assets/coza-logo-light.png" alt="${esc(CHURCH_NAME)}"><div><div class="brand-name">${esc(APP_NAME)}</div><div class="brand-sub">Departmental reporting</div></div></div>
      <div><h1>Attendance, tasks and reports — in one place.</h1><p>For department heads and admins. Fill a service report in minutes and see how your team is doing each month.</p></div><div></div></div>
    <div class="auth-form"><form id="authForm">
      <h2>${mode === 'signup' ? 'Create an admin account' : mode === 'reset' ? 'Reset your password' : 'Sign in'}</h2>
      ${mode === 'signup' ? '<div class="field"><label for="fn">Full name</label><input class="input" id="fn" required autocomplete="name"></div>' : ''}
      <div class="field"><label for="em">Email</label><input class="input" id="em" type="email" required autocomplete="email"></div>
      ${mode !== 'reset' ? `<div class="field"><label for="pw">Password</label><div class="pw-wrap"><input class="input" id="pw" type="password" required minlength="8" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}"><button type="button" class="pw-eye" id="pwEye" aria-label="Show password" aria-pressed="false">${icon('eye')}</button></div></div>` : ''}
      ${error ? `<div class="err">${esc(error)}</div>` : ''}
      <button class="btn primary" type="submit">${mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'}</button>
      <div class="small muted">${
        mode === 'signin'
          ? `New department admin? <button type="button" class="linkish" data-mode="signup">Create an account</button> · <button type="button" class="linkish" data-mode="reset">Forgot password</button>`
          : `<button type="button" class="linkish" data-mode="signin">Back to sign in</button>`
      }</div>
      ${mode === 'signup' ? '<div class="small muted">Were you added as an admin? Use that same email and you\'ll go straight in. Otherwise a global admin will approve your account.</div>' : ''}
    </form></div></div>`;
  const form = document.getElementById('authForm');
  form.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => renderAuth(b.dataset.mode)));
  const eye = form.querySelector('#pwEye');
  if (eye)
    eye.onclick = () => {
      const pw = form.querySelector('#pw');
      const show = pw.type === 'password';
      pw.type = show ? 'text' : 'password';
      eye.innerHTML = icon(show ? 'eyeOff' : 'eye');
      eye.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      eye.setAttribute('aria-pressed', String(show));
      pw.focus();
    };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const email = form.querySelector('#em').value.trim();
    const pw = form.querySelector('#pw')?.value;
    try {
      if (mode === 'signin') await store.signIn(email, pw);
      else if (mode === 'signup') {
        const { needsConfirm } = await store.signUp(email, pw, form.querySelector('#fn').value.trim());
        if (needsConfirm) return renderAuth('signin', 'Check your email to confirm your account, then sign in.');
      } else {
        await store.resetPassword(email);
        return renderAuth('signin', 'If that email has an account, a reset link is on its way.');
      }
      boot();
    } catch (err) {
      renderAuth(mode, err.message);
    }
  };
}

function renderPending(msg = 'Thanks for signing up. A global admin needs to approve your account and assign your department before you can start reporting.') {
  document.getElementById('app').innerHTML = `${demoBar()}<div class="auth-form" style="min-height:80vh"><div class="card" style="max-width:440px;text-align:center">
    <h2>Waiting for approval</h2><p class="muted">${esc(msg)}</p>
    <div class="row" style="justify-content:center"><button class="btn" onclick="location.reload()">Check again</button><button class="btn ghost" id="so">Sign out</button></div></div></div>`;
  document.getElementById('so').onclick = signOut;
  wireDemoBar();
}

async function signOut() {
  await store.signOut();
  location.hash = '';
  location.reload();
}

function demoBar() {
  if (!IS_DEMO) return '';
  const opts = store.db.profiles.map((p) => `<option value="${p.id}" ${p.id === store.db.session ? 'selected' : ''}>${esc(p.full_name)}</option>`).join('');
  return `<div class="demo-bar no-print"><b>Demo mode</b> — sample data saved in this browser only. View as <select id="demoUser" aria-label="View as">${opts}</select><button id="demoReset">Reset sample data</button></div>`;
}
function wireDemoBar() {
  if (!IS_DEMO) return;
  document.getElementById('demoUser').onchange = (e) => {
    store.switchUser(e.target.value);
    location.hash = '#/dashboard';
    boot();
  };
  document.getElementById('demoReset').onclick = () => {
    store.reset();
    toast('Sample data reset');
    boot();
  };
}

// ─── Shell & routing ───────────────────────────────────────────────────────

const NAV = [
  ['dashboard', 'Dashboard', 'dashboard'],
  ['new', 'New report', 'plus'],
  ['reports', 'Reports', 'reports'],
  ['members', 'Members', 'members'],
  ['tasks', 'Tasks', 'tasks'],
  ['scorecards', 'Scorecards', 'scorecard'],
];

function renderShell() {
  const nav = [...NAV, ...(isGlobal() ? [['admin', 'Departments & admins', 'admin']] : [])];
  const roleLabel = isGlobal() ? 'Global admin' : `Dept admin · ${esc(dept(S.profile.department_id)?.name ?? '')}`;
  document.getElementById('app').innerHTML = `
  ${demoBar()}
  <div class="shell">
    <aside class="sidebar">
      <div class="brand"><img class="brand-logo" src="assets/coza-logo-light.png" alt="${esc(CHURCH_NAME)}"><div><div class="brand-name">${esc(APP_NAME)}</div><div class="brand-sub">Departmental reporting</div></div></div>
      <nav class="nav">${nav.map(([r, l, i], n) => `${n === 6 ? '<div class="nav-sep"></div>' : ''}<a href="#/${r}" data-route="${r}">${icon(i)}${l}</a>`).join('')}</nav>
      <div class="side-foot"><div class="who">${esc(S.profile.full_name || S.profile.email)}</div><div class="role">${roleLabel}</div><button id="signOut">Sign out</button></div>
    </aside>
    <div class="main">
      <header class="topbar no-print">
        <span class="mobile-brand"><img src="assets/coza-logo-dark.png" alt="">${esc(CHURCH_NAME)} Reports</span>
        <div class="spacer"></div>
        ${
          isGlobal()
            ? `<select class="input" id="scopeSel" style="width:auto" aria-label="Department"><option value="">All departments</option>${S.departments
                .map((d) => `<option value="${d.id}" ${d.id === S.scope ? 'selected' : ''}>${esc(d.name)}</option>`)
                .join('')}</select>`
            : `<span class="pill brand">${esc(dept()?.name)}</span>`
        }
        <button class="btn ghost sm mobile-only" id="signOut2">Sign out</button>
      </header>
      <main class="content" id="content"></main>
    </div>
  </div>
  <nav class="bottom-nav">${[...nav.slice(0, 5), ...(isGlobal() ? [['admin', 'Admins', 'admin']] : [])].map(([r, l, i]) => `<a href="#/${r}" data-route="${r}">${icon(i)}${l.split(' ')[0]}</a>`).join('')}</nav>`;
  wireDemoBar();
  document.getElementById('signOut').onclick = signOut;
  const sel = document.getElementById('scopeSel');
  if (sel) sel.onchange = () => setScope(sel.value || null);
  document.getElementById('signOut2').onclick = signOut;
  document.getElementById('content').addEventListener('click', onAction);
  document.getElementById('content').addEventListener('input', onInput);
  document.getElementById('content').addEventListener('change', onInput);
}

function setScope(id) {
  if (!isGlobal()) return;
  S.scope = id;
  savePref('scope', id);
  const sel = document.getElementById('scopeSel');
  if (sel) sel.value = id ?? '';
  route();
}

function route() {
  if (!S.profile) return;
  if (S.skipRoute) return void (S.skipRoute = false);
  if (S.editor?.dirty && location.hash !== S.lastHash && !confirm('You have unsaved changes in this report. Leave anyway?')) {
    S.skipRoute = true;
    location.hash = S.lastHash;
    return;
  }
  S.lastHash = location.hash;
  const [, name = 'dashboard', arg] = (location.hash || '#/dashboard').split('/');
  document.querySelectorAll('[data-route]').forEach((a) => a.classList.toggle('active', a.dataset.route === name || (name === 'report' && a.dataset.route === 'reports') || (name === 'scorecard' && a.dataset.route === 'scorecards')));
  if (name !== 'report') S.editor = null;
  const views = { dashboard: viewDashboard, new: viewNewReport, report: () => viewEditor(arg), reports: viewReports, members: viewMembers, tasks: viewTasks, scorecards: viewScorecards, scorecard: () => viewScorecard(arg), admin: viewAdmin };
  const v = views[name] ?? viewDashboard;
  $content().innerHTML = '<div class="empty">Loading…</div>';
  window.scrollTo(0, 0);
  Promise.resolve(v()).catch(fail);
}

// Global click actions (data-action) for the content area.
const ACTIONS = {};
function onAction(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const fn = ACTIONS[el.dataset.action];
  if (fn) {
    e.preventDefault();
    Promise.resolve(fn(el, e)).catch(fail);
  }
}
const INPUTS = {};
function onInput(e) {
  const fn = INPUTS[e.target.dataset.input];
  if (fn) fn(e.target, e);
}
ACTIONS.month = (el) => {
  S.month = shiftMonth(S.month, Number(el.dataset.n));
  route();
};
ACTIONS.scope = (el) => setScope(el.dataset.id);
ACTIONS.go = (el) => (location.hash = el.dataset.href);

// ─── Data helpers ──────────────────────────────────────────────────────────

async function monthData(deptId, month = S.month) {
  const { from, to } = monthRange(month);
  const [members, reports, tasks] = await Promise.all([
    store.listMembers(deptId),
    store.listReports({ deptId, from, to }),
    store.listTasks({ deptId, from, to }),
  ]);
  return { members, active: members.filter((m) => m.active), reports, tasks };
}

function attendanceSummary(reports, memberCount) {
  const rows = attendanceByReport(reports, memberCount);
  const t = { early: 0, late_perm: 0, late: 0, absent_perm: 0, absent: 0 };
  rows.forEach((r) => Object.keys(t).forEach((k) => (t[k] += r.counts[k] || 0)));
  const served = t.early + t.late_perm + t.late;
  return { rows, totals: t, served, attendanceRate: pct(served, served + t.absent), onTimeRate: pct(t.early, served) };
}

// ─── Dashboard ─────────────────────────────────────────────────────────────

const CAT_COLORS = { early: '#2a78d6', late_perm: '#86b6ef', late: '#eda100', absent_perm: '#a8a69e', absent: '#e34948' };
const CAT_LABELS = { early: 'Early', late_perm: 'Late (permission)', late: 'Late (no permission)', absent_perm: 'Absent (permission)', absent: 'Absent (no permission)' };
const charts = [];
function chart(canvasId, config) {
  const el = document.getElementById(canvasId);
  if (!el || !window.Chart) return;
  charts.push(new Chart(el, config));
}
function clearCharts() {
  while (charts.length) charts.pop().destroy();
}
const CHART_BASE = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { backgroundColor: '#17121c', padding: 10, cornerRadius: 8, titleFont: { weight: '700' } } },
};
const axis = (extra = {}) => ({ grid: { color: '#ece9f0', drawTicks: false }, border: { display: false }, ticks: { color: '#8a8492', font: { size: 11 }, padding: 6 }, ...extra });

async function viewDashboard() {
  clearCharts();
  if (!S.scope) return viewGlobalDashboard();
  const d = dept();
  const { active, reports, tasks } = await monthData(d.id);
  const att = attendanceSummary(reports, active.length);
  const cards = computeScorecards(active, reports, tasks);
  const taskTotal = tasks.reduce((n, t) => n + t.assignments.length, 0);
  const taskDone = tasks.reduce((n, t) => n + t.assignments.filter((a) => a.done).length, 0);
  const scored = cards.filter((c) => c.overall != null);
  const avgScore = scored.length ? Math.round(scored.reduce((n, c) => n + c.overall, 0) / scored.length) : null;

  const attention = [...cards]
    .map((c) => ({ c, weight: c.stats.absent * 2 + c.stats.late + c.stats.contravention * 2 }))
    .filter((x) => x.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6);
  const top = scored.sort((a, b) => b.overall - a.overall).slice(0, 6);

  $content().innerHTML = `
    <div class="page-head"><div><h1>${esc(d.name)}</h1><p>${monthLabel(S.month)} at a glance · ${active.length} active members</p></div>
      <div class="row">${monthPicker()}<a class="btn primary" href="#/new">${icon('plus')}New report</a></div></div>
    <div class="stats">
      <div class="stat"><div class="k">Reports filed</div><div class="v num">${reports.length}</div><div class="d">${reports.filter((r) => r.status === 'draft').length} still in draft</div></div>
      <div class="stat"><div class="k">Service attendance</div><div class="v num">${att.attendanceRate ?? '—'}${att.attendanceRate != null ? '%' : ''}</div><div class="d">present ÷ (present + unexcused absent)</div></div>
      <div class="stat"><div class="k">Arrived early</div><div class="v num">${att.onTimeRate ?? '—'}${att.onTimeRate != null ? '%' : ''}</div><div class="d">of those present</div></div>
      <div class="stat"><div class="k">Absent without permission</div><div class="v num">${att.totals.absent}</div><div class="d">${att.totals.late_perm + att.totals.late} late arrivals</div></div>
      <div class="stat"><div class="k">Tasks submitted</div><div class="v num">${taskTotal ? pct(taskDone, taskTotal) + '%' : '—'}</div><div class="d">${taskDone} of ${taskTotal} expected</div></div>
      <div class="stat"><div class="k">Average score</div><div class="v num">${avgScore ?? '—'}${avgScore != null ? '%' : ''}</div><div class="d">monthly scorecard</div></div>
    </div>
    ${
      !reports.length
        ? `<div class="card empty"><h3>No reports for ${monthLabel(S.month)} yet</h3><p>File the first one and this page fills in.</p><a class="btn primary" href="#/new">${icon('plus')}New report</a></div>`
        : `<div class="dash-grid">
      <div class="card wide"><div class="card-head"><div><h2>Attendance by service</h2><p>How each service went this month — members placed in each attendance category</p></div></div>
        <div class="chart-box"><canvas id="cAtt" aria-label="Attendance by service chart" role="img"></canvas></div>${catLegend()}</div>
      <div class="card wide"><div class="card-head"><div><h2>Attendance mix by service type</h2><p>Share of members in each category, all of this month's reports combined</p></div></div>
        <div class="chart-box short"><canvas id="cMix" aria-label="Attendance mix chart" role="img"></canvas></div>${catLegend()}</div>
      <div class="card"><div class="card-head"><div><h2>Needs attention</h2><p>Unexcused absences, lateness and contraventions</p></div></div>
        ${
          attention.length
            ? `<table><tbody>${attention
                .map(
                  ({ c }) => `<tr class="click" data-action="go" data-href="#/scorecard/${c.member.id}"><td>${person(c.member)}</td>
                  <td class="r">${c.stats.absent ? `<span class="pill bad">${c.stats.absent} absent</span>` : ''} ${c.stats.late ? `<span class="pill warn">${c.stats.late} late</span>` : ''} ${c.stats.contravention ? `<span class="pill bad">${c.stats.contravention} contravention</span>` : ''}</td></tr>`
                )
                .join('')}</tbody></table>`
            : '<div class="empty">Nobody flagged this month. 🎉</div>'
        }</div>
      <div class="card"><div class="card-head"><div><h2>Top scorecards</h2><p>Highest overall score this month</p></div><a class="btn sm" href="#/scorecards">All scorecards</a></div>
        ${top.length ? `<table><tbody>${top.map((c) => `<tr class="click" data-action="go" data-href="#/scorecard/${c.member.id}"><td>${person(c.member)}</td><td class="r">${ring(c.overall)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No scores yet.</div>'}</div>
      <div class="card wide"><div class="card-head"><div><h2>Member summary</h2><p>${monthLabel(S.month)} · click a name for the full scorecard</p></div><button class="btn sm" data-action="exportSummary">${icon('download')}CSV</button></div>
        ${memberSummaryTable(cards)}</div>
    </div>`
    }`;
  ACTIONS.exportSummary = () => exportSummary(cards, d.name);
  if (!reports.length) return;

  const rows = att.rows;
  chart('cAtt', {
    type: 'bar',
    data: {
      labels: rows.map((r) => [REPORT_TYPE_MAP[r.report.report_type].short, fmtDate(r.report.service_date, { day: 'numeric', month: 'short' })]),
      datasets: Object.keys(CAT_COLORS).map((k) => ({ label: CAT_LABELS[k], data: rows.map((r) => r.counts[k]), backgroundColor: CAT_COLORS[k], borderColor: '#fff', borderWidth: { top: 2 }, borderRadius: 3, maxBarThickness: 34 })),
    },
    options: { ...CHART_BASE, interaction: { mode: 'index', intersect: false }, scales: { x: axis({ stacked: true, grid: { display: false } }), y: axis({ stacked: true, beginAtZero: true, ticks: { precision: 0, color: '#8a8492' } }) } },
  });

  const types = REPORT_TYPES.filter((t) => t.group === 'service' && rows.some((r) => r.report.report_type === t.key));
  const mix = types.map((t) => {
    const c = { early: 0, late_perm: 0, late: 0, absent_perm: 0, absent: 0 };
    rows.filter((r) => r.report.report_type === t.key).forEach((r) => Object.keys(c).forEach((k) => (c[k] += r.counts[k])));
    const total = Object.values(c).reduce((a, b) => a + b, 0) || 1;
    return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Math.round((v / total) * 100)]));
  });
  chart('cMix', {
    type: 'bar',
    data: { labels: types.map((t) => t.short), datasets: Object.keys(CAT_COLORS).map((k) => ({ label: CAT_LABELS[k], data: mix.map((m) => m[k]), backgroundColor: CAT_COLORS[k], borderColor: '#fff', borderWidth: { right: 2 }, maxBarThickness: 26 })) },
    options: {
      ...CHART_BASE,
      indexAxis: 'y',
      interaction: { mode: 'index', intersect: false },
      plugins: { ...CHART_BASE.plugins, tooltip: { ...CHART_BASE.plugins.tooltip, callbacks: { label: (c) => ` ${c.dataset.label}: ${c.raw}%` } } },
      scales: { x: axis({ stacked: true, max: 100, ticks: { callback: (v) => v + '%', color: '#8a8492' } }), y: axis({ stacked: true, grid: { display: false } }) },
    },
  });
}

const catLegend = () => `<div class="legend">${Object.keys(CAT_COLORS).map((k) => `<span><i class="dot" style="background:${CAT_COLORS[k]}"></i>${CAT_LABELS[k]}</span>`).join('')}</div>`;

function memberSummaryTable(cards) {
  const sorted = [...cards].sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1));
  return `<div class="table-wrap"><table><thead><tr><th>Member</th><th class="r">Services</th><th class="r">Late</th><th class="r">Absent</th><th class="r">Excused</th><th class="r">Prayers</th><th class="r">Evangelism</th><th class="r">Souls</th><th class="r">Tasks</th><th>Score</th></tr></thead><tbody>
  ${sorted
    .map(
      (c) => `<tr class="click" data-action="go" data-href="#/scorecard/${c.member.id}"><td>${person(c.member)}</td>
      <td class="r num">${c.stats.served}</td><td class="r num">${c.stats.late}</td><td class="r num">${c.stats.absent}</td><td class="r num">${c.stats.excused}</td>
      <td class="r num">${c.stats.prayer}</td><td class="r num">${c.stats.evangelism}</td><td class="r num">${c.stats.souls}</td><td class="r num">${c.stats.tasks_done}/${c.stats.tasks_total}</td>
      <td><div class="bar-cell"><div class="mini-bar"><i style="width:${c.overall ?? 0}%"></i></div><span class="num small">${c.overall ?? '—'}${c.overall != null ? '%' : ''}</span></div></td></tr>`
    )
    .join('')}</tbody></table></div>`;
}

function exportSummary(cards, name) {
  const rows = [['Member', 'Services attended', 'Times late', 'Times absent (no permission)', 'Absent with permission', 'Prayers attended', 'Evangelism', 'Souls/guests', 'Contraventions', 'Tasks done', 'Tasks assigned', ...PILLARS.map((p) => `${p.label} (/${p.points})`), 'Overall %']];
  cards.forEach((c) =>
    rows.push([c.member.full_name, c.stats.served, c.stats.late, c.stats.absent, c.stats.excused, c.stats.prayer, c.stats.evangelism, c.stats.souls, c.stats.contravention, c.stats.tasks_done, c.stats.tasks_total, ...PILLARS.map((p) => c.pillars[p.key].points ?? ''), c.overall ?? ''])
  );
  downloadFile(`${name} - summary - ${S.month}.csv`, toCsv(rows));
}

async function viewGlobalDashboard() {
  const per = await Promise.all(
    S.departments.map(async (d) => {
      const data = await monthData(d.id);
      const att = attendanceSummary(data.reports, data.active.length);
      const cards = computeScorecards(data.active, data.reports, data.tasks).filter((c) => c.overall != null);
      return { d, ...data, att, avg: cards.length ? Math.round(cards.reduce((n, c) => n + c.overall, 0) / cards.length) : null };
    })
  );
  const totalMembers = per.reduce((n, p) => n + p.active.length, 0);
  const totalReports = per.reduce((n, p) => n + p.reports.length, 0);
  const served = per.reduce((n, p) => n + p.att.served, 0);
  const absent = per.reduce((n, p) => n + p.att.totals.absent, 0);
  $content().innerHTML = `
    <div class="page-head"><div><h1>All departments</h1><p>${monthLabel(S.month)} · ${S.departments.length} departments, ${totalMembers} active members</p></div>${monthPicker()}</div>
    <div class="stats">
      <div class="stat"><div class="k">Departments</div><div class="v num">${S.departments.length}</div></div>
      <div class="stat"><div class="k">Active members</div><div class="v num">${totalMembers}</div></div>
      <div class="stat"><div class="k">Reports filed</div><div class="v num">${totalReports}</div></div>
      <div class="stat"><div class="k">Service attendance</div><div class="v num">${pct(served, served + absent) ?? '—'}${served + absent ? '%' : ''}</div><div class="d">church-wide, this month</div></div>
    </div>
    <div class="dash-grid">
      <div class="card wide"><div class="card-head"><div><h2>Service attendance by department</h2><p>Present ÷ (present + absent without permission), ${monthLabel(S.month)}</p></div></div>
        <div class="chart-box short"><canvas id="cDept" role="img" aria-label="Attendance by department"></canvas></div></div>
      <div class="card wide"><div class="card-head"><div><h2>Departments</h2><p>Click a department to open its dashboard</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>Department</th><th class="r">Members</th><th class="r">Reports</th><th class="r">Drafts</th><th>Attendance</th><th class="r">Early</th><th class="r">Absent (no perm.)</th><th class="r">Avg score</th></tr></thead><tbody>
      ${per
        .map(
          (p) => `<tr class="click" data-action="scope" data-id="${p.d.id}"><td><b>${esc(p.d.name)}</b></td><td class="r num">${p.active.length}</td><td class="r num">${p.reports.length}</td>
          <td class="r num">${p.reports.filter((r) => r.status === 'draft').length}</td>
          <td><div class="bar-cell"><div class="mini-bar"><i style="width:${p.att.attendanceRate ?? 0}%"></i></div><span class="num small">${p.att.attendanceRate ?? '—'}${p.att.attendanceRate != null ? '%' : ''}</span></div></td>
          <td class="r num">${p.att.onTimeRate ?? '—'}${p.att.onTimeRate != null ? '%' : ''}</td><td class="r num">${p.att.totals.absent}</td><td class="r">${ring(p.avg)}</td></tr>`
        )
        .join('')}</tbody></table></div></div>
    </div>`;
  chart('cDept', {
    type: 'bar',
    data: { labels: per.map((p) => p.d.name), datasets: [{ label: 'Attendance', data: per.map((p) => p.att.attendanceRate ?? 0), backgroundColor: '#521a7a', borderRadius: 4, maxBarThickness: 26 }] },
    options: {
      ...CHART_BASE,
      indexAxis: 'y',
      plugins: { ...CHART_BASE.plugins, tooltip: { ...CHART_BASE.plugins.tooltip, callbacks: { label: (c) => ` Attendance: ${c.raw}%` } } },
      scales: { x: axis({ min: 0, max: 100, ticks: { callback: (v) => v + '%', color: '#8a8492' } }), y: axis({ grid: { display: false } }) },
    },
  });
}

// ─── New report: pick a type and date ──────────────────────────────────────

let pickedType = null;
async function viewNewReport() {
  if (!S.scope) return ($content().innerHTML = needDept('Reports'));
  const d = dept();
  const types = REPORT_TYPES.filter((t) => (d.report_types ?? ALL_REPORT_TYPE_KEYS).includes(t.key));
  if (!types.some((t) => t.key === pickedType)) pickedType = types[0]?.key;
  const t = REPORT_TYPE_MAP[pickedType];
  $content().innerHTML = `
    <div class="page-head"><div><h1>New report</h1><p>${esc(d.name)} · choose the report and the date</p></div></div>
    <div class="type-grid">${types
      .map(
        (x) => `<button class="type-card ${x.key === pickedType ? 'on' : ''}" data-action="pickType" data-key="${x.key}"><span class="t">${esc(x.name)}</span>
        <span class="s">${x.sections.length} sections${x.weekday != null ? ' · ' + ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'][x.weekday] : ''}</span></button>`
      )
      .join('')}</div>
    <div class="card" style="margin-top:16px"><div class="editor-head">
      <div class="field"><label for="rDate">Date</label><input class="input" type="date" id="rDate" value="${lastWeekday(t?.weekday)}" max="${today()}"></div>
      <button class="btn primary" data-action="startReport">Start ${esc(t?.name ?? '')} report →</button></div>
      <p class="small muted" style="margin:10px 0 0">If a report already exists for that date it opens for editing — no duplicates.</p></div>`;
}
ACTIONS.pickType = (el) => {
  pickedType = el.dataset.key;
  viewNewReport();
};
ACTIONS.startReport = async () => {
  const date = document.getElementById('rDate').value;
  if (!date) return toast('Pick a date', true);
  const existing = await store.findReport(S.scope, pickedType, date);
  if (existing) {
    toast('Opening the existing report for that date');
    location.hash = `#/report/${existing.id}`;
  } else location.hash = `#/report/new~${pickedType}~${date}`;
};

// ─── Report editor ─────────────────────────────────────────────────────────

async function viewEditor(arg) {
  let report;
  const editing = arg?.startsWith('edit~');
  if (editing) arg = arg.slice(5);
  if (arg?.startsWith('new~')) {
    const [, type, date] = arg.split('~');
    if (!S.scope) return ($content().innerHTML = needDept('Reports'));
    report = { id: null, department_id: S.scope, report_type: type, service_date: date, notes: {}, status: 'draft', entries: [] };
  } else {
    report = await store.getReport(arg);
    if (!report) return ($content().innerHTML = '<div class="card empty"><h3>Report not found</h3></div>');
  }
  const type = REPORT_TYPE_MAP[report.report_type];
  const allMembers = await store.listMembers(report.department_id);
  const used = new Set(report.entries.map((e) => e.member_id));
  const members = allMembers.filter((m) => m.active || used.has(m.id));

  if (report.id && report.status === 'submitted' && !editing) return viewReportDoc(report, type, allMembers);

  const ed = (S.editor = { report, type, members, byId: new Map(members.map((m) => [m.id, m])), assign: {}, counts: {}, notes: { ...report.notes }, active: {}, search: {}, open: {}, dirty: false });
  for (const s of type.sections) {
    if (s.kind === 'assign') {
      ed.assign[s.key] = new Map();
      ed.active[s.key] = s.categories[0].key;
      ed.search[s.key] = '';
    }
    if (s.kind === 'counts') ed.counts[s.key] = new Map();
  }
  for (const e of report.entries) {
    if (ed.assign[e.section]) ed.assign[e.section].set(e.member_id, { category: e.category, remark: e.remark ?? '' });
    if (ed.counts[e.section]) ed.counts[e.section].set(e.member_id, Number(e.value) || 0);
  }

  const d = dept(report.department_id);
  const submitted = report.status === 'submitted';
  $content().innerHTML = `
    <div class="page-head"><div><h1>${submitted ? 'Editing: ' : ''}${esc(type.name)}</h1><p>${esc(d?.name ?? '')} · ${fmtDate(report.service_date)} ${submitted ? '<span class="pill good">Submitted</span>' : report.id ? '<span class="pill warn">Draft</span>' : '<span class="pill">New</span>'}</p></div></div>
    <p class="muted small" style="margin-top:-8px">Tap a category, then tap names to drop them in. A name can only be in one category per section — once placed it leaves the list. Tap × to move someone back.</p>
    ${members.length ? '' : `<div class="card empty"><h3>No members yet</h3><p>Add your department's members first.</p><a class="btn primary" href="#/members">Add members</a></div>`}
    <div id="sections">${type.sections.map((s, i) => `<div class="section" id="sec-${s.key}">${sectionHtml(s, i)}</div>`).join('')}</div>
    <div class="save-bar">
      <div class="progress" id="progress">${progressHtml()}</div><div class="spacer"></div>
      ${
        submitted
          ? `<a class="btn ghost" href="#/report/${report.id}">Cancel</a><button class="btn ghost danger" data-action="deleteReport">Delete</button>
             <button class="btn primary" data-action="saveReport" data-status="submitted">Save changes</button>`
          : `${report.id ? `<button class="btn ghost danger" data-action="deleteReport">Delete</button>` : ''}
             <button class="btn" data-action="saveReport" data-status="draft">Save draft</button>
             <button class="btn primary" data-action="saveReport" data-status="submitted">Submit report</button>`
      }
    </div>`;
}

function progressHtml() {
  const ed = S.editor;
  const att = ed.type.sections.find((s) => s.kind === 'assign' && !s.optional);
  if (!att) return '';
  const n = ed.assign[att.key].size;
  return `<div class="mini-bar"><i style="width:${pct(n, ed.members.length) ?? 0}%"></i></div><span><b>${n}</b> of ${ed.members.length} accounted for in ${esc(att.title.toLowerCase())}</span>`;
}

function sectionHtml(s, i) {
  const ed = S.editor;
  const head = `<div class="section-head"><h3><span class="sn">${i + 1}</span>${esc(s.title)}</h3>${s.kind === 'assign' ? `<span class="small muted">${ed.assign[s.key].size}/${ed.members.length}</span>` : ''}</div>`;
  if (s.kind === 'text')
    return `${head}<div class="section-body"><textarea class="input" data-input="note" data-sec="${s.key}" placeholder="${esc(s.placeholder)}" aria-label="${esc(s.title)}">${esc(ed.notes[s.key] ?? '')}</textarea></div>`;
  if (s.kind === 'counts') {
    const map = ed.counts[s.key];
    const total = [...map.values()].reduce((a, b) => a + b, 0);
    return `${head}<div class="section-body"><div class="pool-head"><span class="hint">Total: <b>${total}</b> ${esc(s.unit)}</span></div><div class="counts">${ed.members
      .map((m) => {
        const v = map.get(m.id) ?? 0;
        return `<div class="count-row ${v ? 'has' : ''}"><span>${esc(m.full_name)}</span><span class="stepper"><button data-action="count" data-sec="${s.key}" data-id="${m.id}" data-n="-1" aria-label="Less">−</button><span class="num">${v}</span><button data-action="count" data-sec="${s.key}" data-id="${m.id}" data-n="1" aria-label="More">+</button></span></div>`;
      })
      .join('')}</div></div>`;
  }
  // assign
  const map = ed.assign[s.key];
  const activeCat = s.categories.find((c) => c.key === ed.active[s.key]);
  const q = ed.search[s.key].toLowerCase();
  const pool = ed.members.filter((m) => !map.has(m.id));
  const shown = pool.filter((m) => !q || m.full_name.toLowerCase().includes(q));
  const count = (k) => [...map.values()].filter((v) => v.category === k).length;
  const fillRest = s.fillRest && s.categories.find((c) => c.key === s.fillRest);
  if (s.optional && !ed.open[s.key]) {
    const list = [...map.entries()];
    return `${head}<div class="section-body">
      ${
        list.length
          ? `<ol class="plain-list">${list.map(([id, v]) => `<li>${esc(ed.byId.get(id)?.full_name ?? '?')}${v.remark ? ` <span class="muted">— ${esc(v.remark)}</span>` : ''}</li>`).join('')}</ol>`
          : `<p class="small muted" style="margin:0 0 10px">Nothing recorded — the report will say “${esc(s.emptyText)}”.</p>`
      }
      <button class="btn sm" data-action="openPool" data-sec="${s.key}">${icon('plus')}${list.length ? 'Add or change names' : 'Add a name'}</button></div>`;
  }
  return `${head}<div class="section-body">
    ${s.categories.length > 1 ? `<div class="cat-tabs" role="tablist">${s.categories.map((c) => `<button class="cat-tab ${c.key === activeCat.key ? 'on' : ''}" style="--tone:var(--t-${c.tone})" data-action="cat" data-sec="${s.key}" data-cat="${c.key}" role="tab" aria-selected="${c.key === activeCat.key}"><span class="dot" style="background:var(--t-${c.tone})"></span>${esc(c.label)}<span class="c num">${count(c.key)}</span></button>`).join('')}</div>` : ''}
    <div class="pool-head"><span class="hint">${pool.length ? `Tap to add to <b>${esc(activeCat.label)}</b> · ${pool.length} not yet placed` : ''}</span>
      <span class="row">${fillRest && pool.length ? `<button class="btn sm" data-action="fillRest" data-sec="${s.key}">Put remaining ${pool.length} in “${esc(fillRest.label)}”</button>` : ''}${pool.length > 8 ? `<input class="search-mini" placeholder="Search names" data-input="search" data-sec="${s.key}" value="${esc(ed.search[s.key])}" aria-label="Search names">` : ''}</span></div>
    <div class="pool">${pool.length ? shown.map((m) => `<button class="chip" data-action="assign" data-sec="${s.key}" data-id="${m.id}">${esc(m.full_name)}</button>`).join('') || '<span class="muted small">No match</span>' : `<span class="done">✓ Everyone is placed${s.optional ? '' : ''}</span>`}${!pool.length ? '' : ''}</div>
    ${s.optional ? `<p class="small muted" style="margin:10px 0 0">${map.size ? '' : `Leave empty if none — the report will say “${esc(s.emptyText)}”. `}<button class="linkish" data-action="closePool" data-sec="${s.key}">Done</button></p>` : ''}
    <div class="assigned">${s.categories
      .map((c) => {
        const list = [...map.entries()].filter(([, v]) => v.category === c.key);
        return `<div class="bucket" style="--tone:var(--t-${c.tone})"><div class="bucket-h"><span>${esc(c.label)}</span><span class="c num">${list.length}</span></div>
        ${list.length ? `<ol>${list.map(([id, v]) => `<li><div class="line"><span>${esc(ed.byId.get(id)?.full_name ?? '?')}</span><button data-action="unassign" data-sec="${s.key}" data-id="${id}" aria-label="Remove ${esc(ed.byId.get(id)?.full_name)}">×</button></div>${c.remarks ? `<input class="remark" placeholder="Remark (optional)" data-input="remark" data-sec="${s.key}" data-id="${id}" value="${esc(v.remark)}">` : ''}</li>`).join('')}</ol>` : '<div class="none">None</div>'}</div>`;
      })
      .join('')}</div></div>`;
}

function rerender(secKey, focusSearch = false) {
  const ed = S.editor;
  const i = ed.type.sections.findIndex((s) => s.key === secKey);
  const el = document.getElementById('sec-' + secKey);
  el.innerHTML = sectionHtml(ed.type.sections[i], i);
  document.getElementById('progress').innerHTML = progressHtml();
  if (focusSearch) {
    const inp = el.querySelector('.search-mini');
    if (inp) {
      inp.focus();
      inp.setSelectionRange(inp.value.length, inp.value.length);
    }
  }
}
const markDirty = () => (S.editor.dirty = true);

ACTIONS.openPool = (el) => {
  S.editor.open[el.dataset.sec] = true;
  rerender(el.dataset.sec);
};
ACTIONS.closePool = (el) => {
  S.editor.open[el.dataset.sec] = false;
  rerender(el.dataset.sec);
};
ACTIONS.cat = (el) => {
  S.editor.active[el.dataset.sec] = el.dataset.cat;
  rerender(el.dataset.sec);
};
ACTIONS.assign = (el) => {
  const { sec, id } = el.dataset;
  S.editor.assign[sec].set(id, { category: S.editor.active[sec], remark: '' });
  markDirty();
  rerender(sec, !!S.editor.search[sec]);
};
ACTIONS.unassign = (el) => {
  S.editor.assign[el.dataset.sec].delete(el.dataset.id);
  markDirty();
  rerender(el.dataset.sec);
};
ACTIONS.fillRest = (el) => {
  const ed = S.editor;
  const s = ed.type.sections.find((x) => x.key === el.dataset.sec);
  ed.members.forEach((m) => !ed.assign[s.key].has(m.id) && ed.assign[s.key].set(m.id, { category: s.fillRest, remark: '' }));
  markDirty();
  rerender(s.key);
};
ACTIONS.count = (el) => {
  const map = S.editor.counts[el.dataset.sec];
  const v = Math.max(0, (map.get(el.dataset.id) ?? 0) + Number(el.dataset.n));
  v ? map.set(el.dataset.id, v) : map.delete(el.dataset.id);
  markDirty();
  rerender(el.dataset.sec);
};
INPUTS.note = (el) => {
  S.editor.notes[el.dataset.sec] = el.value;
  markDirty();
};
INPUTS.remark = (el) => {
  const v = S.editor.assign[el.dataset.sec].get(el.dataset.id);
  if (v) v.remark = el.value;
  markDirty();
};
INPUTS.search = (el, e) => {
  if (e.type !== 'input') return;
  S.editor.search[el.dataset.sec] = el.value;
  rerender(el.dataset.sec, true);
};

function editorEntries() {
  const ed = S.editor;
  const out = [];
  for (const [section, map] of Object.entries(ed.assign)) for (const [member_id, v] of map) out.push({ member_id, section, category: v.category, value: null, remark: v.remark?.trim() || null });
  for (const [section, map] of Object.entries(ed.counts)) for (const [member_id, value] of map) out.push({ member_id, section, category: null, value, remark: null });
  return out;
}

ACTIONS.saveReport = async (el) => {
  const ed = S.editor;
  const status = el.dataset.status;
  if (status === 'submitted') {
    const main = ed.type.sections.find((s) => s.kind === 'assign' && !s.optional);
    const missing = main ? ed.members.length - ed.assign[main.key].size : 0;
    if (missing > 0 && !confirm(`${missing} member(s) haven't been placed in “${main.title}”. Submit anyway?`)) return;
  }
  const notes = Object.fromEntries(Object.entries(ed.notes).filter(([, v]) => v?.trim()));
  el.disabled = true;
  try {
    const id = await store.saveReport({ id: ed.report.id, department_id: ed.report.department_id, report_type: ed.report.report_type, service_date: ed.report.service_date, notes, status }, editorEntries());
    ed.dirty = false;
    toast(status === 'submitted' ? (ed.report.status === 'submitted' ? 'Changes saved' : 'Report submitted') : 'Draft saved');
    S.editor = null;
    if (status === 'submitted' || !ed.report.id) location.hash = `#/report/${id}`;
    else viewEditor(id);
  } finally {
    el.disabled = false;
  }
};
ACTIONS.deleteReport = () =>
  confirmBox('Delete this report?', 'This removes the report and everything recorded in it.', 'Delete', async () => {
    await store.deleteReport(S.editor?.report.id ?? S.doc.report.id);
    S.editor = null;
    toast('Report deleted');
    location.hash = '#/reports';
  });
// ─── Finished report: one model feeds the screen view, PDF and WhatsApp text ─

// Structured, display-ready version of a report (only what was recorded).
function reportModel(report, type, byId, entries = report.entries, notes = report.notes ?? {}) {
  const d = dept(report.department_id);
  const nameOf = (id) => byId.get(id)?.full_name ?? 'Removed member';
  const sections = type.sections.map((s, i) => {
    const list = entries.filter((e) => e.section === s.key);
    const sec = { n: i + 1, title: s.title, blocks: [] };
    if (s.kind === 'text') sec.text = (notes[s.key] || '').trim() || s.placeholder;
    else if (s.kind === 'counts') {
      sec.blocks.push({ items: list.map((e) => ({ name: nameOf(e.member_id), extra: String(e.value) })), empty: s.emptyText });
      if (list.length) sec.total = `Total: ${list.reduce((a, e) => a + Number(e.value), 0)} ${s.unit}`;
    } else if (s.categories.length === 1) sec.blocks.push({ items: list.map((e) => ({ name: nameOf(e.member_id), extra: e.remark })), empty: s.emptyText ?? 'NONE' });
    else
      s.categories.forEach((c, ci) =>
        sec.blocks.push({ label: `${'ABCDEFGHIJ'[ci]}. ${c.label}`, tone: c.tone, items: list.filter((e) => e.category === c.key).map((e) => ({ name: nameOf(e.member_id), extra: e.remark })), empty: 'NONE' })
      );
    return sec;
  });
  return {
    title: `${CHURCH_NAME} ${(d?.name ?? '').toUpperCase()} - ${type.heading}`,
    sub: type.subheading,
    service: type.service,
    date: fmtDate(report.service_date, { day: '2-digit', month: '2-digit', year: 'numeric' }),
    longDate: fmtDate(report.service_date),
    dept: d?.name ?? '',
    typeName: type.name,
    sections,
  };
}

// WhatsApp-ready text in the Excel template's layout.
function reportText(m) {
  const L = [`*${m.title}*`];
  if (m.sub) L.push(m.sub);
  if (m.service) L.push(`SERVICE: ${m.service}`);
  L.push(`DATE: ${m.date}`, '');
  for (const s of m.sections) {
    L.push(`*${s.n}. ${s.title.toUpperCase()}*`);
    if (s.text != null) L.push(s.text.toUpperCase());
    for (const b of s.blocks) {
      if (b.label) L.push(b.label.toUpperCase());
      if (!b.items.length) L.push(b.empty);
      b.items.forEach((it, n) => L.push(`${n + 1}. ${it.name.toUpperCase()}${it.extra ? ' - ' + it.extra.toUpperCase() : ''}`));
    }
    if (s.total) L.push(s.total.toUpperCase());
    L.push('');
  }
  L.push('*END OF REPORT*');
  return L.join('\n');
}

function reportDocHtml(m) {
  return `<article class="doc">
    <header class="doc-head"><img src="assets/coza-logo-dark.png" alt="${esc(CHURCH_NAME)}"><div><h2>${esc(m.title)}</h2>
      ${m.sub ? `<div class="doc-meta">${esc(m.sub)}</div>` : ''}<div class="doc-meta">${m.service ? `Service: <b>${esc(m.service)}</b> · ` : ''}Date: <b>${esc(m.longDate)}</b></div></div></header>
    ${m.sections
      .map(
        (s) => `<section class="doc-sec"><h3><span class="sn">${s.n}</span>${esc(s.title)}</h3>
        ${s.text != null ? `<p class="doc-text">${esc(s.text)}</p>` : ''}
        ${s.blocks
          .map(
            (b) => `<div class="doc-block">${b.label ? `<div class="doc-label">${b.tone ? `<i class="dot" style="background:var(--t-${b.tone})"></i>` : ''}${esc(b.label)} <span class="muted">(${b.items.length})</span></div>` : ''}
            ${b.items.length ? `<ol>${b.items.map((it) => `<li>${esc(it.name)}${it.extra ? ` <span class="muted">— ${esc(it.extra)}</span>` : ''}</li>`).join('')}</ol>` : `<div class="doc-none">${esc(b.empty)}</div>`}</div>`
          )
          .join('')}
        ${s.total ? `<div class="doc-total">${esc(s.total)}</div>` : ''}</section>`
      )
      .join('')}
    <footer class="doc-end">END OF REPORT</footer></article>`;
}

function viewReportDoc(report, type, members) {
  const byId = new Map(members.map((m) => [m.id, m]));
  const m = reportModel(report, type, byId);
  S.doc = { report, model: m };
  const canShare = !!(navigator.canShare && window.File && navigator.canShare({ files: [new File([''], 'x.pdf', { type: 'application/pdf' })] }));
  $content().innerHTML = `
    <div class="page-head no-print"><div><a href="#/reports" class="small">← All reports</a><h1 style="margin-top:4px">${esc(type.name)}</h1><p>${esc(m.dept)} · ${m.longDate} <span class="pill good">Submitted</span></p></div>
      <div class="row">
        ${canShare ? `<button class="btn primary" data-action="sharePdf">${icon('share')}Share PDF</button>` : ''}
        <button class="btn ${canShare ? '' : 'primary'}" data-action="downloadPdf">${icon('download')}Download PDF</button>
        <button class="btn" data-action="copyText">${icon('copy')}Copy for WhatsApp</button>
        <a class="btn" href="#/report/edit~${report.id}">${icon('edit')}Edit report</a>
        <a class="btn ghost" href="#/reports">${icon('close')}Close</a>
      </div></div>
    ${reportDocHtml(m)}`;
}

ACTIONS.copyText = async () => {
  const text = reportText(S.doc.model);
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied — paste it into WhatsApp');
  } catch {
    modal('Report text', `<textarea class="input" style="min-height:360px" readonly>${esc(text)}</textarea>`);
  }
};

// ─── PDF ───────────────────────────────────────────────────────────────────

let jsPdfLoader;
const loadJsPdf = () =>
  (jsPdfLoader ??= new Promise((resolve, reject) => {
    const sc = document.createElement('script');
    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    sc.onload = () => resolve(window.jspdf.jsPDF);
    sc.onerror = () => {
      jsPdfLoader = null;
      reject(new Error('Could not load the PDF tool — check your internet connection'));
    };
    document.head.appendChild(sc);
  }));
const imageData = (url) =>
  fetch(url)
    .then((r) => r.blob())
    .then((b) => new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); }))
    .catch(() => null);

// Plain Helvetica can't draw every character; keep text to what it can.
const pdfSafe = (t) => String(t ?? '').replace(/[—–]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[^\x20-\x7E -ÿ]/g, '');

async function buildPdf(m) {
  const [JsPDF, logo] = await Promise.all([loadJsPdf(), imageData('assets/coza-logo-dark.png')]);
  const pdf = new JsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, H = 297, M = 16, colGap = 8, colW = (W - 2 * M - colGap) / 2;
  const PURPLE = [58, 18, 87], INK = [23, 18, 28], MUTED = [120, 112, 130];
  let y = M;

  // Header
  if (logo) pdf.addImage(logo, 'PNG', M, y, 20, 20, 'logo', 'FAST');
  const tx = M + (logo ? 25 : 0);
  pdf.setTextColor(...PURPLE).setFont('helvetica', 'bold').setFontSize(14);
  const titleLines = pdf.splitTextToSize(pdfSafe(m.title), W - tx - M);
  pdf.text(titleLines, tx, y + 6);
  let hy = y + 6 + titleLines.length * 6;
  pdf.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...INK);
  if (m.sub) (pdf.text(pdfSafe(m.sub), tx, hy), (hy += 5));
  pdf.text(pdfSafe(`${m.service ? `Service: ${m.service}    ` : ''}Date: ${m.longDate}`), tx, hy);
  y = Math.max(y + 22, hy + 4);
  pdf.setDrawColor(...PURPLE).setLineWidth(0.8).line(M, y, W - M, y);
  pdf.setDrawColor(232, 51, 111).setLineWidth(0.8).line(M, y + 1.4, M + 60, y + 1.4);
  y += 9;

  const room = (h) => {
    if (y + h > H - 18) {
      pdf.addPage();
      y = M;
    }
  };

  for (const s of m.sections) {
    room(16);
    pdf.setFillColor(...PURPLE).circle(M + 2.6, y - 1.3, 2.6, 'F');
    pdf.setTextColor(255, 255, 255).setFont('helvetica', 'bold').setFontSize(8).text(String(s.n), M + 2.6, y - 0.2, { align: 'center' });
    pdf.setTextColor(...PURPLE).setFontSize(11).text(pdfSafe(s.title.toUpperCase()), M + 7, y);
    y += 6;

    if (s.text != null) {
      pdf.setTextColor(...INK).setFont('helvetica', 'normal').setFontSize(10);
      for (const line of pdf.splitTextToSize(pdfSafe(s.text), W - 2 * M - 7)) {
        room(5);
        pdf.text(line, M + 7, y);
        y += 5;
      }
    }
    for (const b of s.blocks) {
      if (b.label) {
        room(11);
        pdf.setTextColor(...INK).setFont('helvetica', 'bold').setFontSize(9.5).text(pdfSafe(`${b.label.toUpperCase()}  (${b.items.length})`), M + 7, y);
        y += 5;
      }
      pdf.setFont('helvetica', 'normal').setFontSize(10);
      if (!b.items.length) {
        room(5);
        pdf.setTextColor(...MUTED).text(pdfSafe(b.empty), M + 7, y);
        y += 6;
        continue;
      }
      // Names in two columns, numbered down the left column first.
      const lines = b.items.map((it, n) => pdf.splitTextToSize(pdfSafe(`${n + 1}. ${it.name}${it.extra ? ' - ' + it.extra : ''}`), colW - 7));
      let i = 0;
      while (i < lines.length) {
        const avail = Math.max(1, Math.floor((H - 18 - y) / 5));
        const remaining = lines.slice(i);
        let perCol = Math.ceil(remaining.reduce((a, l) => a + l.length, 0) / 2);
        if (perCol > avail) perCol = avail;
        const cols = [[], []];
        let c = 0, used = 0;
        while (i < lines.length && c < 2) {
          const h = lines[i].length;
          if (used + h > perCol && used > 0) {
            c += 1;
            used = 0;
            continue;
          }
          cols[c].push(lines[i]);
          used += h;
          i += 1;
        }
        pdf.setTextColor(...INK);
        let maxRows = 0;
        cols.forEach((col, ci) => {
          let rows = 0;
          col.forEach((l) => {
            pdf.text(l, M + 7 + ci * (colW + colGap), y + rows * 5);
            rows += l.length;
          });
          maxRows = Math.max(maxRows, rows);
        });
        y += maxRows * 5;
        if (i < lines.length) room(999);
      }
      y += 1.5;
    }
    if (s.total) {
      room(5);
      pdf.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(...INK).text(pdfSafe(s.total), M + 7, y);
      y += 5;
    }
    y += 4;
  }
  room(10);
  pdf.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...PURPLE).text('END OF REPORT', W / 2, y + 2, { align: 'center' });

  const pages = pdf.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p);
    pdf.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MUTED);
    pdf.text(pdfSafe(`${CHURCH_NAME} ${m.dept} · ${m.typeName} · ${m.longDate}`), M, H - 9);
    pdf.text(`Page ${p} of ${pages}`, W - M, H - 9, { align: 'right' });
  }
  const name = pdfSafe(`${m.dept} - ${m.typeName} - ${S.doc.report.service_date}.pdf`).replace(/[\\/:*?"<>|]/g, '');
  return { blob: pdf.output('blob'), name };
}

ACTIONS.downloadPdf = async (el) => {
  el.disabled = true;
  try {
    const { blob, name } = await buildPdf(S.doc.model);
    downloadFile(name, blob, 'application/pdf');
    toast('PDF downloaded');
  } finally {
    el.disabled = false;
  }
};
ACTIONS.sharePdf = async (el) => {
  el.disabled = true;
  try {
    const { blob, name } = await buildPdf(S.doc.model);
    const file = new File([blob], name, { type: 'application/pdf' });
    try {
      await navigator.share({ files: [file], title: name.replace(/\.pdf$/, '') });
    } catch (e) {
      if (e.name !== 'AbortError') downloadFile(name, blob, 'application/pdf');
    }
  } finally {
    el.disabled = false;
  }
};

// ─── Reports list ──────────────────────────────────────────────────────────

let reportFilter = '';
async function viewReports() {
  const { from, to } = monthRange(S.month);
  const [reports, members] = await Promise.all([store.listReports({ deptId: S.scope, from, to }), store.listMembers(S.scope)]);
  const list = reports.filter((r) => !reportFilter || r.report_type === reportFilter);
  const deptMembers = (id) => members.filter((m) => m.department_id === id && m.active).length;
  $content().innerHTML = `
    <div class="page-head"><div><h1>Reports</h1><p>${S.scope ? esc(dept().name) : 'All departments'} · ${monthLabel(S.month)}</p></div>
      <div class="row">${monthPicker()}<select class="input" style="width:auto" data-input="reportFilter" aria-label="Report type"><option value="">All report types</option>${REPORT_TYPES.map((t) => `<option value="${t.key}" ${t.key === reportFilter ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
      <button class="btn" data-action="exportReports" ${list.length ? '' : 'disabled'}>${icon('download')}CSV</button>${S.scope ? `<a class="btn primary" href="#/new">${icon('plus')}New</a>` : ''}</div></div>
    <div class="card">${
      list.length
        ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Report</th>${S.scope ? '' : '<th>Department</th>'}<th>Attendance</th><th>Status</th><th></th></tr></thead><tbody>${list
            .map((r) => {
              const att = r.entries.filter((e) => e.section === 'attendance' || e.section === 'prayer' || e.section === 'evangelism');
              const present = att.filter((e) => ['early', 'late_perm', 'late', 'present', 'participated'].includes(e.category)).length;
              const total = deptMembers(r.department_id);
              return `<tr class="click" data-action="go" data-href="#/report/${r.id}"><td class="num">${fmtDate(r.service_date)}</td><td><b>${esc(REPORT_TYPE_MAP[r.report_type]?.name ?? r.report_type)}</b></td>
              ${S.scope ? '' : `<td>${esc(dept(r.department_id)?.name ?? '')}</td>`}
              <td><div class="bar-cell"><div class="mini-bar"><i style="width:${pct(present, total) ?? 0}%"></i></div><span class="num small">${present}/${total}</span></div></td>
              <td>${r.status === 'submitted' ? '<span class="pill good">Submitted</span>' : '<span class="pill warn">Draft</span>'}</td><td class="r">${icon('edit').replace('<svg', '<svg width="16" height="16" style="color:var(--muted)"')}</td></tr>`;
            })
            .join('')}</tbody></table></div>`
        : `<div class="empty"><h3>No reports here yet</h3><p>Nothing filed for ${monthLabel(S.month)}${reportFilter ? ' of this type' : ''}.</p></div>`
    }</div>`;
  ACTIONS.exportReports = () => {
    const byId = new Map(members.map((m) => [m.id, m]));
    const rows = [['Date', 'Department', 'Report', 'Section', 'Category', 'Member', 'Value', 'Remark']];
    list.forEach((r) => {
      const t = REPORT_TYPE_MAP[r.report_type];
      r.entries.forEach((e) => {
        const s = t?.sections.find((x) => x.key === e.section);
        rows.push([r.service_date, dept(r.department_id)?.name, t?.name, s?.title ?? e.section, s?.categories?.find((c) => c.key === e.category)?.label ?? '', byId.get(e.member_id)?.full_name ?? '', e.value ?? '', e.remark ?? '']);
      });
      Object.entries(r.notes ?? {}).forEach(([k, v]) => rows.push([r.service_date, dept(r.department_id)?.name, t?.name, t?.sections.find((x) => x.key === k)?.title ?? k, '', '', '', v]));
    });
    downloadFile(`reports-${S.month}.csv`, toCsv(rows));
  };
}
INPUTS.reportFilter = (el) => {
  reportFilter = el.value;
  viewReports();
};

// ─── Members ───────────────────────────────────────────────────────────────

let memberQuery = '';
async function viewMembers() {
  if (!S.scope) return ($content().innerHTML = needDept('Members'));
  const members = await store.listMembers(S.scope);
  const q = memberQuery.toLowerCase();
  const list = members.filter((m) => !q || m.full_name.toLowerCase().includes(q));
  const activeN = members.filter((m) => m.active).length;
  $content().innerHTML = `
    <div class="page-head"><div><h1>Members</h1><p>${esc(dept().name)} · ${activeN} active${members.length > activeN ? `, ${members.length - activeN} inactive` : ''}</p></div>
      <div class="row"><input class="input" style="width:220px" placeholder="Search members" data-input="memberQuery" value="${esc(memberQuery)}" aria-label="Search members">
      <button class="btn" data-action="importMembers">Import list</button><button class="btn primary" data-action="editMember">${icon('plus')}Add member</button></div></div>
    <div class="card">${
      list.length
        ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Instagram</th><th>Facebook</th><th>Phone</th><th>Status</th><th></th></tr></thead><tbody>${list
            .map(
              (m) => `<tr><td><a href="#/scorecard/${m.id}" style="text-decoration:none;color:inherit">${person(m)}</a></td><td>${m.instagram ? '@' + esc(m.instagram) : '<span class="muted">—</span>'}</td><td>${esc(m.facebook) || '<span class="muted">—</span>'}</td><td>${esc(m.phone) || '<span class="muted">—</span>'}</td>
              <td>${m.active ? '<span class="pill good">Active</span>' : '<span class="pill">Inactive</span>'}</td><td class="r"><button class="btn sm ghost" data-action="editMember" data-id="${m.id}">Edit</button></td></tr>`
            )
            .join('')}</tbody></table></div>`
        : `<div class="empty"><h3>${members.length ? 'No match' : 'No members yet'}</h3><p>${members.length ? 'Try another name.' : 'Add members one at a time, or paste the whole list from your spreadsheet with “Import list”.'}</p></div>`
    }</div>`;
  ACTIONS.editMember = (el) => memberModal(members.find((m) => m.id === el.dataset.id));
}
INPUTS.memberQuery = (el, e) => {
  if (e.type !== 'input') return;
  memberQuery = el.value;
  clearTimeout(INPUTS.memberQuery.t);
  INPUTS.memberQuery.t = setTimeout(async () => {
    await viewMembers();
    const i = document.querySelector('[data-input="memberQuery"]');
    i.focus();
    i.setSelectionRange(i.value.length, i.value.length);
  }, 150);
};

function memberModal(m) {
  modal(
    m ? 'Edit member' : 'Add member',
    `<div class="field"><label for="mName">Full name</label><input class="input" id="mName" value="${esc(m?.full_name)}" required></div>
     <div class="grid-2"><div class="field"><label for="mIg">Instagram</label><input class="input" id="mIg" value="${esc(m?.instagram)}" placeholder="handle"></div>
     <div class="field"><label for="mFb">Facebook</label><input class="input" id="mFb" value="${esc(m?.facebook)}"></div></div>
     <div class="field"><label for="mPh">Phone</label><input class="input" id="mPh" value="${esc(m?.phone)}" inputmode="tel"></div>
     ${m ? `<label class="check"><input type="checkbox" id="mAct" ${m.active ? 'checked' : ''}> Active (inactive members are hidden from new reports but keep their history)</label>
     <div><button class="btn sm danger" data-del>Delete member permanently</button></div>` : ''}`,
    {
      onOk: async (root) => {
        const full_name = root.querySelector('#mName').value.trim();
        if (!full_name) return toast('Name is required', true), false;
        await store.saveMember({ id: m?.id, department_id: S.scope, full_name, instagram: root.querySelector('#mIg').value.trim().replace(/^@/, ''), facebook: root.querySelector('#mFb').value.trim(), phone: root.querySelector('#mPh').value.trim(), active: m ? root.querySelector('#mAct').checked : true });
        toast('Saved');
        viewMembers();
      },
    }
  ).querySelector('[data-del]')?.addEventListener('click', (e) => {
    e.target.closest('.modal-back').remove();
    confirmBox('Delete member?', `This permanently removes ${m.full_name} and their entries in past reports. To keep history, mark them inactive instead.`, 'Delete', async () => {
      await store.deleteMember(m.id);
      toast('Member deleted');
      viewMembers();
    });
  });
}

ACTIONS.importMembers = () =>
  modal(
    'Import members',
    `<p class="small muted" style="margin:0">Paste one member per line. You can copy the NAME column straight from the Excel sheet. Optionally add Instagram and Facebook after commas or tabs:<br><code>Ada Okafor, ada_official, Ada Okafor</code></p>
     <textarea class="input" id="imp" style="min-height:220px" placeholder="One name per line"></textarea>`,
    {
      okLabel: 'Import',
      onOk: async (root) => {
        const existing = new Set((await store.listMembers(S.scope)).map((m) => m.full_name.toLowerCase()));
        const rows = root
          .querySelector('#imp')
          .value.split('\n')
          .map((l) => l.split(/\t|,/).map((x) => x.trim()))
          .filter(([n]) => n && !/^(s\/?n|name)$/i.test(n) && !/^\d+$/.test(n))
          .map(([full_name, instagram, facebook]) => ({ department_id: S.scope, full_name: titleCase(full_name), instagram: instagram?.replace(/^@/, '') || null, facebook: facebook || null, active: true }))
          .filter((r) => !existing.has(r.full_name.toLowerCase()));
        if (!rows.length) return toast('No new names found', true), false;
        await store.addMembers(rows);
        toast(`Imported ${rows.length} member${rows.length > 1 ? 's' : ''}`);
        viewMembers();
      },
    }
  );
const titleCase = (s) => (s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()) : s);

// ─── Tasks ─────────────────────────────────────────────────────────────────

// Two lists — Submitted / Not submitted. Tap a name to move it across.
const submitLists = (people, isDone, taskId = '') => {
  const yes = people.filter((m) => isDone(m.id));
  const no = people.filter((m) => !isDone(m.id));
  const chips = (list, done) =>
    list.length
      ? list.map((m) => `<button type="button" class="chip ${done ? 'chip-yes' : ''}" data-action="toggleSubmit" data-task="${taskId}" data-id="${m.id}" data-done="${done ? 1 : 0}" title="Move to ${done ? 'Not submitted' : 'Submitted'}">${done ? '✓ ' : ''}${esc(m.full_name)}</button>`).join('')
      : `<span class="muted small">${done ? 'Nobody yet' : 'Everyone submitted 🎉'}</span>`;
  return `<div class="submit-cols">
    <div class="bucket" style="--tone:var(--t-early)"><div class="bucket-h"><span>Submitted</span><span class="c num">${yes.length}</span></div><div class="chip-wrap">${chips(yes, true)}</div></div>
    <div class="bucket" style="--tone:var(--t-absent)"><div class="bucket-h"><span>Not submitted</span><span class="c num">${no.length}</span></div><div class="chip-wrap">${chips(no, false)}</div></div>
  </div>`;
};

async function viewTasks() {
  if (!S.scope) return ($content().innerHTML = needDept('Tasks'));
  const { from, to } = monthRange(S.month);
  const [tasks, members] = await Promise.all([store.listTasks({ deptId: S.scope, from, to }), store.listMembers(S.scope)]);
  const byId = new Map(members.map((m) => [m.id, m]));
  S.tasks = tasks;
  $content().innerHTML = `
    <div class="page-head"><div><h1>Tasks</h1><p>${esc(dept().name)} · due in ${monthLabel(S.month)} · tap a name to mark it submitted or not · feeds the Goals score</p></div>
      <div class="row">${monthPicker()}<button class="btn primary" data-action="editTask">${icon('plus')}New task</button></div></div>
    ${
      tasks.length
        ? tasks
            .map((t) => {
              const people = t.assignments.map((a) => byId.get(a.member_id)).filter(Boolean).sort((x, y) => x.full_name.localeCompare(y.full_name));
              const done = new Set(t.assignments.filter((a) => a.done).map((a) => a.member_id));
              const overdue = t.due_date < today() && done.size < people.length;
              return `<div class="card" id="task-${t.id}"><div class="card-head"><div><h2>${esc(t.title)}</h2><p>Due ${fmtDate(t.due_date)} ${overdue ? '<span class="pill bad">Overdue</span>' : ''}${t.details ? ' · ' + esc(t.details) : ''}</p></div>
              <div class="row"><div class="bar-cell" style="min-width:160px"><div class="mini-bar"><i style="width:${pct(done.size, people.length) ?? 0}%"></i></div><span class="num small">${done.size}/${people.length}</span></div>
              <button class="btn sm ghost" data-action="editTask" data-id="${t.id}">Edit</button></div></div>
              ${submitLists(people, (id) => done.has(id), t.id)}</div>`;
            })
            .join('')
        : `<div class="card empty"><h3>No tasks due in ${monthLabel(S.month)}</h3><p>Create a task — weekly goals, follow-ups, submissions — then mark who submitted and who didn't.</p></div>`
    }`;
  ACTIONS.editTask = (el) => taskModal(tasks.find((t) => t.id === el.dataset.id), members.filter((m) => m.active));
}

ACTIONS.toggleSubmit = async (el) => {
  const { task, id } = el.dataset;
  const done = el.dataset.done !== '1';
  if (!task) return; // inside the task form (handled there)
  await store.setTaskDone(task, id, done);
  const t = S.tasks.find((x) => x.id === task);
  t.assignments.find((a) => a.member_id === id).done = done;
  viewTasks();
};

function taskModal(t, members) {
  // Everyone active is on the task; previously-recorded people who left stay too.
  const people = [...members];
  const submitted = new Set(t ? t.assignments.filter((a) => a.done).map((a) => a.member_id) : []);
  const back = modal(
    t ? 'Edit task' : 'New task',
    `<div class="field"><label for="tTitle">Task</label><input class="input" id="tTitle" value="${esc(t?.title)}" placeholder="e.g. Submit weekly lesson plan"></div>
     <div class="field"><label for="tDet">Details (optional)</label><input class="input" id="tDet" value="${esc(t?.details)}"></div>
     <div class="field"><label for="tDue">Due date</label><input class="input" type="date" id="tDue" value="${t?.due_date ?? today()}"></div>
     <div class="field"><div class="row" style="justify-content:space-between"><span class="label">Who submitted?</span>
       <span class="small"><button type="button" class="linkish" data-all="1">Everyone</button> · <button type="button" class="linkish" data-all="0">Nobody</button></span></div>
       <p class="small muted" style="margin:0">Tap a name to move it between the two lists. You can also do this later from the Tasks page.</p>
       <div id="tSubmit">${submitLists(people, (id) => submitted.has(id))}</div></div>
     ${t ? '<div><button type="button" class="btn sm danger" data-del>Delete task</button></div>' : ''}`,
    {
      okLabel: t ? 'Save task' : 'Create task',
      wide: true,
      onOk: async () => {
        const title = back.querySelector('#tTitle').value.trim();
        const due_date = back.querySelector('#tDue').value;
        if (!title || !due_date) return toast('Task and due date are required', true), false;
        if (!people.length) return toast('Add members first', true), false;
        await store.saveTask({ id: t?.id, department_id: S.scope, title, details: back.querySelector('#tDet').value.trim(), due_date }, people.map((m) => m.id), [...submitted]);
        toast('Task saved');
        viewTasks();
      },
    }
  );
  const redraw = () => (back.querySelector('#tSubmit').innerHTML = submitLists(people, (id) => submitted.has(id)));
  back.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-action=toggleSubmit]');
    if (chip) {
      submitted.has(chip.dataset.id) ? submitted.delete(chip.dataset.id) : submitted.add(chip.dataset.id);
      redraw();
    }
    const all = e.target.closest('[data-all]');
    if (all) {
      submitted.clear();
      if (all.dataset.all === '1') people.forEach((m) => submitted.add(m.id));
      redraw();
    }
  });
  back.querySelector('[data-del]')?.addEventListener('click', () => {
    back.remove();
    confirmBox('Delete task?', 'This removes the task and its submission record.', 'Delete', async () => {
      await store.deleteTask(t.id);
      viewTasks();
    });
  });
}

// ─── Scorecards ────────────────────────────────────────────────────────────

async function viewScorecards() {
  if (!S.scope) return ($content().innerHTML = needDept('Scorecards'));
  const { active, reports, tasks } = await monthData(S.scope);
  const cards = computeScorecards(active, reports, tasks).sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1));
  $content().innerHTML = `
    <div class="page-head no-print"><div><h1>Monthly scorecards</h1><p>${esc(dept().name)} · ${monthLabel(S.month)}</p></div>
      <div class="row">${monthPicker()}<button class="btn" data-action="printAll" ${cards.length ? '' : 'disabled'}>${icon('print')}Print all</button></div></div>
    <div class="sc-grid no-print">${cards
      .map((c) => `<button class="sc-tile" data-action="go" data-href="#/scorecard/${c.member.id}">${ring(c.overall)}<div><div style="font-weight:700">${esc(c.member.full_name)}</div><div class="small muted">${c.earned} / ${c.possible} pts</div></div></button>`)
      .join('') || '<div class="card empty" style="grid-column:1/-1"><h3>No active members</h3></div>'}</div>
    <div id="printArea"></div>
    <details class="card no-print" style="margin-top:16px"><summary style="cursor:pointer;font-weight:700">How scores are worked out</summary>${scoringHelp()}</details>`;
  ACTIONS.printAll = () => {
    document.getElementById('printArea').innerHTML = cards.map((c) => `<div class="print-page" style="display:none">${scorecardHtml(c)}</div>`).join('');
    const style = document.createElement('style');
    style.textContent = '@media print{.print-page{display:block!important;margin-bottom:0}}';
    document.head.appendChild(style);
    print();
    style.remove();
  };
}

function scoringHelp() {
  return `<div class="small" style="color:var(--ink-2);margin-top:10px"><p>Each pillar is worth the points on the scorecard. Members are only scored on what was recorded that month — a pillar with no data shows “—” and is left out of the overall %, so nobody is penalised for an activity that didn't happen.</p><ul>
  <li><b>Attendance (15)</b> — every service report: early = full marks, late with permission = 80%, late without permission = 50%, absent without permission = 0. Absent <i>with</i> permission isn't counted.</li>
  <li><b>Participation (20)</b> — prayer meetings and calls, post-service attendance, prayer-call engagement, and WhatsApp/social media post compliance.</li>
  <li><b>Evangelism (10)</b> — share of evangelism outings joined (excused absences not counted).</li>
  <li><b>Souls (30)</b> — guests invited + souls reached, against a monthly target of ${SOULS_MONTHLY_TARGET}.</li>
  <li><b>Goals (15)</b> — share of tasks the member submitted.</li></ul>
  <p>Weights and targets live in <code>js/templates.js</code> and can be changed.</p></div>`;
}

async function viewScorecard(memberId) {
  const members = await store.listMembers(S.scope);
  let m = members.find((x) => x.id === memberId);
  if (!m && isGlobal()) {
    const all = await store.listMembers();
    m = all.find((x) => x.id === memberId);
    if (m) {
      setScope(m.department_id);
      return;
    }
  }
  if (!m) return ($content().innerHTML = '<div class="card empty"><h3>Member not found</h3></div>');
  const { reports, tasks } = await monthData(m.department_id);
  const [c] = computeScorecards([m], reports, tasks);
  $content().innerHTML = `
    <div class="page-head no-print"><div><a href="#/scorecards" class="small">← All scorecards</a><h1 style="margin-top:4px">${esc(m.full_name)}</h1></div>
      <div class="row">${monthPicker()}<button class="btn primary" onclick="print()">${icon('print')}Print / save PDF</button></div></div>
    ${scorecardHtml(c)}
    <details class="card no-print" style="margin-top:16px"><summary style="cursor:pointer;font-weight:700">How scores are worked out</summary>${scoringHelp()}</details>`;
}

function scorecardHtml(c) {
  const d = dept(c.member.department_id);
  const pillar = (key, extraClass = '') => {
    const p = PILLARS.find((x) => x.key === key);
    const v = c.pillars[key];
    return `<div class="sc-pillar ${extraClass}" style="--pc:${p.color}"><span class="tag">${p.label}</span>
      <div class="score"><div><div class="big num">${v.points ?? '—'}</div><div class="of">/ ${p.points} POINTS</div></div><div class="ach"><b>${v.pct ?? '—'}${v.pct != null ? '%' : ''}</b><br>achievement</div></div>
      <ul>${p.items.map((i) => `<li>${i}</li>`).join('')}</ul></div>`;
  };
  // Concentric rings, one per pillar (outer → inner), filled to its achievement.
  const order = ['attendance', 'souls', 'evangelism', 'goals', 'participation'];
  const rings = order
    .map((k, i) => {
      const r = 98 - i * 9;
      const circ = 2 * Math.PI * r;
      const p = (c.pillars[k].pct ?? 0) / 100;
      const col = PILLARS.find((x) => x.key === k).color;
      return `<circle cx="105" cy="105" r="${r}" fill="none" stroke="${col}" stroke-opacity=".18" stroke-width="7"/>
      <circle cx="105" cy="105" r="${r}" fill="none" stroke="${col}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(circ * p).toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 105 105)"/>`;
    })
    .join('');
  const st = c.stats;
  const part = c.pillars.participation;
  return `<article class="scorecard">
    <div class="sc-top"><div class="eyebrow">MONTHLY MEMBER SCORECARD</div><h2>${esc(c.member.full_name)}</h2>
      <div class="meta">${monthLabel(S.month)} &nbsp;|&nbsp; Department / Role: ${esc(d?.name ?? '')} / Member</div><img class="logo" src="assets/coza-logo-dark.png" alt="${esc(CHURCH_NAME)}"></div>
    <div class="sc-strip"></div>
    <div class="sc-body">
      ${pillar('attendance')}
      <div class="sc-center"><svg viewBox="0 0 210 210" role="img" aria-label="Achievement rings">${rings}</svg><div class="face">${esc(initials(c.member.full_name))}</div>
        <div class="overall">${c.overall ?? '—'}${c.overall != null ? '%' : ''}<small>OVERALL</small></div></div>
      ${pillar('souls')}
      ${pillar('evangelism')}
      ${pillar('goals')}
      <div class="sc-pillar sc-wide" style="--pc:#3b8ff0"><span class="tag">Participation</span><div class="inner"><ul style="padding:0"><li>Weekly prayers</li><li>Post-service</li><li>Social media engagement</li></ul>
        <div style="text-align:right"><span class="big num">${part.points ?? '—'} / ${part.max}</span><div class="of">POINTS</div></div></div></div>
      <div class="sc-summary-tag">Summary breakdown</div>
      <div class="sc-foot">
        <div class="sc-box"><h4>Summary breakdown</h4><dl>
          <dt>Souls / guests:</dt><dd>${st.souls}</dd><dt>Contraventions:</dt><dd>${st.contravention}</dd>
          <dt>Times late:</dt><dd>${st.late}</dd><dt>Times absent:</dt><dd>${st.absent}</dd>
          <dt>Tasks submitted:</dt><dd>${st.tasks_done}/${st.tasks_total}</dd><dt>Prayers attended:</dt><dd>${st.prayer}</dd>
          <dt>Services attended:</dt><dd>${st.served}</dd><dt>Evangelism attended:</dt><dd>${st.evangelism}</dd></dl></div>
        <div class="sc-box sc-sign"><div class="line">${esc(d?.head_name || 'Head of Department')}<small>Department Head</small></div></div>
      </div>
      <div class="sc-note">${esc(CHURCH_NAME)} Departmental Reporting · scores cover what was recorded in ${monthLabel(S.month)}</div>
    </div></article>`;
}

// ─── Admin (global only) ───────────────────────────────────────────────────

async function viewAdmin() {
  if (!isGlobal()) return ($content().innerHTML = '<div class="card empty"><h3>Global admins only</h3></div>');
  const [profiles, members, invites] = await Promise.all([store.listProfiles(), store.listMembers(), store.listInvites()]);
  const pending = profiles.filter((p) => p.role === 'pending');
  ACTIONS.addAdmin = (el) => adminModal(profiles, el.dataset.dept);
  const deptOpts = (sel) => `<option value="">— none —</option>${S.departments.map((d) => `<option value="${d.id}" ${d.id === sel ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}`;
  $content().innerHTML = `
    <div class="page-head"><div><h1>Departments & admins</h1><p>Add departments, add admins, and choose who can see what.</p></div>
      <div class="row"><button class="btn" data-action="editDept">${icon('plus')}Add department</button><button class="btn primary" data-action="addAdmin">${icon('plus')}Add admin</button></div></div>
    <div class="card"><div class="card-head"><div><h2>Departments</h2><p>Each department admin only sees their own department.</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>Department</th><th>Head</th><th class="r">Members</th><th class="r">Admins</th><th>Reports used</th><th></th></tr></thead><tbody>${S.departments
        .map(
          (d) => `<tr><td><b>${esc(d.name)}</b></td><td>${esc(d.head_name) || '<span class="muted">—</span>'}</td><td class="r num">${members.filter((m) => m.department_id === d.id && m.active).length}</td>
          <td class="r num">${profiles.filter((p) => p.department_id === d.id && p.role === 'dept_admin').length}</td>
          <td class="small">${(d.report_types ?? []).map((k) => REPORT_TYPE_MAP[k]?.short).filter(Boolean).join(', ')}</td><td class="r"><button class="btn sm ghost" data-action="addAdmin" data-dept="${d.id}">+ Admin</button><button class="btn sm ghost" data-action="editDept" data-id="${d.id}">Edit</button></td></tr>`
        )
        .join('')}</tbody></table></div></div>
    <div class="card"><div class="card-head"><div><h2>Admins ${pending.length ? `<span class="pill warn">${pending.length} awaiting approval</span>` : ''}</h2>
      <p>Add an admin by email, or approve people who signed up on their own. Change a role or department, then click Save.</p></div>
      <button class="btn sm" data-action="addAdmin">${icon('plus')}Add admin</button></div>
      ${
        invites.length
          ? `<h3 style="margin:4px 0 8px">Invited — waiting for them to create their account</h3><div class="table-wrap" style="margin-bottom:18px"><table><thead><tr><th>Name</th><th>Role</th><th>Department</th><th></th></tr></thead><tbody>${invites
              .map(
                (i) => `<tr><td><div style="font-weight:600">${esc(i.full_name || i.email)}</div><div class="small muted">${esc(i.email)}</div></td>
                <td><span class="pill warn">Invited</span> ${i.role === 'global_admin' ? 'Global admin' : 'Department admin'}</td><td>${esc(dept(i.department_id)?.name ?? '—')}</td>
                <td class="r"><button class="btn sm" data-action="shareInvite" data-email="${esc(i.email)}">${icon('copy')}Invite message</button> <button class="btn sm ghost danger" data-action="cancelInvite" data-email="${esc(i.email)}">Cancel</button></td></tr>`
              )
              .join('')}</tbody></table></div><h3 style="margin:4px 0 8px">Active accounts</h3>`
          : ''
      }
      <div class="table-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Department</th><th></th></tr></thead><tbody>${profiles
        .sort((a, b) => (a.role === 'pending' ? -1 : 0) - (b.role === 'pending' ? -1 : 0))
        .map(
          (p) => `<tr data-pid="${p.id}"><td><div class="n" style="font-weight:600">${esc(p.full_name)}</div><div class="small muted">${esc(p.email)}</div></td>
          <td><select class="input" style="width:auto" data-f="role" ${p.id === S.profile.id ? 'disabled' : ''}>${[['pending', 'Pending'], ['dept_admin', 'Department admin'], ['global_admin', 'Global admin']].map(([v, l]) => `<option value="${v}" ${p.role === v ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
          <td><select class="input" style="width:auto" data-f="dept">${deptOpts(p.department_id)}</select></td>
          <td class="r">${p.id === S.profile.id ? '<span class="small muted">You</span>' : `<button class="btn sm primary" data-action="saveProfile" data-id="${p.id}">Save</button> <button class="btn sm ghost danger" data-action="removeProfile" data-id="${p.id}">Remove</button>`}</td></tr>`
        )
        .join('')}</tbody></table></div></div>`;
}
const appUrl = () => location.origin + location.pathname;
const inviteText = (inv) =>
  `Hi${inv.full_name ? ' ' + inv.full_name.split(' ')[0] : ''}, you've been added as ${inv.role === 'global_admin' ? 'a global admin' : `an admin for ${dept(inv.department_id)?.name ?? 'your department'}`} on ${CHURCH_NAME} ${APP_NAME}.

1. Open ${appUrl()}
2. Tap "Create an account"
3. Sign up with this email: ${inv.email}
4. Confirm the email you receive, then sign in.

You'll go straight in and can fill and view reports for your department.`;

async function showInviteMessage(inv) {
  const text = inviteText(inv);
  modal(
    'Send this invite',
    `<p class="small muted" style="margin:0">Copy this and send it on WhatsApp or by email. They must sign up with <b>${esc(inv.email)}</b>.</p>
     <textarea class="input" style="min-height:230px" readonly>${esc(text)}</textarea>
     <div><button class="btn" data-copy>${icon('copy')}Copy message</button></div>`
  ).querySelector('[data-copy]').onclick = async (e) => {
    try {
      await navigator.clipboard.writeText(text);
      toast('Invite copied');
    } catch {
      e.target.closest('.modal').querySelector('textarea').select();
    }
  };
}

function adminModal(profiles, presetDept) {
  modal(
    'Add admin',
    `<p class="small muted" style="margin:0">Enter their email and department. When they create an account with this email they go straight in — no approval needed.</p>
     <div class="field"><label for="aName">Full name</label><input class="input" id="aName" autocomplete="off"></div>
     <div class="field"><label for="aEmail">Email</label><input class="input" id="aEmail" type="email" autocomplete="off"></div>
     <div class="grid-2">
       <div class="field"><label for="aRole">Role</label><select class="input" id="aRole"><option value="dept_admin">Department admin</option><option value="global_admin">Global admin (sees all departments)</option></select></div>
       <div class="field"><label for="aDept">Department</label><select class="input" id="aDept">${S.departments.map((d) => `<option value="${d.id}" ${d.id === (presetDept || S.scope) ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></div>
     </div>
     <p class="small muted" style="margin:0">Department admins can add members, fill and submit reports, set tasks and print scorecards for their department.</p>`,
    {
      okLabel: 'Add admin',
      onOk: async (root) => {
        const email = root.querySelector('#aEmail').value.trim().toLowerCase();
        const full_name = root.querySelector('#aName').value.trim() || null;
        const role = root.querySelector('#aRole').value;
        const department_id = role === 'dept_admin' ? root.querySelector('#aDept').value : null;
        if (!/^\S+@\S+\.\S+$/.test(email)) return toast('Enter a valid email', true), false;
        const existing = profiles.find((p) => (p.email ?? '').toLowerCase() === email);
        if (existing) {
          await store.updateProfile(existing.id, { role, department_id });
          toast(`${existing.full_name || email} already had an account — access updated`);
        } else {
          await store.saveInvite({ email, full_name, role, department_id });
          await viewAdmin();
          showInviteMessage({ email, full_name, role, department_id });
          return;
        }
        viewAdmin();
      },
    }
  );
}
ACTIONS.shareInvite = async (el) => {
  const inv = (await store.listInvites()).find((i) => i.email === el.dataset.email);
  if (inv) showInviteMessage(inv);
};
ACTIONS.cancelInvite = (el) =>
  confirmBox('Cancel this invite?', `${el.dataset.email} will no longer be let in automatically.`, 'Cancel invite', async () => {
    await store.deleteInvite(el.dataset.email);
    viewAdmin();
  });
ACTIONS.saveProfile = async (el) => {
  const tr = el.closest('tr');
  const role = tr.querySelector('[data-f=role]').value;
  const department_id = tr.querySelector('[data-f=dept]').value || null;
  if (role === 'dept_admin' && !department_id) return toast('Pick a department for a department admin', true);
  await store.updateProfile(el.dataset.id, { role, department_id });
  toast('Access updated');
  viewAdmin();
};
ACTIONS.removeProfile = (el) =>
  confirmBox('Remove this admin?', 'They will lose access to the app. (Their login still exists in Supabase → Authentication, where you can delete it fully.)', 'Remove', async () => {
    await store.deleteProfile(el.dataset.id);
    viewAdmin();
  });
ACTIONS.editDept = (el) => {
  const d = S.departments.find((x) => x.id === el.dataset.id);
  const enabled = new Set(d?.report_types ?? ALL_REPORT_TYPE_KEYS);
  const back = modal(
    d ? 'Edit department' : 'Add department',
    `<div class="field"><label for="dName">Department name</label><input class="input" id="dName" value="${esc(d?.name)}" placeholder="e.g. Ushering Guzape"></div>
     <div class="field"><label for="dHead">Head of department (signs scorecards)</label><input class="input" id="dHead" value="${esc(d?.head_name)}"></div>
     <div class="field"><span class="label">Reports this department files</span><div class="member-pick">${REPORT_TYPES.map((t) => `<label class="check"><input type="checkbox" value="${t.key}" ${enabled.has(t.key) ? 'checked' : ''}>${esc(t.name)}</label>`).join('')}</div></div>
     ${d ? '<div><button class="btn sm danger" data-del>Delete department</button></div>' : ''}`,
    {
      onOk: async (root) => {
        const name = root.querySelector('#dName').value.trim();
        if (!name) return toast('Name is required', true), false;
        const report_types = [...root.querySelectorAll('.member-pick input:checked')].map((i) => i.value);
        await store.saveDepartment({ id: d?.id, name, head_name: root.querySelector('#dHead').value.trim() || null, report_types });
        S.departments = await store.listDepartments();
        renderShell();
        route();
        toast('Department saved');
      },
    }
  );
  back.querySelector('[data-del]')?.addEventListener('click', () => {
    back.remove();
    confirmBox('Delete department?', `This permanently deletes ${d.name} with all its members, reports and tasks.`, 'Delete everything', async () => {
      await store.deleteDepartment(d.id);
      S.departments = await store.listDepartments();
      if (S.scope === d.id) S.scope = null;
      renderShell();
      location.hash = '#/admin';
      route();
    });
  });
};

// ─── Start ─────────────────────────────────────────────────────────────────

window.addEventListener('hashchange', route);
window.addEventListener('beforeunload', (e) => {
  if (S.editor?.dirty) e.preventDefault();
});
if (!IS_DEMO) {
  store.sb.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      const pw = prompt('Enter a new password (at least 8 characters):');
      if (pw && pw.length >= 8) store.sb.auth.updateUser({ password: pw }).then(() => toast('Password updated')).catch(fail);
    }
    if (event === 'SIGNED_OUT') location.reload();
  });
}
boot();
