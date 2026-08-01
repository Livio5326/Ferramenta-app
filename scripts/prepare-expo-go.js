const fs = require('fs');
const path = require('path');

const frontendDir = path.resolve(__dirname, '..', 'frontend');
const expoPackage = require.resolve('expo/package.json', {
  paths: [frontendDir],
});
const expoDir = path.dirname(expoPackage);
const cliPackage = require.resolve('@expo/cli/package.json', {
  paths: [expoDir],
});
const manifestMiddleware = path.join(
  path.dirname(cliPackage),
  'build',
  'src',
  'start',
  'server',
  'middleware',
  'ManifestMiddleware.js'
);

const original = fs.readFileSync(manifestMiddleware, 'utf8');
const legacySetting = "bytecode: engine === 'hermes',";
const compatibleSetting = 'bytecode: false,';

if (original.includes(legacySetting)) {
  fs.writeFileSync(
    manifestMiddleware,
    original.replace(legacySetting, compatibleSetting),
    'utf8'
  );
  console.log('Expo Go: bundle locale impostato su JavaScript standard.');
} else if (original.includes(compatibleSetting)) {
  console.log('Expo Go: compatibilita bundle locale gia configurata.');
} else {
  throw new Error(
    'Impossibile trovare l impostazione bytecode prevista nel CLI Expo.'
  );
}
