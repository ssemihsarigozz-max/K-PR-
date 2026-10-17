import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';

const sourcePath = path.resolve('contracts/DecisionLedger.sol');
const input = {
  language: 'Solidity',
  sources: { 'DecisionLedger.sol': { content: fs.readFileSync(sourcePath, 'utf8') } },
  settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } }
};
const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (output.errors || []).filter((item) => item.severity === 'error');
if (errors.length) throw new Error(errors.map((item) => item.formattedMessage).join('\n'));
const contract = output.contracts['DecisionLedger.sol'].DecisionLedger;
const artifactDir = path.resolve('artifacts');
fs.mkdirSync(artifactDir, { recursive: true });
fs.writeFileSync(path.join(artifactDir, 'DecisionLedger.json'), JSON.stringify({
  contractName: 'DecisionLedger', abi: contract.abi, bytecode: `0x${contract.evm.bytecode.object}`
}, null, 2));
console.log(`DecisionLedger derlendi (solc ${solc.version()}).`);
