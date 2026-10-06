// Data layer. Two interchangeable backends with the same methods:
//   SupabaseStore — the live database (when js/config.js has keys)
//   DemoStore     — sample data kept in this browser's localStorage
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js?v=202610062106';
import { ALL_REPORT_TYPE_KEYS, REPORT_TYPE_MAP } from './templates.js?v=202610062106';
import { isoDate, addDays } from './util.js?v=202610062106';

export const IS_DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY;

// ─── Supabase ──────────────────────────────────────────────────────────────

class SupabaseStore {
  constructor() {
    this.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  async q(promise) {
    const { data, error } = await promise;
    if (error) throw new Error(error.message);
    return data;
  }

  async getUser() {
    const { data } = await this.sb.auth.getSession();
    return data.session?.user ?? null;
  }
  async signIn(email, password) {
    await this.q(this.sb.auth.signInWithPassword({ email, password }));
  }
  async signUp(email, password, fullName) {
    const data = await this.q(
      this.sb.auth.signUp({ email, password, options: { data: { full_name: fullName }, emailRedirectTo: location.origin + location.pathname } })
    );
    return { needsConfirm: !data.session };
  }
  async resetPassword(email) {
    await this.q(this.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }));
  }
  async signOut() {
    await this.sb.auth.signOut();
  }
  async getProfile() {
    const user = await this.getUser();
    if (!user) return null;
    return this.q(this.sb.from('profiles').select('*').eq('id', user.id).maybeSingle());
  }

  listDepartments() {
    return this.q(this.sb.from('departments').select('*').order('name'));
  }
  async saveDepartment(d) {
    const row = { name: d.name, head_name: d.head_name, report_types: d.report_types };
    if (d.id) return this.q(this.sb.from('departments').update(row).eq('id', d.id).select().single());
    return this.q(this.sb.from('departments').insert(row).select().single());
  }
  deleteDepartment(id) {
    return this.q(this.sb.from('departments').delete().eq('id', id));
  }

  listProfiles() {
    return this.q(this.sb.from('profiles').select('*').order('created_at'));
  }
  updateProfile(id, patch) {
    return this.q(this.sb.from('profiles').update(patch).eq('id', id));
  }
  deleteProfile(id) {
    return this.q(this.sb.from('profiles').delete().eq('id', id));
  }
  listInvites() {
    return this.q(this.sb.from('admin_invites').select('*').order('created_at'));
  }
  saveInvite(inv) {
    return this.q(this.sb.from('admin_invites').upsert(inv));
  }
  deleteInvite(email) {
    return this.q(this.sb.from('admin_invites').delete().eq('email', email));
  }

  listMembers(deptId) {
    let q = this.sb.from('members').select('*').order('full_name');
    if (deptId) q = q.eq('department_id', deptId);
    return this.q(q);
  }
  async saveMember(m) {
    const row = { department_id: m.department_id, full_name: m.full_name, instagram: m.instagram || null, facebook: m.facebook || null, phone: m.phone || null, active: m.active ?? true };
    if (m.id) return this.q(this.sb.from('members').update(row).eq('id', m.id));
    return this.q(this.sb.from('members').insert(row));
  }
  addMembers(rows) {
    return this.q(this.sb.from('members').insert(rows));
  }
  deleteMember(id) {
    return this.q(this.sb.from('members').delete().eq('id', id));
  }

  // Reports come back with their entries attached: { ...report, entries: [] }
  async listReports({ deptId, from, to } = {}) {
    let q = this.sb.from('reports').select('*, entries:report_entries(*)').order('service_date', { ascending: false });
    if (deptId) q = q.eq('department_id', deptId);
    if (from) q = q.gte('service_date', from);
    if (to) q = q.lte('service_date', to);
    return this.q(q);
  }
  async getReport(id) {
    return this.q(this.sb.from('reports').select('*, entries:report_entries(*)').eq('id', id).maybeSingle());
  }
  async findReport(deptId, type, date) {
    return this.q(
      this.sb.from('reports').select('id').eq('department_id', deptId).eq('report_type', type).eq('service_date', date).maybeSingle()
    );
  }
  async saveReport(report, entries) {
    return this.q(this.sb.rpc('save_report', { p_report: report, p_entries: entries }));
  }
  deleteReport(id) {
    return this.q(this.sb.from('reports').delete().eq('id', id));
  }

  async listTasks({ deptId, from, to } = {}) {
    let q = this.sb.from('tasks').select('*, assignments:task_assignments(*)').order('due_date', { ascending: false });
    if (deptId) q = q.eq('department_id', deptId);
    if (from) q = q.gte('due_date', from);
    if (to) q = q.lte('due_date', to);
    return this.q(q);
  }
  // submittedIds (optional): who has submitted — everyone else is marked not submitted.
  async saveTask(task, memberIds, submittedIds) {
    const row = { department_id: task.department_id, title: task.title, details: task.details || null, due_date: task.due_date };
    let id = task.id;
    if (id) await this.q(this.sb.from('tasks').update(row).eq('id', id));
    else id = (await this.q(this.sb.from('tasks').insert(row).select('id').single())).id;
    const existing = await this.q(this.sb.from('task_assignments').select('member_id').eq('task_id', id));
    const have = new Set(existing.map((a) => a.member_id));
    const want = new Set(memberIds);
    const remove = [...have].filter((m) => !want.has(m));
    const add = [...want].filter((m) => !have.has(m)).map((member_id) => ({ task_id: id, member_id }));
    if (remove.length) await this.q(this.sb.from('task_assignments').delete().eq('task_id', id).in('member_id', remove));
    if (add.length) await this.q(this.sb.from('task_assignments').insert(add));
    if (submittedIds) {
      const yes = [...submittedIds];
      const now = new Date().toISOString();
      if (yes.length) await this.q(this.sb.from('task_assignments').update({ done: true, done_at: now }).eq('task_id', id).eq('done', false).in('member_id', yes));
      let no = this.sb.from('task_assignments').update({ done: false, done_at: null }).eq('task_id', id).eq('done', true);
      if (yes.length) no = no.not('member_id', 'in', `(${yes.join(',')})`);
      await this.q(no);
    }
    return id;
  }
  setTaskDone(taskId, memberId, done) {
    return this.q(
      this.sb.from('task_assignments').update({ done, done_at: done ? new Date().toISOString() : null }).eq('task_id', taskId).eq('member_id', memberId)
    );
  }
  deleteTask(id) {
    return this.q(this.sb.from('tasks').delete().eq('id', id));
  }
}

// ─── Demo (localStorage) ───────────────────────────────────────────────────

const DEMO_KEY = 'coza-reports-demo-v1';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now());

class DemoStore {
  constructor() {
    this.db = this.load();
  }
  load() {
    try {
      const raw = localStorage.getItem(DEMO_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    const db = seedDemo();
    this.persist(db);
    return db;
  }
  persist(db = this.db) {
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify(db));
    } catch {}
  }
  reset() {
    try {
      localStorage.removeItem(DEMO_KEY);
    } catch {}
    this.db = this.load();
  }
  async getUser() {
    return { id: this.db.session };
  }
  async signIn() {}
  async signUp() {
    return { needsConfirm: false };
  }
  async resetPassword() {}
  async signOut() {}
  async getProfile() {
    return this.db.profiles.find((p) => p.id === this.db.session) ?? null;
  }
  switchUser(id) {
    this.db.session = id;
    this.persist();
  }

  async listDepartments() {
    return [...this.db.departments].sort((a, b) => a.name.localeCompare(b.name));
  }
  async saveDepartment(d) {
    if (d.id) Object.assign(this.db.departments.find((x) => x.id === d.id), { name: d.name, head_name: d.head_name, report_types: d.report_types });
    else this.db.departments.push({ id: uid(), name: d.name, head_name: d.head_name, report_types: d.report_types ?? ALL_REPORT_TYPE_KEYS });
    this.persist();
  }
  async deleteDepartment(id) {
    this.db.departments = this.db.departments.filter((d) => d.id !== id);
    this.persist();
  }
  async listProfiles() {
    return this.db.profiles;
  }
  async updateProfile(id, patch) {
    Object.assign(this.db.profiles.find((p) => p.id === id), patch);
    this.persist();
  }
  async deleteProfile(id) {
    this.db.profiles = this.db.profiles.filter((p) => p.id !== id);
    this.persist();
  }
  async listInvites() {
    return (this.db.invites ??= []);
  }
  async saveInvite(inv) {
    this.db.invites = [...(this.db.invites ?? []).filter((i) => i.email !== inv.email), { ...inv, created_at: new Date().toISOString() }];
    this.persist();
  }
  async deleteInvite(email) {
    this.db.invites = (this.db.invites ?? []).filter((i) => i.email !== email);
    this.persist();
  }

  async listMembers(deptId) {
    return this.db.members.filter((m) => !deptId || m.department_id === deptId).sort((a, b) => a.full_name.localeCompare(b.full_name));
  }
  async saveMember(m) {
    if (m.id) Object.assign(this.db.members.find((x) => x.id === m.id), m);
    else this.db.members.push({ active: true, ...m, id: uid() });
    this.persist();
  }
  async addMembers(rows) {
    rows.forEach((r) => this.db.members.push({ active: true, ...r, id: uid() }));
    this.persist();
  }
  async deleteMember(id) {
    this.db.members = this.db.members.filter((m) => m.id !== id);
    this.db.reports.forEach((r) => (r.entries = r.entries.filter((e) => e.member_id !== id)));
    this.persist();
  }

  async listReports({ deptId, from, to } = {}) {
    return this.db.reports
      .filter((r) => (!deptId || r.department_id === deptId) && (!from || r.service_date >= from) && (!to || r.service_date <= to))
      .sort((a, b) => b.service_date.localeCompare(a.service_date));
  }
  async getReport(id) {
    return structuredClone(this.db.reports.find((r) => r.id === id) ?? null);
  }
  async findReport(deptId, type, date) {
    return this.db.reports.find((r) => r.department_id === deptId && r.report_type === type && r.service_date === date) ?? null;
  }
  async saveReport(report, entries) {
    const id = report.id ?? uid();
    const row = { ...report, id, entries, updated_at: new Date().toISOString() };
    const i = this.db.reports.findIndex((r) => r.id === id);
    if (i >= 0) this.db.reports[i] = row;
    else this.db.reports.push(row);
    this.persist();
    return id;
  }
  async deleteReport(id) {
    this.db.reports = this.db.reports.filter((r) => r.id !== id);
    this.persist();
  }

  async listTasks({ deptId, from, to } = {}) {
    return this.db.tasks
      .filter((t) => (!deptId || t.department_id === deptId) && (!from || t.due_date >= from) && (!to || t.due_date <= to))
      .sort((a, b) => b.due_date.localeCompare(a.due_date));
  }
  async saveTask(task, memberIds, submittedIds) {
    let t = task.id && this.db.tasks.find((x) => x.id === task.id);
    if (!t) {
      t = { id: uid(), assignments: [], created_at: new Date().toISOString() };
      this.db.tasks.push(t);
    }
    Object.assign(t, { department_id: task.department_id, title: task.title, details: task.details, due_date: task.due_date });
    const prev = new Map(t.assignments.map((a) => [a.member_id, a]));
    t.assignments = memberIds.map((member_id) => prev.get(member_id) ?? { task_id: t.id, member_id, done: false, done_at: null });
    if (submittedIds) {
      const yes = new Set(submittedIds);
      t.assignments.forEach((a) => {
        if (a.done !== yes.has(a.member_id)) Object.assign(a, { done: yes.has(a.member_id), done_at: yes.has(a.member_id) ? new Date().toISOString() : null });
      });
    }
    this.persist();
    return t.id;
  }
  async setTaskDone(taskId, memberId, done) {
    const a = this.db.tasks.find((t) => t.id === taskId).assignments.find((x) => x.member_id === memberId);
    a.done = done;
    a.done_at = done ? new Date().toISOString() : null;
    this.persist();
  }
  async deleteTask(id) {
    this.db.tasks = this.db.tasks.filter((t) => t.id !== id);
    this.persist();
  }
}

// Sample data: fictional names, ~8 weeks of reports with realistic variation.
function seedDemo() {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const pick = (weights) => {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let r = rnd() * total;
    for (const [k, w] of Object.entries(weights)) if ((r -= w) <= 0) return k;
    return Object.keys(weights)[0];
  };

  const childcare = { id: 'dept-childcare', name: 'Childcare Guzape', head_name: 'Childcare HOD (demo)', report_types: ALL_REPORT_TYPE_KEYS };
  const ushering = { id: 'dept-ushering', name: 'Ushering', report_types: ['sunday', 'tuesday', 'dominion', 'home_training'] };
  const names = {
    [childcare.id]: [
      'Ada Okafor', 'Bisi Adewale', 'Chioma Eze', 'Damilola Hassan', 'Ese Omoregie', 'Funmi Bello', 'Grace Udoh', 'Halima Musa',
      'Ifeoma Nwosu', 'Joy Akpan', 'Kemi Lawal', 'Lara Sanni', 'Mary Etim', 'Ngozi Obi', 'Ope Daniels', 'Precious Ike',
      'Ruth Garba', 'Sade Johnson', 'Tolu Ajayi', 'Uche Madu',
    ],
    [ushering.id]: ['Ayo Bankole', 'Bola Ogun', 'David Peters', 'Emeka Nnaji', 'Femi Adeola', 'Gbenga Yusuf', 'Hope Edet', 'Isaac Mark', 'Jude Okon', 'Kunle Ade', 'Lola Shittu', 'Mide Fash'],
  };
  const members = [];
  for (const [dept, list] of Object.entries(names))
    list.forEach((full_name) =>
      members.push({ id: uid(), department_id: dept, full_name, instagram: full_name.split(' ')[0].toLowerCase() + '_official', facebook: '', phone: '', active: true })
    );

  // Each member gets a "reliability" so the dashboard shows a believable spread.
  const rel = Object.fromEntries(members.map((m) => [m.id, 0.45 + rnd() * 0.55]));
  const reports = [];
  const today = new Date();
  for (const dept of [childcare, ushering]) {
    const roster = members.filter((m) => m.department_id === dept.id);
    for (let back = 0; back < 63; back++) {
      const day = addDays(today, -back);
      const date = isoDate(day);
      for (const key of dept.report_types) {
        const t = REPORT_TYPE_MAP[key];
        if (t.weekday !== day.getDay() || back === 0) continue;
        if (key === 'evangelism' && day.getDate() > 7) continue; // monthly outreach
        const entries = [];
        const notes = {};
        for (const s of t.sections) {
          if (s.kind === 'text') continue;
          if (s.kind === 'counts') {
            roster.forEach((m) => rnd() < rel[m.id] * 0.5 && entries.push({ member_id: m.id, section: s.key, category: null, value: 1 + Math.floor(rnd() * 3), remark: null }));
            continue;
          }
          roster.forEach((m) => {
            const r = rel[m.id];
            let cat = null;
            if (s.key === 'attendance' || s.key === 'prayer')
              cat = pick(Object.fromEntries(s.categories.map((c) => [c.key, { early: r * 6, present: r * 6, late_perm: 1, late: 1.6 - r, absent_perm: 0.5, absent: 1.4 - r }[c.key] ?? 0.5])));
            else if (s.key === 'contraventions') cat = rnd() < 0.04 ? 'contravention' : null;
            else if (s.key === 'evangelism') cat = pick({ participated: r * 4, excused: 0.6, not: 1.2 - r });
            else if (s.categories.length === 1) cat = rnd() < r ? s.categories[0].key : null;
            else cat = rnd() < r ? s.categories[0].key : rnd() < 0.5 ? s.categories[1].key : null;
            if (cat) entries.push({ member_id: m.id, section: s.key, category: cat, value: null, remark: cat === 'absent_perm' ? 'Travelled' : cat === 'contravention' ? 'Phone use during service' : null });
          });
        }
        reports.push({ id: uid(), department_id: dept.id, report_type: key, service_date: date, notes, status: 'submitted', entries, updated_at: day.toISOString() });
      }
    }
  }

  const tasks = [];
  const roster = members.filter((m) => m.department_id === childcare.id);
  [
    ['Submit weekly lesson plan', -20],
    ['Share service flyer on WhatsApp status', -13],
    ['Call two absent members', -6],
    ['Prepare Sunday craft materials', 2],
  ].forEach(([title, offset]) => {
    const id = uid();
    tasks.push({
      id,
      department_id: childcare.id,
      title,
      details: '',
      due_date: isoDate(addDays(today, offset)),
      assignments: roster.map((m) => ({ task_id: id, member_id: m.id, done: offset < 0 && rnd() < rel[m.id], done_at: null })),
    });
  });

  const profiles = [
    { id: 'demo-global', email: 'pastor@example.org', full_name: 'Global Admin (demo)', role: 'global_admin', department_id: null },
    { id: 'demo-childcare', email: 'hod.childcare@example.org', full_name: 'Childcare HOD (demo)', role: 'dept_admin', department_id: childcare.id },
    { id: 'demo-pending', email: 'new.hod@example.org', full_name: 'New sign-up (demo)', role: 'pending', department_id: null },
  ];
  return { session: 'demo-global', departments: [childcare, ushering], members, reports, tasks, profiles };
}

export const store = IS_DEMO ? new DemoStore() : new SupabaseStore();
