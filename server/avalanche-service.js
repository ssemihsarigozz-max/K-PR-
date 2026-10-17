import { Contract, JsonRpcProvider, Wallet, getAddress, isAddress, solidityPackedKeccak256 } from 'ethers';

export const FUJI_CHAIN_ID = 43113;
export const LEDGER_ABI = [
  'function record(bytes32 decisionHash,string decision,uint256 globalBtcUsdtE8,uint256 usdtTryE8,uint256 trBtcTryAskE8,int256 premiumBps,uint256 observedAt)',
  'event DecisionRecorded(bytes32 indexed decisionHash,string decision,uint256 globalBtcUsdtE8,uint256 usdtTryE8,uint256 trBtcTryAskE8,int256 premiumBps,uint256 observedAt,uint256 recordedAt)'
];

export class AvalancheService {
  constructor({ rpcUrl, privateKey, ledgerAddress, provider, wallet }) {
    this.provider = provider || new JsonRpcProvider(rpcUrl);
    this.wallet = wallet || (privateKey ? new Wallet(privateKey, this.provider) : null);
    this.ledgerAddress = ledgerAddress && isAddress(ledgerAddress) ? getAddress(ledgerAddress) : '';
  }

  get configured() { return Boolean(this.wallet && this.ledgerAddress); }

  async health() {
    const network = await this.provider.getNetwork();
    return { chainId: Number(network.chainId), configured: this.configured, ledgerAddress: this.ledgerAddress || null };
  }

  async record(decision) {
    if (!this.configured) throw new Error('Fuji cüzdanı veya kontrat adresi yapılandırılmadı.');
    const network = await this.provider.getNetwork();
    if (Number(network.chainId) !== FUJI_CHAIN_ID) throw new Error(`Yanlış ağ: ${network.chainId}. Fuji ${FUJI_CHAIN_ID} bekleniyor.`);
    const summary = toLedgerSummary(decision);
    const contract = new Contract(this.ledgerAddress, LEDGER_ABI, this.wallet);
    const transaction = await contract.record(
      summary.hash, summary.decision, summary.globalBtcUsdtE8, summary.usdtTryE8,
      summary.trBtcTryAskE8, summary.premiumBps, summary.observedAt
    );
    const receipt = await transaction.wait();
    return {
      hash: transaction.hash,
      blockNumber: receipt.blockNumber,
      explorerUrl: `https://explorer-test.avax.network/c-chain/tx/${transaction.hash}`,
      decisionHash: summary.hash
    };
  }
}

export function toLedgerSummary(result) {
  if (result?.status !== 'OK') throw new Error('Yalnızca geçerli kararlar Fuji’ye kaydedilebilir.');
  const globalBtcUsdtE8 = scaleE8(result.prices.globalBtcUsdt.value);
  const usdtTryE8 = scaleE8(result.prices.usdtTry.value);
  const trBtcTryAskE8 = scaleE8(result.prices.trBtcTryAsk.value);
  const premiumBps = BigInt(Math.round(result.premiumPct * 100));
  const observedAt = BigInt(Math.floor(new Date(result.checkedAt).getTime() / 1000));
  const hash = solidityPackedKeccak256(
    ['string', 'uint256', 'uint256', 'uint256', 'int256', 'uint256'],
    [result.decision, globalBtcUsdtE8, usdtTryE8, trBtcTryAskE8, premiumBps, observedAt]
  );
  return { hash, decision: result.decision, globalBtcUsdtE8, usdtTryE8, trBtcTryAskE8, premiumBps, observedAt };
}

function scaleE8(value) { return BigInt(Math.round(Number(value) * 1e8)); }
