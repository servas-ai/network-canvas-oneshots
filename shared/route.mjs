// SERVAS-2071 pure Claude Code Router route selection, same order as CCR's
// router: long context above the threshold, then background for Haiku
// requests, else default. Think and web search depend on request fields the
// session logs do not keep, so they are never inferred.
export const CCR_THRESHOLD = 60000;

export function threshold(config) {
  return config?.longContextThreshold ?? CCR_THRESHOLD;
}

// req: { model, prompt } with prompt = input tokens of the request (fresh +
// cache). rules: whitelisted config rules or null (no CCR config: what CCR's
// defaults would pick, longContext/background only count when configured).
// Returns null when the request carries no prompt size.
export function routeFor(req, rules, limit = CCR_THRESHOLD) {
  if (!Number.isFinite(req?.prompt)) return null;
  if (req.prompt > limit && rules?.longContext) return 'longContext';
  if (typeof req.model === 'string' && req.model.includes('haiku') && rules?.background) return 'background';
  return 'default';
}

// Requests above the threshold from the prompt histogram (buckets
// { upTo, requests }, upTo null = open end). Exact only when the threshold is
// a bucket edge; otherwise null, never an estimate.
export function aboveThreshold(buckets, limit = CCR_THRESHOLD) {
  if (!Array.isArray(buckets) || !buckets.length) return null;
  const edges = buckets.map(b => b.upTo).filter(Number.isFinite);
  if (!edges.includes(limit)) return null;
  return buckets.filter(b => b.upTo === null || b.upTo > limit).reduce((s, b) => s + b.requests, 0);
}

// Share in percent of all requests in the histogram, null without requests.
export function share(part, buckets) {
  const all = (buckets ?? []).reduce((s, b) => s + b.requests, 0);
  return Number.isFinite(part) && all > 0 ? (part / all) * 100 : null;
}

// Claude Code requests in the window per rule. hits: what matches the rule's
// condition, configured or not; routed: where this config sends them (rules
// that are not configured fall through to default). think/webSearch stay null:
// the logs do not keep thinking or tool flags of the request.
export function ruleHits(usage, config) {
  const claude = (usage?.byModel ?? []).filter(r => r.source === 'claude');
  const requests = claude.reduce((s, r) => s + r.requests, 0);
  const haiku = claude.filter(r => r.model.includes('haiku')).reduce((s, r) => s + r.requests, 0);
  const long = aboveThreshold(usage?.claudePrompts, threshold(config));
  const rules = config?.valid ? config.rules : null;
  const lc = rules?.longContext ? long : 0, bg = rules?.background ? haiku : 0;
  // a long Haiku request goes to longContext first; without per-request data
  // the overlap is unknown, so default is only exact when one side is empty
  const overlap = Boolean(rules?.longContext && rules?.background && haiku > 0 && long !== 0);
  return {
    requests,
    hits: { default: requests, background: haiku, think: null, longContext: long, webSearch: null },
    routed: { default: overlap || lc === null ? null : requests - lc - bg, background: overlap ? null : bg,
      think: null, longContext: lc, webSearch: null },
  };
}
