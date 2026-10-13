#!/usr/bin/env node
// SERVAS-2071 fixture server for the browser receipt: the real app server with
// repo fixtures only (tests/fixtures), no home directory, no provider, no probe
// of real ports. FIXTURE_CCR=config|none|broken picks the CCR config fixture.
import { fileURLToPath } from 'node:url';
import { createUsageServer } from '../app/server.mjs';
import { collectUsage } from '../app/collect.mjs';
import { collectRouter } from '../app/router.mjs';
import { readCatalog } from '../app/opencodex.mjs';

const fx = p => fileURLToPath(new URL(`../tests/fixtures/${p}`, import.meta.url));
const now = Date.parse('2026-10-10T00:00:00Z');
const down = async port => ({ host: '127.0.0.1', port, reachable: false, latencyMs: null, checkedAt: new Date().toISOString() });
const ccr = { config: 'ccr/config.json', none: 'ccr/none.json', broken: 'ccr/broken.json' }[process.env.FIXTURE_CCR ?? 'config'];

createUsageServer({
  collect: ({ days }) => collectUsage({ days, now, roots: { codex: fx('codex'), claude: fx('claude-router') } }),
  router: () => collectRouter({ configPath: fx(ccr), env: {}, probe: down }),
  opencodex: async () => ({ generatedAt: new Date().toISOString(), catalog: await readCatalog(fx('none.json')), gateway: await down(10100) }),
  gateways: async () => ({ generatedAt: new Date().toISOString(), nodes: [
    { id: 'cliproxyapi', label: 'CLIProxyAPI', ...(await down(8317)) }, { id: 'opencodex', label: 'OpenCodex', ...(await down(10100)) }] }),
}).listen(Number(process.env.PORT ?? 8874), '127.0.0.1', () => console.log(`fixture server :${process.env.PORT ?? 8874} ccr=${ccr}`));
