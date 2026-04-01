'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'smx-tdb', 'dist', 'smx-tdb', 'browser');
const dest = path.join(root, 'api', 'ui');

if (!fs.existsSync(src)) {
  console.error('Angular build output not found:', src);
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
fs.cpSync(src, dest, { recursive: true });
console.log('Copied UI to', dest);
