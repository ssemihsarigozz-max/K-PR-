import { loadLocalEnv, readConfig } from '../server/config.js';

loadLocalEnv();
const config = readConfig();
const action = process.argv[2] || 'status';
const allowed = new Set(['status', 'start', 'stop', 'run']);
if (!allowed.has(action)) throw new Error('Kullanım: node scripts/agent-control.js status|start|stop|run');
const method = action === 'status' ? 'GET' : 'POST';
const response = await fetch(`http://127.0.0.1:${config.port}/api/agent/${action}`, { method });
const data = await response.json();
if (!response.ok) throw new Error(data.error || 'Agent komutu başarısız.');
console.log(JSON.stringify(data, null, 2));
