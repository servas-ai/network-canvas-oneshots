const fs = require('node:fs');
const path = require('node:path');
const { minify } = require('html-minifier-terser');
const terser = require('terser');
(async () => {
  fs.mkdirSync('dist/scripts', { recursive: true });
  for (const file of fs.readdirSync('.').filter(f => f.endsWith('.html'))) {
    fs.writeFileSync(path.join('dist', file), await minify(fs.readFileSync(file, 'utf8'), {
      collapseWhitespace: true, removeComments: true, minifyCSS: true, minifyJS: true,
      keepClosingSlash: true
    }));
  }
  fs.copyFileSync('manifest.json', 'dist/manifest.json');
  fs.cpSync('screenshots', 'dist/screenshots', { recursive: true });
  const result = await terser.minify(fs.readFileSync('scripts/stage-renderer.js', 'utf8'), { compress: true, mangle: true });
  fs.writeFileSync('scripts/stage-renderer.min.js', result.code + '\n');
  fs.copyFileSync('scripts/stage-renderer.min.js', 'dist/scripts/stage-renderer.min.js');
  console.log('Built all HTML/CSS/JS and local assets into dist/');
})().catch(e => { console.error(e); process.exit(1); });
