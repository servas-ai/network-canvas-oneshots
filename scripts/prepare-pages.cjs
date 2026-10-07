const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

// Build first: docs is the versioned GitHub Pages publication directory.
execFileSync(process.execPath, ['scripts/build.cjs'], { stdio: 'inherit' });
fs.mkdirSync('docs', { recursive: true });
fs.cpSync('dist', 'docs', { recursive: true });
fs.writeFileSync('docs/.nojekyll', '');
const hashes = {};
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else hashes[path.relative('dist', file)] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  }
}
walk('dist');
fs.writeFileSync('docs/build-hashes.json', JSON.stringify(hashes, null, 2) + '\n');
console.log('Prepared minified GitHub Pages artifact in docs/');
