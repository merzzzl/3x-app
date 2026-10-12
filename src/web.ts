import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const html = readFileSync(new URL('../dist/web/index.html', import.meta.url), 'utf8');
const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
if (!script) throw new Error('UI bundle is missing. Run npm run build.');
export const scriptHash = `'sha256-${createHash('sha256').update(script).digest('base64')}'`;
