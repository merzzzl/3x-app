import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { build, transform } from 'esbuild';

const [template, styles, bundle] = await Promise.all([
  readFile('public/index.html', 'utf8'),
  readFile('public/styles.css', 'utf8'),
  build({
    entryPoints: ['public/app.js'],
    bundle: true,
    write: false,
    minify: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    supported: { 'inline-script': true },
    legalComments: 'inline',
  }),
]);
const css = await transform(styles, {
  loader: 'css',
  minify: true,
  supported: { 'inline-style': true },
});
const styleTag = '<link rel="stylesheet" href="/styles.css" />';
const scriptTag = '<script type="module" src="/app.js"></script>';
if (!template.includes(styleTag) || !template.includes(scriptTag)) {
  throw new Error('Missing stylesheet or script entry in public/index.html');
}
const html = template
  .replace(styleTag, () => `<style>${css.code}</style>`)
  .replace(scriptTag, () => `<script type="module">${bundle.outputFiles[0].text}</script>`);
await mkdir('dist/web', { recursive: true });
await writeFile('dist/web/index.html', html);
console.log(`Built dist/web/index.html (${Buffer.byteLength(html)} bytes)`);
