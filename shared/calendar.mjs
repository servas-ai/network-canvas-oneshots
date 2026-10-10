// SERVAS-2071 shared calendar math for day-series surfaces (Tokscale year
// grid, streaks). Pure, no DOM: input is collect.mjs byDay [{day,total}]
// with contiguous UTC days, oldest first.

const DAY = 86400000;
const utc = day => Date.parse(`${day}T00:00:00Z`);

// Columns of 7 cells, Monday first (ISO). Leading/trailing cells outside the
// series are null so the grid never invents zero-days.
export function calendarWeeks(byDay) {
  if (!byDay.length) return [];
  const lead = (new Date(utc(byDay[0].day)).getUTCDay() + 6) % 7;
  const cells = [...Array(lead).fill(null), ...byDay];
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// 0 = no usage; 1..4 by quartile of active days, so one outlier day does not
// flatten the rest of the year.
export function levelScale(byDay) {
  const active = byDay.map(d => d.total).filter(v => v > 0).sort((a, b) => a - b);
  if (!active.length) return total => (total > 0 ? 1 : 0);
  const q = [0.25, 0.5, 0.75].map(p => active[Math.max(0, Math.ceil(p * active.length) - 1)]);
  return total => (!(total > 0) ? 0 : total <= q[0] ? 1 : total <= q[1] ? 2 : total <= q[2] ? 3 : 4);
}

export function dayStats(byDay) {
  const active = byDay.filter(d => d.total > 0);
  const sum = active.reduce((s, d) => s + d.total, 0);
  const peak = active.reduce((p, d) => (!p || d.total > p.total ? d : p), null);
  // A streak still counts while today has no usage yet; it breaks on yesterday.
  let current = 0;
  for (let i = byDay.length - 1; i >= 0; i--) {
    if (byDay[i].total > 0) current++;
    else if (i === byDay.length - 1) continue;
    else break;
  }
  let longest = 0, run = 0, prev = NaN;
  for (const d of byDay) {
    run = d.total > 0 ? (utc(d.day) - prev === DAY ? run + 1 : 1) : 0;
    if (d.total > 0) prev = utc(d.day);
    longest = Math.max(longest, run);
  }
  return { days: byDay.length, activeDays: active.length, total: sum,
    avgPerActiveDay: active.length ? sum / active.length : null, peak, currentStreak: current, longestStreak: longest };
}

// First week index where a month starts, for column labels.
export function monthMarks(weeks) {
  const marks = [];
  weeks.forEach((week, i) => {
    const first = week.find(c => c && c.day.endsWith('-01'));
    if (first || (i === 0 && week.some(Boolean))) {
      const day = (first ?? week.find(Boolean)).day;
      if (!marks.length || marks.at(-1).month !== day.slice(0, 7)) marks.push({ week: i, month: day.slice(0, 7) });
    }
  });
  return marks;
}
