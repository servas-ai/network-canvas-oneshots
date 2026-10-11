// SERVAS-2071 local gateway nodes for /api/gateways (cpa/). TCP reachability
// only, via probePort: no request goes through a gateway, no management key,
// no provider call. Ports are the ones of the mockups, overridable per env.
import { probePort } from './opencodex.mjs';

export const NODES = Object.freeze([
  Object.freeze({ id: 'cliproxyapi', label: 'CLIProxyAPI', env: 'CPA_PORT', port: 8317 }),
  Object.freeze({ id: 'opencodex', label: 'OpenCodex', env: 'OPENCODEX_PORT', port: 10100 }),
]);

export async function collectGateways({ nodes = NODES, env = process.env, probe = probePort } = {}) {
  const probes = await Promise.all(nodes.map(n => probe(Number(env[n.env]) || n.port)));
  return { generatedAt: new Date().toISOString(), nodes: nodes.map((n, i) => ({ id: n.id, label: n.label, ...probes[i] })) };
}
