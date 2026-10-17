import { evaluateDecision } from './decision.js';
import { getDemoPrices } from './market-data.js';

const policy = { budgetTry: 1000, maxPremiumPct: 0.8 };
const result = evaluateDecision({ prices: getDemoPrices(), policy });

console.log(`Karar: ${result.decision}`);
console.log(`Neden: ${result.reason}`);
