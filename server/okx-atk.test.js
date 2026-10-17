import test from 'node:test';
import assert from 'node:assert/strict';
import { OkxAtkClient } from './okx-atk.js';

test('ticker çağrısını doğru site ile ATK CLI üzerinden yapar', async () => {
  let captured;
  const executor = async (command, args, options) => {
    captured = { command, args, options };
    return { stdout: JSON.stringify([{ instId: 'BTC-TRY', askPx: '1', ts: '1' }]) };
  };
  const client = new OkxAtkClient({ cliPath: '/tmp/okx.js', executor });
  const result = await client.getTicker('BTC-TRY', 'tr');
  assert.equal(result.instId, 'BTC-TRY');
  assert.equal(captured.command, process.execPath);
  assert.deepEqual(captured.args, ['/tmp/okx.js', '--json', 'market', 'ticker', 'BTC-TRY']);
  assert.equal(captured.options.env.OKX_SITE, 'tr');
});

test('ATK hata ayrıntısını güvenli hata olarak döndürür', async () => {
  const executor = async () => { const error = new Error('exit'); error.stderr = 'bağlantı yok'; throw error; };
  const client = new OkxAtkClient({ cliPath: '/tmp/okx.js', executor });
  await assert.rejects(() => client.getTicker('BTC-TRY', 'tr'), /bağlantı yok/);
});
