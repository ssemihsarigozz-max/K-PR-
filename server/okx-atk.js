import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export class OkxAtkClient {
  constructor({ cliPath, profile = 'demo', executor = execFileAsync, timeoutMs = 15_000 }) {
    this.cliPath = cliPath;
    this.profile = profile;
    this.executor = executor;
    this.timeoutMs = timeoutMs;
  }

  async getTicker(instId, site) {
    const data = await this.#run(['--json', 'market', 'ticker', instId], { OKX_SITE: site });
    const ticker = Array.isArray(data) ? data[0] : data?.data?.[0];
    if (!ticker) throw new Error(`${instId} için ATK fiyatı bulunamadı.`);
    return ticker;
  }

  async placeMarketBuyTry({ instId = 'BTC-TRY', budgetTry, clientOrderId }) {
    return this.#run([
      '--profile', this.profile, '--json', 'spot', 'place',
      '--instId', instId, '--side', 'buy', '--ordType', 'market',
      '--sz', String(budgetTry), '--tdMode', 'cash', '--tgtCcy', 'quote_ccy',
      '--clOrdId', clientOrderId
    ], { OKX_SITE: 'tr' });
  }

  async getOrder({ instId = 'BTC-TRY', orderId, clientOrderId }) {
    const args = ['--profile', this.profile, '--json', 'spot', 'get', '--instId', instId];
    if (orderId) args.push('--ordId', String(orderId));
    else args.push('--clOrdId', clientOrderId);
    return this.#run(args, { OKX_SITE: 'tr' });
  }

  async #run(args, extraEnv) {
    try {
      const { stdout } = await this.executor(process.execPath, [this.cliPath, ...args], {
        env: { ...process.env, ...extraEnv }, timeout: this.timeoutMs, maxBuffer: 1024 * 1024
      });
      return JSON.parse(stdout);
    } catch (error) {
      const detail = error.stderr?.trim() || error.message;
      throw new Error(`OKX ATK çağrısı başarısız: ${detail}`);
    }
  }
}
