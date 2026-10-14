/** Compare the current incremental payload publication against its full generator. */
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join, relative } from 'node:path';
const project = resolve(import.meta.dir, '..');
const app = join(project, 'app');
const publicRoot = join(app, 'public');
async function files(dir: string): Promise<string[]> {
  return (await Promise.all((await readdir(dir, { withFileTypes: true })).map(entry => entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]))).flat().sort();
}
async function inventory() {
  const result: Record<string, string> = {};
  for (const path of await files(publicRoot)) {
    const name = relative(publicRoot, path);
    if (!name.startsWith('__static/') && !/^(?:en|zh-CN)(?:\/.*)?\.md$|^llms(?:\/.*|(?:-full)?\.txt)$|^sitemap\.xml$/.test(name)) continue;
    result[name] = createHash('sha256').update(await readFile(path)).digest('hex');
  }
  return result;
}
const before = await inventory();
const start = performance.now();
const full = Bun.spawn([process.execPath, '../tools/generate-payload.ts'], {
  cwd: app, env: process.env, stdout: 'inherit', stderr: 'inherit',
});
if (await full.exited) throw new Error('Full payload verification generator failed');
const after = await inventory();
const differences = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(path => before[path] !== after[path]);
const report = { outputs: Object.keys(after).length, differences, fullVerificationSeconds: (performance.now() - start) / 1000 };
await mkdir(join(project, '.generated'), { recursive: true });
await writeFile(join(project, '.generated/payload-update-equivalence.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`[payload-equivalence] ${report.outputs} derived outputs, ${differences.length} byte differences`);
if (differences.length) throw new Error(`Incremental/full payload divergence: ${differences.slice(0, 12).join(', ')}`);
