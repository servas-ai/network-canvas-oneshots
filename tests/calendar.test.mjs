import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarWeeks, levelScale, dayStats, monthMarks } from '../shared/calendar.mjs';
import { dayRange } from '../app/collect.mjs';

const series = (from, to, totals = {}) => dayRange(Date.parse(`${from}T00:00:00Z`), Date.parse(`${to}T00:00:00Z`))
  .map(day => ({ day, total: totals[day] ?? 0 }));

test('weeks are Monday-first columns of 7 with null padding, no invented days', () => {
  // 2026-10-01 is a Thursday -> 3 leading nulls.
  const w = calendarWeeks(series('2026-10-01', '2026-10-10'));
  assert.equal(w.length, 2);
  assert.deepEqual(w[0].slice(0, 4).map(c => c?.day ?? null), [null, null, null, '2026-10-01']);
  assert.equal(w.flat().filter(Boolean).length, 10);
  assert.equal(w[1].at(-1), null);
  assert.deepEqual(calendarWeeks([]), []);
});

test('levels: zero stays 0, quartiles of active days give 1..4', () => {
  const s = series('2026-01-01', '2026-01-08', { '2026-01-01': 1, '2026-01-02': 2, '2026-01-03': 3, '2026-01-04': 1000 });
  const lv = levelScale(s);
  assert.deepEqual(s.slice(0, 5).map(d => lv(d.total)), [1, 2, 3, 4, 0]);
  assert.equal(levelScale([])(5), 1);
});

test('stats: active days, avg, peak, streak tolerates empty today, breaks on gap', () => {
  const s = series('2026-10-01', '2026-10-10', { '2026-10-02': 5, '2026-10-03': 5, '2026-10-04': 5,
    '2026-10-07': 10, '2026-10-08': 20, '2026-10-09': 30 });
  const st = dayStats(s);
  assert.equal(st.activeDays, 6); assert.equal(st.days, 10); assert.equal(st.total, 75);
  assert.equal(st.avgPerActiveDay, 12.5); assert.equal(st.peak.day, '2026-10-09');
  assert.equal(st.currentStreak, 3); assert.equal(st.longestStreak, 3);
  // Red control: a gap yesterday must end the current streak.
  assert.equal(dayStats(series('2026-10-01', '2026-10-10', { '2026-10-08': 1, '2026-10-10': 1 })).currentStreak, 1);
  assert.equal(dayStats(series('2026-10-01', '2026-10-10', { '2026-10-08': 1 })).currentStreak, 0);
  assert.deepEqual(dayStats([]), { days: 0, activeDays: 0, total: 0, avgPerActiveDay: null, peak: null, currentStreak: 0, longestStreak: 0 });
});

test('month marks: one label per month, in order', () => {
  const m = monthMarks(calendarWeeks(series('2025-12-20', '2026-03-05')));
  assert.deepEqual(m.map(x => x.month), ['2025-12', '2026-01', '2026-02', '2026-03']);
  assert.ok(m.every((x, i) => i === 0 || x.week > m[i - 1].week));
});
