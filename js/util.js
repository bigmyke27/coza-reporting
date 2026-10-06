// Small shared helpers. Dates are handled as local YYYY-MM-DD strings
// (never toISOString, which shifts to UTC and can land on the wrong day).

export const pad = (n) => String(n).padStart(2, '0');
export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDate = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const today = () => isoDate(new Date());

// Most recent date (today or earlier) that falls on `weekday` (0 = Sunday).
export const lastWeekday = (weekday) => {
  const d = new Date();
  if (weekday == null) return isoDate(d);
  while (d.getDay() !== weekday) d.setDate(d.getDate() - 1);
  return isoDate(d);
};

export const monthKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const monthRange = (key) => {
  const [y, m] = key.split('-').map(Number);
  return { from: `${key}-01`, to: isoDate(new Date(y, m, 0)) };
};
export const shiftMonth = (key, n) => {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + n, 1));
};
export const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};
export const fmtDate = (s, opts = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) =>
  parseDate(s).toLocaleDateString('en-GB', opts);

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

export const pct = (n, d) => (d ? Math.round((n / d) * 100) : null);

export function downloadFile(name, content, type = 'text/csv') {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const toCsv = (rows) =>
  rows.map((r) => r.map((c) => (/[",\n]/.test(String(c ?? '')) ? `"${String(c).replace(/"/g, '""')}"` : c ?? '')).join(',')).join('\n');
