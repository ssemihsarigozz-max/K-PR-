import fs from 'node:fs';
import path from 'node:path';
import { Wallet } from 'ethers';

const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath) && /AVALANCHE_FUJI_PRIVATE_KEY=\S+/.test(fs.readFileSync(envPath, 'utf8'))) {
  throw new Error('.env.local içinde zaten bir Fuji özel anahtarı var; üzerine yazılmadı.');
}
const wallet = Wallet.createRandom();
const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8').trimEnd() + '\n' : '';
fs.writeFileSync(envPath, `${existing}AVALANCHE_FUJI_PRIVATE_KEY=${wallet.privateKey}\n`, { mode: 0o600 });
console.log(`Fuji test cüzdanı oluşturuldu: ${wallet.address}`);
console.log('Özel anahtar yalnızca .env.local içine yazıldı ve Git tarafından yok sayılıyor.');
