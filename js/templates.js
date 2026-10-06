// Report templates — one entry per sheet in the department's Excel template.
//
// Section kinds:
//   assign — members are sorted into categories. A member can sit in ONE category
//            per section only (picking Emma as "Early" removes her from every other
//            category in that section).
//   counts — a number per member (e.g. guest count).
//   text   — free text (HOD remarks, special report, any other report).
//
// `score` wires a section into the monthly scorecard:
//   pillar  — which scorecard pillar it feeds
//   values  — points (0–1) for each category; null = "excused, don't count"
//   missing — value for members not placed in any category (null = don't count)
// `stat` on a category feeds the scorecard's "Summary breakdown" counters.

const ATTENDANCE = {
  key: 'attendance',
  title: 'Attendance',
  kind: 'assign',
  categories: [
    { key: 'early', label: 'Early', tone: 'early', stat: ['served'] },
    { key: 'late_perm', label: 'Late with permission', tone: 'lateperm', stat: ['served', 'late'] },
    { key: 'late', label: 'Late without permission', tone: 'late', stat: ['served', 'late'] },
    { key: 'absent_perm', label: 'Absent with permission', tone: 'absentperm', remarks: true, stat: ['excused'] },
    { key: 'absent', label: 'Absent without permission', tone: 'absent', remarks: true, stat: ['absent'] },
  ],
  score: { pillar: 'attendance', values: { early: 1, late_perm: 0.8, late: 0.5, absent_perm: null, absent: 0 }, missing: null },
  fillRest: 'absent',
};

const CONTRAVENTIONS = {
  key: 'contraventions',
  title: 'Policy / operational contraventions',
  kind: 'assign',
  optional: true,
  emptyText: 'NONE OBSERVED',
  categories: [{ key: 'contravention', label: 'Contravention', tone: 'absent', remarks: true, stat: ['contravention'] }],
};

const postService = (attendedLabel) => ({
  key: 'post_service',
  title: 'Post service (Thanksgiving / Appraisal)',
  kind: 'assign',
  categories: [
    { key: 'attended', label: attendedLabel, tone: 'early' },
    { key: 'excused', label: 'Did not attend — with permission', tone: 'absentperm', remarks: true },
  ],
  score: { pillar: 'participation', values: { attended: 1, excused: null }, missing: 0 },
});

const compliance = (key, title) => ({
  key,
  title,
  kind: 'assign',
  optional: true,
  emptyText: 'NONE',
  categories: [{ key: 'complied', label: 'Complied', tone: 'early', stat: ['post'] }],
  score: { pillar: 'participation', values: { complied: 1 }, missing: 0 },
});

const text = (key, title, placeholder = 'NONE') => ({ key, title, kind: 'text', placeholder });

export const REPORT_TYPES = [
  {
    key: 'sunday',
    name: 'Sunday Service',
    short: 'Sunday',
    heading: 'SERVICE REPORT',
    service: 'SUNDAY',
    weekday: 0,
    group: 'service',
    sections: [
      ATTENDANCE,
      CONTRAVENTIONS,
      postService('Attended'),
      {
        key: 'guests',
        title: 'Individual guest count (Sunday invites for evangelism)',
        kind: 'counts',
        unit: 'guests',
        emptyText: 'NOT SENT',
        stat: 'souls',
        score: { pillar: 'souls' },
      },
      {
        key: 'pre_prayers',
        title: 'Pre-service prayers',
        kind: 'assign',
        categories: [
          { key: 'early', label: 'Early', tone: 'early', stat: ['prayer'] },
          { key: 'joined_later', label: 'Joined later', tone: 'lateperm', stat: ['prayer'] },
        ],
        score: { pillar: 'participation', values: { early: 1, joined_later: 0.75 }, missing: null },
      },
      text('hod_remarks', 'HOD remarks'),
      compliance('whatsapp', 'WhatsApp service post compliance'),
      compliance('social', 'Social media service post compliance'),
      text('other', 'Any other report'),
    ],
  },
  {
    key: 'tuesday',
    name: 'Tuesday Service',
    short: 'Tuesday',
    heading: 'SERVICE REPORT',
    service: 'TUESDAY',
    weekday: 2,
    group: 'service',
    sections: [
      ATTENDANCE,
      CONTRAVENTIONS,
      postService('Present'),
      text('special', 'Special report'),
      text('hod_remarks', 'HOD remarks'),
      compliance('whatsapp', 'WhatsApp service post compliance — before 3PM'),
      compliance('social', 'Social media service post compliance — before 3PM'),
      text('other', 'Any other report'),
    ],
  },
  {
    key: 'dominion',
    name: 'Dominion Hour',
    short: 'Dominion',
    heading: 'SERVICE REPORT',
    service: 'DOMINION HOUR',
    weekday: 1,
    group: 'service',
    sections: [ATTENDANCE, CONTRAVENTIONS, text('hod_remarks', 'HOD remarks'), text('other', 'Any other report')],
  },
  {
    key: 'home_training',
    name: 'Home Training',
    short: 'Home Training',
    heading: 'SERVICE REPORT',
    service: 'HOME TRAINING',
    weekday: 5,
    group: 'service',
    sections: [
      ATTENDANCE,
      CONTRAVENTIONS,
      postService('Attended'),
      text('special', 'Special report'),
      text('hod_remarks', 'HOD remarks'),
      text('other', 'Any other report'),
    ],
  },
  {
    key: 'evangelism',
    name: 'Evangelism',
    short: 'Evangelism',
    heading: 'EVANGELISM REPORT',
    weekday: 6,
    group: 'other',
    sections: [
      {
        key: 'evangelism',
        title: 'Participation',
        kind: 'assign',
        categories: [
          { key: 'participated', label: 'Participated', tone: 'early', stat: ['evangelism'] },
          { key: 'excused', label: 'Did not participate — excused', tone: 'absentperm', remarks: true },
          { key: 'not', label: 'Did not participate', tone: 'absent', remarks: true },
        ],
        score: { pillar: 'evangelism', values: { participated: 1, excused: null, not: 0 }, missing: null },
        fillRest: 'not',
      },
      {
        key: 'souls',
        title: 'Souls reached / invites',
        kind: 'counts',
        unit: 'souls',
        emptyText: 'NONE RECORDED',
        stat: 'souls',
        score: { pillar: 'souls' },
      },
      text('other', 'Remarks'),
    ],
  },
  {
    key: 'prayer_sat',
    name: 'Departmental Prayer (Sat)',
    short: 'Prayer · Sat',
    heading: 'PRAYER REPORT',
    subheading: '(DEPARTMENTAL PRAYER IN CHURCH)',
    weekday: 6,
    group: 'prayer',
    sections: [
      {
        key: 'prayer',
        title: 'Attendance',
        kind: 'assign',
        categories: [
          { key: 'present', label: 'Present', tone: 'early', stat: ['prayer'] },
          { key: 'absent_perm', label: 'Absent with permission', tone: 'absentperm', remarks: true },
          { key: 'absent', label: 'Absent without permission', tone: 'absent', remarks: true, stat: ['prayer_missed'] },
        ],
        score: { pillar: 'participation', values: { present: 1, absent_perm: null, absent: 0 }, missing: null },
        fillRest: 'absent',
      },
      text('other', 'Any other report'),
    ],
  },
  {
    key: 'prayer_sun',
    name: 'Prayer Call (Sun)',
    short: 'Prayer · Sun',
    heading: 'PRAYER REPORT',
    weekday: 0,
    group: 'prayer',
    sections: [
      {
        key: 'prayer',
        title: 'Attendance',
        kind: 'assign',
        categories: [
          { key: 'early', label: 'Joined early', tone: 'early', stat: ['prayer'] },
          { key: 'late', label: 'Joined late', tone: 'late', stat: ['prayer'] },
          { key: 'absent', label: 'Absent without permission', tone: 'absent', remarks: true, stat: ['prayer_missed'] },
          { key: 'absent_perm', label: 'Absent with permission', tone: 'absentperm', remarks: true },
        ],
        score: { pillar: 'participation', values: { early: 1, late: 0.75, absent: 0, absent_perm: null }, missing: null },
        fillRest: 'absent',
      },
      {
        key: 'engagement_prayers',
        title: 'Engagement — prayers',
        kind: 'assign',
        categories: [
          { key: 'active', label: 'Joined and active', tone: 'early' },
          { key: 'inactive', label: 'Joined and inactive', tone: 'late', remarks: true },
        ],
        score: { pillar: 'participation', values: { active: 1, inactive: 0.4 }, missing: null },
      },
      {
        key: 'engagement_review',
        title: 'Engagement — message review',
        kind: 'assign',
        categories: [
          { key: 'active', label: 'Joined and active', tone: 'early' },
          { key: 'inactive', label: 'Joined and inactive', tone: 'late', remarks: true },
        ],
        score: { pillar: 'participation', values: { active: 1, inactive: 0.4 }, missing: null },
      },
      text('other', 'Any other report'),
    ],
  },
];

export const REPORT_TYPE_MAP = Object.fromEntries(REPORT_TYPES.map((t) => [t.key, t]));
export const ALL_REPORT_TYPE_KEYS = REPORT_TYPES.map((t) => t.key);

// Scorecard pillars — points mirror the monthly member scorecard.
export const PILLARS = [
  { key: 'attendance', label: 'Attendance', points: 15, color: '#f5b82e', items: ['Service attendance', 'Punctuality', 'Accountability'] },
  { key: 'souls', label: 'Souls', points: 30, color: '#3fbf5f', items: ['Invites', 'Guests', 'Souls reached'] },
  { key: 'evangelism', label: 'Evangelism', points: 10, color: '#3fbf5f', items: ['Attendance', 'Participation', 'Engagement'] },
  { key: 'goals', label: 'Goals', points: 15, color: '#ef4f6b', items: ['Weekly goals', 'Task completion', 'Team reviews'] },
  { key: 'participation', label: 'Participation', points: 20, color: '#3b8ff0', items: ['Weekly prayers', 'Post-service', 'Social media engagement'] },
];

// Monthly souls/invites needed for full Souls points.
export const SOULS_MONTHLY_TARGET = 10;
