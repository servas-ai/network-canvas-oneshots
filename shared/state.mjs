// SERVAS-2071 shared observation state. Same semantics as the radar tool-ui
// contract toolState (servas-ai/radar PR541 @454321f3cbb7d4369a97c0888035eaa22f1fe374,
// independently verified P1 PASS): values without source/valid timestamp are
// withheld as unknown; old observations stay visible as stale. Pure, no I/O.

const icons = Object.freeze({ unknown: 'circle-help', stale: 'clock',
  loading: 'loader-circle', error: 'triangle-alert', ready: 'circle-check' });
const labels = Object.freeze({ unknown: 'Unbekannt', stale: 'Veraltet',
  loading: 'Wird geladen', error: 'Nicht verfügbar', ready: 'Aktuell' });
export const STATES = Object.freeze(Object.keys(labels));

export function observationTime(value) {
  const match = typeof value === 'string'
    ? /^(\d{4})-(\d{2})-(\d{2})T.*(?:Z|[+-]\d{2}:\d{2})$/.exec(value) : null;
  if (!match) return NaN;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  // Validate the written calendar date before Date.parse can normalize it.
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1]) return NaN;
  return Date.parse(value);
}

export function observe(input = {}, { now = Date.now(), maxAgeMs = 60000 } = {}) {
  if (!Number.isFinite(now) || !Number.isFinite(maxAgeMs) || maxAgeMs < 0) {
    throw new RangeError('Finite time and nonnegative age policy required');
  }
  const data = input && typeof input === 'object' ? input : {};
  const source = typeof data.source === 'string' && data.source.trim() ? data.source.trim() : null;
  const timestamp = observationTime(data.observedAt);
  const observedAt = Number.isFinite(timestamp) && timestamp <= now ? data.observedAt : null;
  const valid = source !== null && observedAt !== null && data.value !== null && data.value !== undefined;
  const state = data.error ? 'error' : data.loading ? 'loading' : !valid ? 'unknown'
    : now - timestamp > maxAgeMs ? 'stale' : 'ready';
  return Object.freeze({ state, value: state === 'ready' || state === 'stale' ? data.value : null,
    source, observedAt, icon: icons[state], label: labels[state] });
}
