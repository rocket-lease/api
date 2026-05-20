// Refuses to install if the contracts repo is not cloned next to api/.
// The api consumes @rocket-lease/contracts as a `link:../contracts` dep —
// see api/docs/adr/0007-contracts-as-source.md.

const fs = require('node:fs');
const path = require('node:path');

const contractsPath = path.resolve(__dirname, '..', '..', 'contracts');
const pkgPath = path.join(contractsPath, 'package.json');

if (!fs.existsSync(pkgPath)) {
  console.error('');
  console.error('  Falta el repo "contracts" como hermano de api/.');
  console.error('');
  console.error('  Esperaba encontrar:  ' + pkgPath);
  console.error('');
  console.error('  Cloná el repo:');
  console.error('    git clone git@github.com:rocket-lease/contracts.git ' + contractsPath);
  console.error('');
  console.error('  Detalles: api/docs/adr/0007-contracts-as-source.md');
  console.error('');
  process.exit(1);
}
