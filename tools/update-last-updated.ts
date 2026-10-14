/** Explicit editorial date maintenance; builds never substitute the current clock. */
import { readFile, writeFile, access } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute } from 'node:path';
const project = resolve(import.meta.dir, '..');
const app = join(project, 'app');
const args = process.argv.slice(2);
const isoIndex = args.indexOf('--iso');
if (isoIndex < 0 || !args[isoIndex + 1]) throw new Error('Usage: bun tools/update-last-updated.ts --iso <ISO timestamp> <source paths...>');
const supplied = args[isoIndex + 1];
if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(supplied) || !Number.isFinite(Date.parse(supplied))) throw new Error('Supply a complete valid ISO timestamp');
const iso = new Date(supplied).toISOString();
const inputs = args.filter((_, index) => index !== isoIndex && index !== isoIndex + 1);
if (!inputs.length) throw new Error('Name at least one maintained source path');
const catalogPath = join(project, 'maintained/__nift/content-metadata.json');
const catalog = await readFile(catalogPath, 'utf8').then(JSON.parse).catch(() => null);
const keys: string[] = [];
for (const input of inputs) {
  let key = isAbsolute(input) ? relative(join(app, 'content/docs'), input) : input.replace(/^app\/content\/docs\//, '').replace(/^content\/docs\//, '');
  key = key.replaceAll('\\', '/');
  if (!/^(?:en|zh-CN)\/.+\.mdx?$/.test(key) || key.split('/').some(part => part === '..' || part === '.')) throw new Error(`Invalid docs source path: ${input}`);
  if (catalog) {
    if (!Object.hasOwn(catalog, key)) throw new Error(`Unknown maintained catalog path: ${key}`);
  } else {
    await access(join(app, 'content/docs', key));
  }
  keys.push('content/docs/' + key);
}
const file = join(app, 'src/generated/docs-last-updated-manifest.ts');
let text = await readFile(file, 'utf8');
for (const key of new Set(keys)) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp("('" + escaped + "'\\s*:\\s*')[^']+(')");
  if (pattern.test(text)) text = text.replace(pattern, (_match, before, after) => before + iso + after);
  else {
    const entry = "  '" + key.replaceAll("'", "\\'") + "': '" + iso + "',\n";
    text = text.replace(/\n};\s*$/, '\n' + entry + '};\n');
  }
}
await writeFile(file, text);
console.log(`Updated ${new Set(keys).size} explicit source dates to ${iso}; other imported dates preserved`);

