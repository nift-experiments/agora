/** Bounded process lifetimes: plan exits before sequential content compiler workers begin. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const compiler = path.join(root, 'tools/compile-content.ts');
const args = process.argv.slice(2);
const onlyIndex = args.indexOf('--only');
const only = onlyIndex < 0 ? null : args.slice(onlyIndex + 1).filter((s) => !s.startsWith('--')).flatMap((s) => s.split(','));
const force = args.includes('--force');
const workerSize = Number(process.env.NIFT_CONTENT_WORKER_SIZE ?? 64);
if (!Number.isInteger(workerSize) || workerSize < 1) throw new Error('NIFT_CONTENT_WORKER_SIZE must be a positive integer');
let activeChild: ReturnType<typeof spawn> | null = null;
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
  if (activeChild) activeChild.kill(signal); else process.exit(signal === 'SIGINT' ? 130 : 143);
});
async function child(options: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [compiler, ...options], { cwd: root, env: process.env, stdio: ['ignore', 'pipe', 'inherit'] });
    activeChild = proc;
    let stdout = '';
    proc.stdout.on('data', (chunk) => { stdout += chunk; });
    proc.on('error', reject);
    proc.on('close', (code, signal) => {
      activeChild = null;
      if (code !== 0) return reject(new Error(`Content compiler failed (${code ?? signal}): ${options.join(' ')}`));
      try { resolve(JSON.parse(stdout.trim().split('\n').at(-1)!)); } catch (error) { reject(new Error(`Malformed compiler response: ${stdout}`, { cause: error })); }
    });
  });
}
const started = performance.now();
const plan = await child(['--plan', ...(force ? ['--force'] : []), ...(only ? ['--only', ...only] : [])]);
const planningSeconds = (performance.now() - started) / 1000;
let compiled = 0; const workers = [];
for (let i = 0; i < plan.dirty.length; i += workerSize) {
  const pages = plan.dirty.slice(i, i + workerSize); const at = performance.now();
  console.error(`[content-corpus] worker ${workers.length + 1}/${Math.ceil(plan.dirty.length / workerSize)}: ${pages.length} documents`);
  const result = await child([...(force ? ['--force'] : []), '--only', ...pages]);
  compiled += result.compiled;
  workers.push({ selected: result.selected, compiled: result.compiled, seconds: (performance.now() - at) / 1000 });
}
const finalized = only ? null : await child(['--finalize']);
const report = { selected: plan.selected, dirty: plan.dirty.length, compiled, cached: plan.cached, workerSize, workerCount: workers.length, planningSeconds, wallSeconds: (performance.now() - started) / 1000, workers, deleted: finalized?.deleted ?? [] };
const output = path.join(root, '.generated/content-compiler/corpus-last-run.json');
await fs.mkdir(path.dirname(output), { recursive: true }); await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
