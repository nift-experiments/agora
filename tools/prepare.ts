/** Prepare explicit, reusable inputs; Nift remains the publication composer. */
import { readFile, writeFile, mkdir, readdir, copyFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join, dirname, relative } from 'node:path';
const root = resolve(import.meta.dir, '..');
const app = join(root, 'app');
const generated = join(root, '.generated');
await mkdir(generated, { recursive: true });
const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const readJson = async (path: string, fallback: any) => JSON.parse(await readFile(path, 'utf8').catch(() => JSON.stringify(fallback)));
const statePath = join(generated, 'pipeline-state.json');
const state = await readJson(statePath, {});
const env = { ...process.env, RAYON_NUM_THREADS: process.env.RAYON_NUM_THREADS ?? '4', NODE_OPTIONS: process.env.NODE_OPTIONS ?? '--max-old-space-size=512', VITE_DOCS_REGION: process.env.VITE_DOCS_REGION ?? 'global', SITE_URL: process.env.SITE_URL ?? 'https://docs.agora.io', VITE_SEARCH_RANKING_V2: process.env.VITE_SEARCH_RANKING_V2 ?? 'true', TSS_STATIC_PRERENDER: 'true', VITE_TSS_SPA_STATIC_EXPERIMENT: 'true', NIFT_SEPARATE_CONTENT: 'true', NIFT_CONTENT_ROOT: join(app, 'public'), TSS_CLIENT_OUTPUT_DIR: join(app, 'public'), DOCS_DEV_SCOPE: '', TSS_PRERENDER_PATHS: '' };
if (env.VITE_DOCS_REGION === 'cn' && !process.env.SITE_URL) throw new Error('CN publication requires its explicit SITE_URL');
const bun = process.execPath;
const force = process.argv.includes('--all');
const phases: any[] = [];
async function run(phase: string, args: string[], cwd = root) {
  const start = performance.now();
  console.log(`[nift-pipeline-start] ${phase}`);
  const child = Bun.spawn([bun, ...args], { cwd, env, stdout: 'inherit', stderr: 'inherit' });
  if (await child.exited) throw new Error(`${phase} failed`);
  const seconds = (performance.now() - start) / 1000;
  phases.push({ phase, seconds });
  console.log(`[nift-pipeline] ${phase}: ${seconds.toFixed(3)}s`);
}
async function files(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  return (await Promise.all(entries.map(e => e.isDirectory() ? files(join(dir,e.name)) : [join(dir,e.name)]))).flat().sort();
}
async function signature(paths: string[]) {
  const h = createHash('sha256');
  for (const path of paths.sort()) { h.update(relative(root,path)); h.update(await readFile(path)); }
  return h.digest('hex');
}
const sourceFiles = [...await files(join(app,'content')), join(app,'source.config.ts'), join(app,'bun.lock'), ...await files(join(root,'tools'))].filter(p => !p.endsWith('.pyc'));
const contentSignature = await signature(sourceFiles);
const manifestPath = join(app,'public/__nift/content-manifest.json');
let contentChanged = contentSignature !== state.contentSignature || !await Bun.file(manifestPath).exists();
if (contentChanged) await run('content', ['tools/compile-corpus.ts']);
const appFiles = [...await files(join(app,'src')), join(app,'vite.config.ts'), join(app,'tsconfig.json'), join(app,'package.json'), join(app,'bun.lock')].filter(p => !/\.(test|spec)\.[^.]+$/.test(p) && !p.endsWith('routeTree.gen.ts') && !p.includes('/src/test/'));
const envSignature = hash(JSON.stringify(Object.entries(env).filter(([key]) => key.startsWith('VITE_') || key === 'SITE_URL').sort()));
const appSignature = hash(await signature(appFiles) + envSignature);
const metadataFiles = [...await files(join(app,'content/openapi')), ...await files(join(app,'content/docs'))].filter(p => /meta\.(json|yaml)$|content\/openapi\//.test(p));
const payloadSignature = hash(await signature(metadataFiles) + contentSignature + appSignature);
if (payloadSignature !== state.payloadSignature || !await Bun.file(join(app,'public/__static/docs-seo.json')).exists()) {
  await run('openapi', ['run','openapi:sync'], app);
  await run('payloads', ['tools/update-payload.ts']);
}
const bundleChanged = appSignature !== state.appSignature || !await Bun.file(join(app,'dist/server/server.js')).exists() || !await Bun.file(join(app,'dist/client/index.html')).exists();
if (bundleChanged) await run('application', ['run','build:app:static'], app);
// A forced publication rerenders all articles, but does not pretend a reusable
// application bundle is authored content. Fresh state requires the bundle too.
await run('render', ['tools/run-renderer.ts', ...(force ? ['--all'] : [])]);
await run('assets', ['tools/publish-assets.ts']);
await run('registration', ['tools/register-routes.ts']);
await writeFile(statePath,JSON.stringify({contentSignature,appSignature,payloadSignature},null,2)+'\n');
await writeFile(join(generated,'last-phases.json'),JSON.stringify(phases,null,2)+'\n');
