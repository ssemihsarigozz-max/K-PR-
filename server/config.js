import fs from 'node:fs';
import path from 'node:path';

export function loadLocalEnv(file = path.resolve('.env.local')) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

export function readConfig(env = process.env) {
  return {
    port: toInteger(env.PORT, 4173),
    okxCliPath: env.OKX_CLI_PATH || path.resolve('node_modules/@okx_ai/okx-trade-cli/dist/index.js'),
    okxProfile: env.OKX_PROFILE || 'demo',
    enableOkxOrders: env.ENABLE_OKX_ORDERS === 'true',
    maxOrderTry: toNumber(env.MAX_ORDER_TRY, 1000),
    approvalTtlMs: toInteger(env.APPROVAL_TTL_MS, 120_000),
    fujiRpcUrl: env.AVALANCHE_FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc',
    fujiPrivateKey: env.AVALANCHE_FUJI_PRIVATE_KEY || '',
    ledgerAddress: env.DECISION_LEDGER_ADDRESS || '',
    autoRecordFuji: env.AUTO_RECORD_FUJI === 'true'
  };
}

function toNumber(value, fallback) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function toInteger(value, fallback) { const parsed = Number.parseInt(value, 10); return Number.isInteger(parsed) ? parsed : fallback; }
