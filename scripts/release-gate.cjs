const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
assert(manifest.items.length > 0, 'manifest is empty');
for (const file of ['index.html', 'gallery.html', ...manifest.items.flatMap(item => [item.file, item.screenshot])]) {
  assert(typeof file === 'string' && !path.isAbsolute(file) && !file.split('/').includes('..'), 'invalid resource path');
  assert(fs.statSync(file).isFile(), `missing resource: ${file}`);
}
console.log(`Static manifest: ${manifest.items.length} prototypes and screenshots present`);

function hashes(dir) {
  const result = {};
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) walk(file);
      else result[path.relative(dir, file)] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    }
  }
  walk(dir);
  return result;
}

if (fs.existsSync('scripts/build.cjs')) {
  assert.equal(process.version, 'v24.21.0', 'release gate requires Node 24.21.0');
  for (const args of [['ci'], ['run', 'validate'], ['run', 'build']]) {
    execFileSync('npm', args, { stdio: 'inherit' });
  }
  const first = hashes('dist');
  execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });
  assert.deepEqual(hashes('dist'), first, 'build is not reproducible');
  for (const file of ['index.html', 'gallery.html', 'manifest.json', 'scripts/stage-renderer.min.js', ...manifest.items.flatMap(item => [item.file, item.screenshot])]) {
    assert(Object.hasOwn(first, file), `build is missing ${file}`);
  }
  console.log(`Reproducible build: ${Object.keys(first).length} files SHA256-identical`);
  if (fs.existsSync('docs')) {
    assert.deepEqual(JSON.parse(fs.readFileSync('docs/build-hashes.json', 'utf8')), first, 'published hash manifest differs from build');
    const published = hashes('docs');
    assert.equal(fs.statSync('docs/.nojekyll').size, 0);
    delete published['.nojekyll'];
    delete published['build-hashes.json'];
    assert.deepEqual(published, first, 'docs differs from complete build');
    console.log('Pages docs artifact: all files match build and manifest; no extra files');
  }
} else {
  assert(!fs.existsSync('package.json') && !fs.existsSync('docs'), 'unexpected partial build configuration');
  console.log('Existing Pages baseline: no build configuration; static resource check passed');
}
