// Turns a month of reports + tasks into per-member scorecards and
// department-level stats. All rules come from the `score`/`stat` fields in
// templates.js, so changing a template changes the scoring with it.
import { REPORT_TYPE_MAP, PILLARS, SOULS_MONTHLY_TARGET } from './templates.js?v=202610061436';

const emptyStats = () => ({ souls: 0, late: 0, absent: 0, excused: 0, served: 0, prayer: 0, prayer_missed: 0, evangelism: 0, contravention: 0, post: 0, tasks_done: 0, tasks_total: 0 });

export function computeScorecards(members, reports, tasks) {
  const cards = new Map(
    members.map((m) => [m.id, { member: m, stats: emptyStats(), sums: Object.fromEntries(PILLARS.map((p) => [p.key, { got: 0, n: 0 }])) }])
  );

  let soulsTracked = false;
  for (const r of reports) {
    const type = REPORT_TYPE_MAP[r.report_type];
    if (!type) continue;
    for (const s of type.sections) {
      if (s.kind === 'text') continue;
      if (s.score?.pillar === 'souls') soulsTracked = true;
      const bySection = new Map(r.entries.filter((e) => e.section === s.key).map((e) => [e.member_id, e]));
      if (s.kind === 'counts') {
        for (const [mid, e] of bySection) {
          const c = cards.get(mid);
          if (c && s.stat) c.stats[s.stat] += Number(e.value) || 0;
        }
        continue;
      }
      const cats = Object.fromEntries(s.categories.map((c) => [c.key, c]));
      for (const c of cards.values()) {
        const e = bySection.get(c.member.id);
        if (e) (cats[e.category]?.stat ?? []).forEach((k) => (c.stats[k] += 1));
        if (!s.score) continue;
        const v = e ? s.score.values[e.category] : s.score.missing;
        if (v == null) continue;
        c.sums[s.score.pillar].got += v;
        c.sums[s.score.pillar].n += 1;
      }
    }
  }

  for (const t of tasks)
    for (const a of t.assignments ?? []) {
      const c = cards.get(a.member_id);
      if (!c) continue;
      c.stats.tasks_total += 1;
      if (a.done) c.stats.tasks_done += 1;
    }

  for (const c of cards.values()) {
    c.pillars = {};
    let earned = 0;
    let possible = 0;
    for (const p of PILLARS) {
      let ratio = null;
      if (p.key === 'souls') ratio = soulsTracked ? Math.min(1, c.stats.souls / SOULS_MONTHLY_TARGET) : null;
      else if (p.key === 'goals') ratio = c.stats.tasks_total ? c.stats.tasks_done / c.stats.tasks_total : null;
      else if (c.sums[p.key].n) ratio = c.sums[p.key].got / c.sums[p.key].n;
      const points = ratio == null ? null : +(ratio * p.points).toFixed(2);
      c.pillars[p.key] = { points, max: p.points, pct: ratio == null ? null : Math.round(ratio * 100) };
      if (points != null) {
        earned += points;
        possible += p.points;
      }
    }
    c.earned = +earned.toFixed(2);
    c.possible = possible;
    c.overall = possible ? Math.round((earned / possible) * 100) : null;
  }
  return [...cards.values()];
}

// Category counts for the attendance section of every service report.
export function attendanceByReport(reports, memberCount) {
  return reports
    .filter((r) => REPORT_TYPE_MAP[r.report_type]?.group === 'service')
    .map((r) => {
      const counts = { early: 0, late_perm: 0, late: 0, absent_perm: 0, absent: 0 };
      r.entries.filter((e) => e.section === 'attendance').forEach((e) => (counts[e.category] = (counts[e.category] ?? 0) + 1));
      const recorded = Object.values(counts).reduce((a, b) => a + b, 0);
      return { report: r, counts, recorded, unrecorded: Math.max(0, memberCount - recorded) };
    })
    .sort((a, b) => a.report.service_date.localeCompare(b.report.service_date));
}
