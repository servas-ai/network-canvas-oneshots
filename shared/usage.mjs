// SERVAS-2071 shared usage analytics for /api/usage payloads (usage/, later
// others). Pure, no I/O. Ratios without a denominator stay null (UNKNOWN),
// never 0 %, so the UI cannot show an invented rate.

// Share of cached input in all input the provider saw.
export function cacheRate(t) {
  const seen = (t?.input ?? 0) + (t?.cachedInput ?? 0);
  return seen > 0 ? (t.cachedInput / seen) * 100 : null;
}

// Today (UTC, still running) vs. the full previous UTC day. No percentage
// delta: a partial day against a full day would read as a drop.
export function dayCompare(byDay = []) {
  const today = byDay.at(-1) ?? null, prev = byDay.at(-2) ?? null;
  return Object.freeze({ day: today?.day ?? null, today: today ? today.total : null,
    yesterday: prev ? prev.total : null });
}

// Rolling 24 h ending in the current UTC hour: byHourUtc is indexed by UTC
// clock hour, so rotate it to put the hour after `now` first.
export function rollingHours(byHourUtc = [], now = Date.now()) {
  if (byHourUtc.length !== 24) return [];
  const start = (new Date(now).getUTCHours() + 1) % 24;
  return Array.from({ length: 24 }, (_, i) => {
    const h = (start + i) % 24;
    return Object.freeze({ hour: h, label: `${String(h).padStart(2, '0')} UTC`, value: byHourUtc[h] ?? 0 });
  });
}

// Group model rows (byModel) by key, with share of total tokens.
export function shares(rows = [], key = 'model') {
  const groups = new Map();
  for (const r of rows) {
    const g = groups.get(r[key]) ?? { label: r[key], requests: 0, total: 0, cachedInput: 0 };
    g.requests += r.requests; g.total += r.total; g.cachedInput += r.cachedInput;
    groups.set(r[key], g);
  }
  const sum = [...groups.values()].reduce((s, g) => s + g.total, 0);
  return [...groups.values()].sort((a, b) => b.total - a.total)
    .map(g => Object.freeze({ ...g, share: sum > 0 ? (g.total / sum) * 100 : null }));
}
