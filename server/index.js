import http from 'node:http';
import { loadLocalEnv, readConfig } from './config.js';
import { OkxAtkClient } from './okx-atk.js';
import { MarketService } from './market-service.js';
import { OrderService } from './order-service.js';
import { AvalancheService } from './avalanche-service.js';
import { VenueService } from './venue-service.js';
import { LocalAgentService } from './agent-service.js';
import { createHandler } from './app.js';

loadLocalEnv();
const config = readConfig();
const atkClient = new OkxAtkClient({ cliPath: config.okxCliPath, profile: config.okxProfile });
const marketService = new MarketService({ atkClient });
const orderService = new OrderService({
  marketService, atkClient, enableOrders: config.enableOkxOrders,
  maxOrderTry: config.maxOrderTry, approvalTtlMs: config.approvalTtlMs
});
const avalancheService = new AvalancheService({
  rpcUrl: config.fujiRpcUrl, privateKey: config.fujiPrivateKey, ledgerAddress: config.ledgerAddress
});
const venueService = new VenueService({ marketService });
const agentService = new LocalAgentService({
  marketService, storagePath: config.agentStatePath, intervalMs: config.agentIntervalMs,
  policy: { budgetTry: config.agentBudgetTry, maxPremiumPct: config.agentMaxPremiumPct },
  initialTry: config.paperInitialTry, paperFeePct: config.paperFeePct,
  maxTradesPerDay: config.paperMaxTradesPerDay, cooldownMs: config.paperCooldownMs,
  maxExposureTry: config.paperMaxExposureTry
});
const server = http.createServer(createHandler({ marketService, orderService, avalancheService, venueService, agentService }));
server.listen(config.port, '127.0.0.1', () => {
  console.log(`Köprü çalışıyor: http://127.0.0.1:${config.port}`);
  console.log(`Gerçek emir: ${config.enableOkxOrders ? 'AÇIK' : 'KAPALI'}`);
  console.log(`Yerel paper agent: ${config.agentAutoStart ? 'OTOMATİK' : 'ELLE'}`);
  if (config.agentAutoStart) agentService.start();
});

for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  agentService.stop();
  server.close(() => process.exit(0));
});
